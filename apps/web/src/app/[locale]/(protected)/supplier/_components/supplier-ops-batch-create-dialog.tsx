"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useLocaleRouter } from "@/lib/i18n/navigation"
import { parseInventoryCsv } from "@/lib/supplier-ops/parse-inventory-csv"
import {
  ACCESS_METHOD_OPTIONS,
  MOCK_IDC_OPTIONS,
  OPS_KIND_UI,
} from "@/lib/supplier-ops/ui-meta"
import { useSupplierOpsBatchMockStore } from "@/lib/stores/supplier-ops-batch-mock-store"
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import type { SupplierOpsBatchKind, SupplierOpsUploadBatch } from "@/lib/types/supplier-ops-batch"
import { toast } from "sonner"

function downloadTemplate() {
  const bom = "\ufeff"
  const body = "公网ip,内网ip,root账号,密码\n203.0.113.1,10.0.0.1,root,请修改为强密码\n"
  const blob = new Blob([bom + body], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "设备导入模板.csv"
  a.click()
  URL.revokeObjectURL(url)
}

async function readUploadAsText(file: File): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return {
      ok: false,
      error: "当前 mock 仅解析 UTF-8 CSV。请在 Excel 中「另存为」CSV（逗号分隔）后上传。",
    }
  }
  if (!lower.endsWith(".csv") && !lower.endsWith(".txt")) {
    return { ok: false, error: "请上传 .csv 或 .txt（UTF-8）文件" }
  }
  const text = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ""))
    r.onerror = () => reject(r.error)
    r.readAsText(file, "UTF-8")
  })
  return { ok: true, text }
}

export function SupplierOpsBatchCreateDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: SupplierOpsBatchKind
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const router = useLocaleRouter()
  const ui = OPS_KIND_UI[kind]
  const suppliers = useSupplierDomainMockStore((s) => s.suppliers)
  const addBatch = useSupplierOpsBatchMockStore((s) => s.addBatch)
  const createId = useSupplierOpsBatchMockStore((s) => s.createId)

  const [supplierId, setSupplierId] = React.useState(suppliers[0]?.id ?? "")
  const [idcCode, setIdcCode] = React.useState<string>(MOCK_IDC_OPTIONS[0]!.value)
  const [accessMethod, setAccessMethod] = React.useState<string>(ACCESS_METHOD_OPTIONS[0]!.value)
  const [file, setFile] = React.useState<File | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (open && suppliers[0]?.id && !supplierId) setSupplierId(suppliers[0].id)
  }, [open, suppliers, supplierId])

  const reset = React.useCallback(() => {
    setSupplierId(suppliers[0]?.id ?? "")
    setIdcCode(MOCK_IDC_OPTIONS[0]!.value)
    setAccessMethod(ACCESS_METHOD_OPTIONS[0]!.value)
    setFile(null)
  }, [suppliers])

  const onSubmit = async () => {
    if (!supplierId) {
      toast.error("请选择供应商")
      return
    }
    if (!file) {
      toast.error("请上传清单文件")
      return
    }
    setBusy(true)
    try {
      const read = await readUploadAsText(file)
      if (!read.ok) {
        toast.error(read.error)
        setBusy(false)
        return
      }
      const parsed = parseInventoryCsv(read.text)
      if (!parsed.ok) {
        toast.error(parsed.error)
        setBusy(false)
        return
      }
      const id = createId("ops")
      const row: SupplierOpsUploadBatch = {
        id,
        kind,
        supplier_id: supplierId,
        idc_code: idcCode,
        access_method: accessMethod,
        file_name: file.name,
        rows: parsed.rows,
        status: "parsed",
        created_at: new Date().toISOString(),
      }
      addBatch(row)
      toast.success(`已解析 ${parsed.rows.length} 行`)
      onOpenChange(false)
      reset()
      router.push(`${ui.basePath}/results/${encodeURIComponent(id)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "读取文件失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ui.dialogTitle}</DialogTitle>
          <DialogDescription>
            选择供应商、机房与接入方式；上传 UTF-8 CSV（表头需含公网ip、内网ip、root账号、密码）。Excel 请先另存为 CSV。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>供应商</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="选择供应商" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.short_name}（{s.code}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>机房</Label>
            <Select value={idcCode} onValueChange={setIdcCode}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="选择机房" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_IDC_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>接入方式</Label>
            <Select value={accessMethod} onValueChange={setAccessMethod}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="选择接入方式" />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_METHOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>清单文件（CSV）</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate()}>
                下载模板
              </Button>
            </div>
            <Input
              type="file"
              accept=".csv,.txt,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? <p className="text-muted-foreground text-xs">已选：{file.name}</p> : null}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onSubmit()}>
            {busy ? "解析中…" : "上传并解析"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
