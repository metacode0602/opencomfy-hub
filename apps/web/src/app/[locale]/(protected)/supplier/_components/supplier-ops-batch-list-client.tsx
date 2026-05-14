"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Input } from "@workspace/ui/components/input"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useSupplierLabel } from "@/lib/supplier/supplier-domain-lookups"
import {
  accessMethodLabel,
  idcOptionLabel,
  OPS_KIND_UI,
} from "@/lib/supplier-ops/ui-meta"
import { batchesByKind, useSupplierOpsBatchMockStore } from "@/lib/stores/supplier-ops-batch-mock-store"
import type { SupplierOpsBatchKind } from "@/lib/types/supplier-ops-batch"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "../../crm/_components/crm-delete-dialog"
import { SupplierOpsBatchCreateDialog } from "./supplier-ops-batch-create-dialog"

function SupplierCell({ supplierId }: { supplierId: string }) {
  const label = useSupplierLabel(supplierId)
  return <span className="font-medium">{label}</span>
}

export function SupplierOpsBatchListClient({ kind }: { kind: SupplierOpsBatchKind }) {
  const ui = OPS_KIND_UI[kind]
  const all = useSupplierOpsBatchMockStore((s) => s.batches)
  const removeBatch = useSupplierOpsBatchMockStore((s) => s.removeBatch)
  const resetToSeed = useSupplierOpsBatchMockStore((s) => s.resetToSeed)
  const rows = React.useMemo(() => batchesByKind({ batches: all }, kind), [all, kind])
  const [kw, setKw] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const filtered = React.useMemo(() => {
    const q = kw.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const blob = [
        r.file_name,
        r.idc_code,
        r.access_method,
        accessMethodLabel(r.access_method),
        idcOptionLabel(r.idc_code),
        r.status,
        r.created_at,
        String(r.rows.length),
      ]
        .join(" ")
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, kw])

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{ui.title}</CardTitle>
            <CardDescription>{ui.description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => resetToSeed()}>
              恢复示例数据
            </Button>
            <Button type="button" className="gap-2" onClick={() => setOpen(true)}>
              <IconPlus className="size-4" />
              新建
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="筛选：文件名 / 机房 / 接入方式 / 状态 / 时间"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            className="max-w-md"
          />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>供应商</TableHead>
                  <TableHead>机房</TableHead>
                  <TableHead>接入方式</TableHead>
                  <TableHead>文件名</TableHead>
                  <TableHead className="tabular-nums">行数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <SupplierCell supplierId={r.supplier_id} />
                    </TableCell>
                    <TableCell>{idcOptionLabel(r.idc_code)}</TableCell>
                    <TableCell>{accessMethodLabel(r.access_method)}</TableCell>
                    <TableCell className="max-w-[12rem] truncate text-sm">{r.file_name}</TableCell>
                    <TableCell className="tabular-nums">{r.rows.length}</TableCell>
                    <TableCell>{r.status === "parsed" ? "已解析" : "解析失败"}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground text-xs">
                      {r.created_at.replace("T", " ").slice(0, 19)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`${ui.basePath}/${encodeURIComponent(r.id)}`}>详情</LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`${ui.basePath}/results/${encodeURIComponent(r.id)}`}>
                            解析结果
                          </LocaleLink>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          type="button"
                          onClick={() => setDel({ id: r.id, label: r.file_name })}
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SupplierOpsBatchCreateDialog kind={kind} open={open} onOpenChange={setOpen} />

      <CrmDeleteDialog
        open={del != null}
        onOpenChange={(o) => {
          if (!o) setDel(null)
        }}
        title="确认删除该批次？"
        description={del ? `文件：${del.label}` : ""}
        onConfirm={() => {
          if (del) removeBatch(del.id)
        }}
      />
    </div>
  )
}
