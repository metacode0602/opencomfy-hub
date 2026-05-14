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
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "../../crm/_components/crm-delete-dialog"

function SupplierCell({ supplierId }: { supplierId: string }) {
  const label = useSupplierLabel(supplierId)
  return <span className="font-medium">{label}</span>
}

export function SupplierContractsGlobalListClient() {
  const rows = useSupplierDomainMockStore((s) => s.contracts)
  const removeContract = useSupplierDomainMockStore((s) => s.removeContract)
  const [kw, setKw] = React.useState("")
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const filtered = React.useMemo(() => {
    const q = kw.trim().toLowerCase()
    if (!q) return rows
    const st = useSupplierDomainMockStore.getState()
    return rows.filter((r) => {
      const sup = st.suppliers.find((s) => s.id === r.supplier_id)
      const blob = [
        sup?.code,
        sup?.name,
        sup?.short_name,
        r.contract_no,
        r.status,
        r.contract_url,
        r.effective_from,
        r.effective_to,
      ]
        .filter(Boolean)
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
            <CardTitle>商务合同</CardTitle>
            <CardDescription>
              对应逻辑表 contract（商务合同）：供应商、合同编号、链接、状态与生效区间；新建请在各供应商的「商务合同」关系中操作
            </CardDescription>
          </div>
          <Button asChild variant="outline" className="shrink-0 gap-2">
            <LocaleLink href="/supplier">
              <IconPlus className="size-4" />
              去供应商中心
            </LocaleLink>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="筛选：供应商 / 编码 / 合同编号 / 状态 / 日期 / 链接"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            className="max-w-md"
          />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>供应商</TableHead>
                  <TableHead>合同编号</TableHead>
                  <TableHead>合同链接</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>生效起</TableHead>
                  <TableHead>生效止</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <SupplierCell supplierId={r.supplier_id} />
                        <Button variant="link" className="h-auto p-0 text-xs" asChild>
                          <LocaleLink href={`/supplier/${encodeURIComponent(r.supplier_id)}`}>
                            供应商详情
                          </LocaleLink>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.contract_no}</TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground text-xs">
                      {r.contract_url ? (
                        <a
                          href={r.contract_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {r.contract_url}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="tabular-nums">{r.effective_from}</TableCell>
                    <TableCell className="tabular-nums">{r.effective_to}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink
                            href={`/supplier/${encodeURIComponent(r.supplier_id)}/relations/contracts/${encodeURIComponent(r.id)}`}
                          >
                            详情
                          </LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink
                            href={`/supplier/${encodeURIComponent(r.supplier_id)}/relations/contracts/${encodeURIComponent(r.id)}/edit`}
                          >
                            编辑
                          </LocaleLink>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          type="button"
                          onClick={() => setDel({ id: r.id, label: r.contract_no })}
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

      <CrmDeleteDialog
        open={del != null}
        onOpenChange={(o) => {
          if (!o) setDel(null)
        }}
        title="确认删除商务合同？"
        description={
          del
            ? `合同：${del.label}；将级联删除关联条款版本、接入条件、批次及设备等 mock 数据。`
            : ""
        }
        onConfirm={() => {
          if (del) removeContract(del.id)
        }}
      />
    </div>
  )
}
