'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { formatMoney, formatText } from '@/app/[locale]/(protected)/finance/_lib/display'
import { trpc } from '@/lib/trpc/client'
import type { Project } from '@/lib/data/types'

type DetailRow = {
  data_center_name: string
  region: string
  card_type: string
  balance_consumption: string
  balance_card_hours: string
  voucher_card_hours: string
  confirmed_revenue_excl_tax: string
  sold_duration_cost_excl_tax: string
  gifted_duration_cost_excl_tax: string
  gross_profit: string
}

function DetailRows({ details }: { details: DetailRow[] }) {
  if (details.length === 0) {
    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={10} className="text-sm text-muted-foreground py-3 pl-12">
          暂无机房分项明细
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      {details.map((detail, index) => (
        <TableRow
          key={`${detail.region}-${detail.card_type}-${index}`}
          className="border-l-2 border-l-primary/40 bg-muted/30"
        >
          <TableCell />
          <TableCell className="text-muted-foreground text-sm">分项</TableCell>
          <TableCell />
          <TableCell>{formatText(detail.data_center_name)}</TableCell>
          <TableCell className="font-mono text-xs">{formatText(detail.region)}</TableCell>
          <TableCell>{formatText(detail.card_type)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(detail.confirmed_revenue_excl_tax)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(detail.sold_duration_cost_excl_tax)}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {formatMoney(detail.gifted_duration_cost_excl_tax)}
          </TableCell>
          <TableCell className="text-right tabular-nums font-medium">
            {formatMoney(detail.gross_profit)}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function ProjectMonthlyCostPanel({ project }: { project: Project }) {
  const [openRows, setOpenRows] = useState<Set<string>>(() => new Set())
  const { data: rows = [], isLoading } = trpc.crm.projects.listMonthlyCostSnapshots.useQuery({
    projectId: project.id,
  })

  function toggleRow(id: string) {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">月度收入 / 成本</CardTitle>
        <CardDescription>
          来自财务账期「项目成本」弹窗的已保存快照，按关联租户展示各月确认收入、成本与毛利。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">加载中…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            暂无已保存的月度收入/成本数据。请在财务账期成本中间表中计算并保存。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 p-2" aria-label="展开分项" />
                  <TableHead className="min-w-24 whitespace-nowrap">结算月</TableHead>
                  <TableHead className="min-w-32 whitespace-nowrap">租户</TableHead>
                  <TableHead className="min-w-28 whitespace-nowrap">机房名称</TableHead>
                  <TableHead className="min-w-24 whitespace-nowrap">区域</TableHead>
                  <TableHead className="min-w-24 whitespace-nowrap">卡型</TableHead>
                  <TableHead className="min-w-28 whitespace-nowrap text-right">
                    确认收入（不含税）
                  </TableHead>
                  <TableHead className="min-w-28 whitespace-nowrap text-right">
                    售出时长成本
                  </TableHead>
                  <TableHead className="min-w-28 whitespace-nowrap text-right">
                    赠送时长成本
                  </TableHead>
                  <TableHead className="min-w-24 whitespace-nowrap text-right">毛利</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const details = row.metadata.detail_rows ?? []
                  const hasDetails = details.length > 0
                  const expanded = openRows.has(row.id)

                  return (
                    <Fragment key={row.id}>
                      <TableRow>
                        <TableCell className="p-1 align-middle">
                          {hasDetails ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              aria-expanded={expanded}
                              aria-label={expanded ? '收起分项' : '展开分项'}
                              onClick={() => toggleRow(row.id)}
                            >
                              {expanded ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </Button>
                          ) : (
                            <span className="inline-flex size-8 items-center justify-center text-muted-foreground">
                              ·
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {row.settlement_month}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p>{formatText(row.tenant_name)}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {formatText(row.tenant_platform_id)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.confirmed_revenue_excl_tax)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.sold_duration_cost_excl_tax)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(row.gifted_duration_cost_excl_tax)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMoney(row.gross_profit)}
                        </TableCell>
                      </TableRow>
                      {expanded && hasDetails ? <DetailRows details={details} /> : null}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
