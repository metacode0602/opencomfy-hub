'use client'

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { ListPagination } from '@/components/shared/list-pagination'
import { useListPagination } from '@/hooks/use-list-pagination'
import { trpc } from '@/lib/trpc/client'
import type { DailyConsumption, Project } from '@/lib/data/types'
import { productLineNames } from '@/lib/data/types'

interface ProjectDailyConsumptionPanelProps {
  project: Project
}

const ALL_PRODUCT_LINES = 'all'
const ALL_MONTHS = 'all'

function rowKey(row: Pick<DailyConsumption, 'tenantId' | 'usageDate' | 'productLine'>) {
  return `${row.tenantId}:${row.usageDate}:${row.productLine}`
}

function formatMoney(n: number) {
  return `¥${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCardHours(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

function DailyConsumptionDetailRows({
  projectId,
  row,
}: {
  projectId: string
  row: DailyConsumption
}) {
  const { data: details = [], isLoading } = trpc.crm.projects.listDailyConsumptionDetails.useQuery(
    {
      projectId,
      tenantId: row.tenantId,
      usageDate: row.usageDate,
      productLine: row.productLine,
    },
    { enabled: row.taskCount > 0 },
  )

  if (row.taskCount === 0) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={8} className="text-sm text-muted-foreground py-3 pl-12">
          暂无下钻明细，请通过租户账单同步拉取任务消费
        </TableCell>
      </TableRow>
    )
  }

  if (isLoading) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={8} className="text-sm text-muted-foreground py-3 pl-12">
          加载明细…
        </TableCell>
      </TableRow>
    )
  }

  if (details.length === 0) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={8} className="text-sm text-muted-foreground py-3 pl-12">
          暂无明细数据
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      <TableRow className="bg-muted/20">
        <TableCell />
        <TableCell colSpan={2} className="text-xs font-medium text-muted-foreground pl-12">
          任务
        </TableCell>
        <TableCell className="text-xs font-medium text-muted-foreground">机房</TableCell>
        <TableCell className="text-xs font-medium text-muted-foreground">卡型</TableCell>
        <TableCell className="text-xs font-medium text-muted-foreground">总消费</TableCell>
        <TableCell className="text-xs font-medium text-muted-foreground">算力券</TableCell>
        <TableCell className="text-xs font-medium text-muted-foreground">实付</TableCell>
        <TableCell className="text-xs font-medium text-muted-foreground">卡时</TableCell>
      </TableRow>
      {details.map((d) => (
        <TableRow key={d.id} className="bg-muted/30">
          <TableCell />
          <TableCell colSpan={2} className="text-sm pl-12">
            <div className="space-y-0.5">
              {d.platformTaskId ? (
                <span className="font-mono text-xs text-muted-foreground">
                  任务 {d.platformTaskId}
                </span>
              ) : null}
              <span>{d.taskName ?? '—'}</span>
            </div>
          </TableCell>
          <TableCell className="text-sm">
            {d.dataCenterName !== '—' ? d.dataCenterName : '—'}
          </TableCell>
          <TableCell className="text-sm">
            {d.gpuCardTypeName ?? (d.gpuCardTypeCode !== '_na' ? d.gpuCardTypeCode : '—')}
          </TableCell>
          <TableCell className="text-sm">{formatMoney(d.totalAmount)}</TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {formatMoney(d.voucherAmount)}
          </TableCell>
          <TableCell className="text-sm">{formatMoney(d.balanceAmount)}</TableCell>
          <TableCell className="text-xs text-muted-foreground">
            总 {formatCardHours(d.totalCardHours)} / 券 {formatCardHours(d.voucherCardHours)} / 余{' '}
            {formatCardHours(d.balanceCardHours)}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function ProjectDailyConsumptionPanel({ project }: ProjectDailyConsumptionPanelProps) {
  const [productLine, setProductLine] = useState(ALL_PRODUCT_LINES)
  const [usageMonth, setUsageMonth] = useState(ALL_MONTHS)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const { data: dailyRows = [], isLoading } = trpc.crm.projects.listDailyConsumptions.useQuery({
    projectId: project.id,
    productLine: productLine === ALL_PRODUCT_LINES ? undefined : productLine,
    usageMonth: usageMonth === ALL_MONTHS ? undefined : usageMonth,
  })

  const monthOptions = useMemo(() => {
    const months = new Set(dailyRows.map((r) => r.usageMonth))
    return [...months].sort((a, b) => b.localeCompare(a))
  }, [dailyRows])

  const totals = useMemo(
    () =>
      dailyRows.reduce(
        (acc, row) => ({
          amount: acc.amount + row.amount,
          voucher: acc.voucher + row.voucherAmount,
          balance: acc.balance + row.balanceAmount,
        }),
        { amount: 0, voucher: 0, balance: 0 },
      ),
    [dailyRows],
  )

  const pagination = useListPagination(dailyRows, {
    resetDeps: [productLine, usageMonth],
  })

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">每日消费</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            共 {dailyRows.length} 条（按租户分行），总消费 {formatMoney(totals.amount)}，算力券{' '}
            {formatMoney(totals.voucher)}，实付 {formatMoney(totals.balance)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={usageMonth} onValueChange={setUsageMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="月份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MONTHS}>全部月份</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={productLine} onValueChange={setProductLine}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="产品线" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PRODUCT_LINES}>全部产品线</SelectItem>
              {Object.entries(productLineNames).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>日期</TableHead>
              <TableHead>计费租户</TableHead>
              <TableHead>产品线</TableHead>
              <TableHead>总消费</TableHead>
              <TableHead>算力券</TableHead>
              <TableHead>实付</TableHead>
              <TableHead>任务数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  加载中…
                </TableCell>
              </TableRow>
            ) : dailyRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  暂无消费数据，请在计费租户上执行账单同步
                </TableCell>
              </TableRow>
            ) : (
              pagination.items.map((row) => {
                const key = rowKey(row)
                const expanded = expandedKey === key
                return (
                  <Fragment key={key}>
                    <TableRow>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleExpand(key)}
                          aria-label={expanded ? '收起明细' : '展开明细'}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {new Date(`${row.usageDate}T00:00:00`).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-sm">{row.tenantName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {productLineNames[row.productLine] ?? row.productLine}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatMoney(row.amount)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatMoney(row.voucherAmount)}
                      </TableCell>
                      <TableCell>{formatMoney(row.balanceAmount)}</TableCell>
                      <TableCell className="text-muted-foreground">{row.taskCount}</TableCell>
                    </TableRow>
                    {expanded ? (
                      <DailyConsumptionDetailRows projectId={project.id} row={row} />
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
        {!isLoading && dailyRows.length > 0 ? (
          <ListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
