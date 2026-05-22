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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { ListPagination } from "@/components/shared/list-pagination"
import { useListPagination } from "@/hooks/use-list-pagination"
import { trpc } from "@/lib/trpc/client"
import { IconLoader2 } from "@tabler/icons-react"
import {
  billDetailTypeLabels,
  billStatusLabels,
  formatDateTime,
  formatRmb,
} from "./crm-tenant-billing-shared"

export function CrmTenantMonthlyBillsList({ tenantId }: { tenantId: string }) {
  const { data: rows = [], isLoading } = trpc.crm.tenants.listMonthlyBills.useQuery({ tenantId })
  const pagination = useListPagination(rows)
  const [selectedBillId, setSelectedBillId] = React.useState<string | null>(null)
  const selectedBill = rows.find((row) => row.id === selectedBillId)

  const { data: details = [], isLoading: detailsLoading } =
    trpc.crm.tenants.getMonthlyBillDetails.useQuery(
      { billId: selectedBillId! },
      { enabled: Boolean(selectedBillId) },
    )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>月度账单概览</CardTitle>
          <CardDescription>
            来自数据库 tenant_bill 表，共 {rows.length} 条
            {isLoading ? "，加载中…" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">加载中…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无月度账单，可通过「从平台同步账单」导入。</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>账期</TableHead>
                      <TableHead className="text-right">总消费</TableHead>
                      <TableHead className="text-right">券/优惠</TableHead>
                      <TableHead className="text-right">余额消费</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>到期日</TableHead>
                      <TableHead>出账时间</TableHead>
                      <TableHead className="w-[88px]">明细</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.items.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.billMonth}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRmb(row.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRmb(row.couponAmount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRmb(row.balanceAmount)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} labelMap={billStatusLabels} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{row.dueDate}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDateTime(row.paidAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedBillId(row.id)}
                          >
                            查看
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ListPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                onPageChange={pagination.setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedBillId)}
        onOpenChange={(open) => {
          if (!open) setSelectedBillId(null)
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>账单明细 · {selectedBill?.billMonth ?? "—"}</DialogTitle>
            <DialogDescription>
              总消费 {formatRmb(selectedBill?.totalAmount ?? 0)} · 余额消费{" "}
              {formatRmb(selectedBill?.balanceAmount ?? 0)} · 券/优惠{" "}
              {formatRmb(selectedBill?.couponAmount ?? 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {detailsLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <IconLoader2 className="size-4 animate-spin" />
                加载明细…
              </div>
            ) : details.length === 0 ? (
              <p className="text-muted-foreground text-sm">该账期暂无明细行。</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>产品线</TableHead>
                    <TableHead>资源</TableHead>
                    <TableHead>付费类型</TableHead>
                    <TableHead className="text-right">消费</TableHead>
                    <TableHead className="text-right">优惠</TableHead>
                    <TableHead className="text-right">余额消费</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.productLine || "—"}</TableCell>
                      <TableCell>{row.resourceName || "—"}</TableCell>
                      <TableCell>{billDetailTypeLabels[row.type] ?? row.type}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRmb(row.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRmb(row.couponAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRmb(row.balanceAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
