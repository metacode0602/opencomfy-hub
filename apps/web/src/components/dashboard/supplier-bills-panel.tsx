'use client'

import { CheckCircle2, Download } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import type { Supplier } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import {
  billStatusColors,
  cooperationModeLabels,
  statusNames,
} from '@/components/dashboard/supplier-detail-constants'

interface SupplierBillsPanelProps {
  supplier: Supplier
}

export function SupplierBillsPanel({ supplier }: SupplierBillsPanelProps) {
  const { data: bills = [], isLoading } = trpc.supplier.listBills.useQuery({
    supplierId: supplier.id,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">账单结算</h2>
          <p className="text-sm text-muted-foreground">按月查看与供应商的结算账单</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          导出账单
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">加载账单列表…</p>
      )}

      {!isLoading && bills.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            暂无结算账单
          </CardContent>
        </Card>
      )}

      {bills.map((bill) => (
        <Card key={bill.id} className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <CardTitle className="text-base">{bill.month} 月度账单</CardTitle>
                  <CardDescription>
                    账单生成于 {new Date(bill.createdAt).toLocaleDateString('zh-CN')}
                  </CardDescription>
                </div>
                <Badge variant="outline" className={billStatusColors[bill.status]}>
                  {statusNames[bill.status]}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-foreground">
                  ¥{bill.finalAmount.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">应结金额</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm text-muted-foreground">结算模式</p>
                <Badge
                  variant="outline"
                  className={
                    bill.cooperationMode === 'card_time'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 mt-1'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/30 mt-1'
                  }
                >
                  {cooperationModeLabels[bill.cooperationMode]}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">总使用卡时</p>
                <p className="text-lg font-semibold text-foreground">
                  {bill.totalUsageHours.toLocaleString()} 小时
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">网络费用</p>
                <p className="text-lg font-semibold text-foreground">
                  ¥{bill.networkFee.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">管控节点费用</p>
                <p className="text-lg font-semibold text-foreground">
                  ¥{bill.managementFee.toLocaleString()}
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">机房</TableHead>
                  <TableHead className="text-muted-foreground">卡型</TableHead>
                  <TableHead className="text-muted-foreground">使用卡时</TableHead>
                  <TableHead className="text-muted-foreground">单价</TableHead>
                  {bill.cooperationMode === 'revenue_share' && (
                    <TableHead className="text-muted-foreground">客户消费</TableHead>
                  )}
                  <TableHead className="text-muted-foreground">金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.details.map((detail, index) => (
                  <TableRow key={index} className="border-border">
                    <TableCell className="text-foreground">{detail.dataCenterName}</TableCell>
                    <TableCell className="text-foreground">{detail.cardTypeName}</TableCell>
                    <TableCell className="text-foreground">
                      {detail.usageHours.toLocaleString()} 小时
                    </TableCell>
                    <TableCell className="text-foreground">¥{detail.unitCost}/小时</TableCell>
                    {bill.cooperationMode === 'revenue_share' && (
                      <TableCell className="text-foreground">
                        ¥{(detail.tenantConsumption || 0).toLocaleString()}
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-foreground">
                      {bill.cooperationMode === 'card_time' ? (
                        `¥${detail.amount.toLocaleString()}`
                      ) : (
                        <span>
                          ¥
                          {(
                            ((detail.tenantConsumption || 0) * (supplier.revenueShareRatio || 0)) /
                            100
                          ).toLocaleString()}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">结算截止: {bill.dueDate}</span>
                {bill.paidAt && (
                  <span className="text-green-500 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    已于 {new Date(bill.paidAt).toLocaleDateString('zh-CN')} 结算
                  </span>
                )}
              </div>
              {bill.status === 'pending' && <Button>确认结算</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
