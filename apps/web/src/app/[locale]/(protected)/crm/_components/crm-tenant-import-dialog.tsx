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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { IconLoader2, IconUpload } from "@tabler/icons-react"
import { toast } from "sonner"

import type { TenantImportResult } from "@/lib/types/billing-tenant"

export type { TenantImportResult }

type ImportPhase = "idle" | "uploading" | "done"

export function CrmTenantImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [file, setFile] = React.useState<File | null>(null)
  const [phase, setPhase] = React.useState<ImportPhase>("idle")
  const [result, setResult] = React.useState<TenantImportResult | null>(null)

  const reset = React.useCallback(() => {
    setFile(null)
    setPhase("idle")
    setResult(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const onUpload = async () => {
    if (!file) {
      toast.error("请选择 Excel 文件")
      return
    }
    setPhase("uploading")
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/crm/tenants/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const body = (await res.json()) as TenantImportResult & { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? "导入失败")
      }
      setResult(body)
      setPhase("done")
      toast.success(`导入完成：新增 ${body.created}，更新 ${body.updated}`)
    } catch (e) {
      setPhase("idle")
      toast.error(e instanceof Error ? e.message : "导入失败")
    }
  }

  const handleClose = (next: boolean) => {
    if (!next && phase === "done") {
      onSuccess()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>导入计费租户</DialogTitle>
          <DialogDescription>
            仅处理：租户ID、租户手机号、租户公司名、联系人及电话、余额、欠费时间、授信额度。已存在租户仅更新余额/欠费/授信。
          </DialogDescription>
        </DialogHeader>

        {phase !== "done" ? (
          <div className="space-y-4">
            <Input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              disabled={phase === "uploading"}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="text-muted-foreground text-sm">
                已选择：{file.name}（{(file.size / 1024).toFixed(1)} KB）
              </p>
            ) : null}
          </div>
        ) : result ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Stat label="总行数" value={result.total} />
              <Stat label="新增" value={result.created} />
              <Stat label="更新" value={result.updated} />
              <Stat label="失败" value={result.failed} />
            </div>
            {result.errors.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">行</TableHead>
                      <TableHead>租户ID</TableHead>
                      <TableHead>原因</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.errors.map((err, i) => (
                      <TableRow key={`${err.row}-${i}`}>
                        <TableCell>{err.row}</TableCell>
                        <TableCell>{err.platformTenantId ?? "—"}</TableCell>
                        <TableCell className="text-destructive text-xs">{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            {phase === "done" ? "关闭" : "取消"}
          </Button>
          {phase !== "done" ? (
            <Button type="button" disabled={!file || phase === "uploading"} onClick={() => void onUpload()}>
              {phase === "uploading" ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  导入中…
                </>
              ) : (
                <>
                  <IconUpload className="mr-2 size-4" />
                  开始导入
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                onSuccess()
                handleClose(false)
              }}
            >
              完成并刷新
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}
