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
import { payChannelLabel } from "@/lib/crm/tenant-billing-import-utils"
import { useListPagination } from "@/hooks/use-list-pagination"
import { trpc } from "@/lib/trpc/client"
import {
  formatDateTime,
  formatRmb,
  rechargeStatusLabels,
} from "./crm-tenant-billing-shared"

export function CrmTenantRechargesList({ tenantId }: { tenantId: string }) {
  const { data: rows = [], isLoading } = trpc.crm.tenants.listRecharges.useQuery({ tenantId })
  const pagination = useListPagination(rows)

  return (
    <Card>
      <CardHeader>
        <CardTitle>充值列表</CardTitle>
        <CardDescription>
          来自数据库 recharge 表，共 {rows.length} 条
          {isLoading ? "，加载中…" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">加载中…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">暂无充值记录，可通过「从平台同步账单」导入。</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>流水号</TableHead>
                    <TableHead>渠道</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>完成时间</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[160px] truncate font-mono text-xs">
                        {row.transactionId || "—"}
                      </TableCell>
                      <TableCell>{payChannelLabel(row.paymentMethod)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRmb(row.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} labelMap={rechargeStatusLabels} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(row.completedAt)}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs">{row.remark ?? "—"}</TableCell>
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
