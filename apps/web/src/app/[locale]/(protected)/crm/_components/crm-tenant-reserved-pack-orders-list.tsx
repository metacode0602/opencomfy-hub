"use client"

import * as React from "react"
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
import { StatusBadge } from "@/components/dashboard/status-badge"
import { ListPagination } from "@/components/shared/list-pagination"
import { useListPagination } from "@/hooks/use-list-pagination"
import { trpc } from "@/lib/trpc/client"
import type { TenantCommerceOrderListItem } from "@/lib/types/tenant-billing-list"
import {
  billingUnitLabels,
  formatDateTime,
  formatRmb,
  orderStatusLabels,
} from "./crm-tenant-billing-shared"

function summarizeItems(order: TenantCommerceOrderListItem) {
  if (order.items.length === 0) return "—"
  return order.items.map((item) => `${item.name} × ${item.quantity}`).join("，")
}

export function CrmTenantReservedPackOrdersList({ tenantId }: { tenantId: string }) {
  const { data: rows = [], isLoading } = trpc.crm.tenants.listReservedPackOrders.useQuery({
    tenantId,
  })
  const pagination = useListPagination(rows)

  return (
    <Card>
      <CardHeader>
        <CardTitle>预留资源包订单</CardTitle>
        <CardDescription>
          来自数据库 commerce_order（reserved_resource_pack），共 {rows.length} 条
          {isLoading ? "，加载中…" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">加载中…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">暂无预留资源包订单。</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>订单号</TableHead>
                    <TableHead>机房</TableHead>
                    <TableHead>资源明细</TableHead>
                    <TableHead>计费单位</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-right">余额消费</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>下单时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.orderNo || "—"}</TableCell>
                      <TableCell>{row.dataCenterName ?? "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{summarizeItems(row)}</TableCell>
                      <TableCell>{row.unit ? (billingUnitLabels[row.unit] ?? row.unit) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRmb(row.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRmb(row.balanceAmount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} labelMap={orderStatusLabels} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(row.createdAt)}
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
  )
}
