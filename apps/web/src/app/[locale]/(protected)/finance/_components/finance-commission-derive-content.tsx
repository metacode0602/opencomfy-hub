'use client'

import { useMemo, useState } from 'react'
import { LocaleLink } from '@/lib/i18n/navigation'
import { trpc } from '@/lib/trpc/client'
import { formatMoney } from '@/app/[locale]/(protected)/finance/_lib/display'
import {
  COMMISSION_MONTH_PHASE_LABELS,
  OPPORTUNITY_SOURCE_LABELS,
  type CommissionMonthPhase,
  type OpportunitySource,
} from '@/lib/crm/commission-constants'
import { isPublishedPeriodStatus } from '@/app/[locale]/(protected)/finance/_lib/period'
import { CommissionDeriveRegenerateDialog } from '@/app/[locale]/(protected)/finance/_components/commission-derive-regenerate-dialog'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Badge } from '@workspace/ui/components/badge'
import { Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const PHASES: CommissionMonthPhase[] = ['months_1_6', 'months_7_to_2026_12']

type Props = {
  billingPeriodId: string
}

export function FinanceCommissionDeriveContent({ billingPeriodId }: Props) {
  const utils = trpc.useUtils()
  const [regenerateOpen, setRegenerateOpen] = useState(false)

  const { data: period } = trpc.finance.periods.getById.useQuery({ id: billingPeriodId })
  const { data: bundle, isLoading, refetch } = trpc.finance.commissionDerive.getByPeriod.useQuery({
    billingPeriodId,
  })

  const runDerive = trpc.finance.commissionDerive.run.useMutation({
    onSuccess: async (result) => {
      await utils.finance.commissionDerive.getByPeriod.invalidate({ billingPeriodId })
      toast.success(`派生完成：${result.projectCount} 个项目`)
    },
    onError: (e) => toast.error(e.message),
  })

  const isPublished = period ? isPublishedPeriodStatus(period.status) : false

  const amPivot = useMemo(() => {
    const byStaff = new Map<
      string,
      {
        name: string
        phases: Record<
          CommissionMonthPhase,
          { gross: number; sales: number; projects: number }
        >
      }
    >()
    for (const row of bundle?.amPhases ?? []) {
      const phase = row.month_phase as CommissionMonthPhase
      if (!PHASES.includes(phase)) continue
      const acc = byStaff.get(row.account_manager_staff_id) ?? {
        name: row.account_manager_name ?? row.account_manager_staff_id,
        phases: {
          months_1_6: { gross: 0, sales: 0, projects: 0 },
          months_7_to_2026_12: { gross: 0, sales: 0, projects: 0 },
        },
      }
      acc.phases[phase] = {
        gross: Number(row.gross_profit_base_sum) || 0,
        sales: Number(row.sales_commission_sum) || 0,
        projects: row.project_count,
      }
      byStaff.set(row.account_manager_staff_id, acc)
    }
    return [...byStaff.values()]
  }, [bundle?.amPhases])

  const deptByPhase = useMemo(() => {
    const map = new Map<string, { gross: number; pool: number; projects: number }>()
    for (const row of bundle?.deptPhases ?? []) {
      const key = `${row.recipient_dept}:${row.month_phase}`
      map.set(key, {
        gross: Number(row.gross_profit_base_sum) || 0,
        pool: Number(row.commission_pool_sum) || 0,
        projects: row.project_count,
      })
    }
    return map
  }, [bundle?.deptPhases])

  const lineByProject = useMemo(() => {
    const map = new Map<string, { sales: number; marketing: number; middle: number }>()
    for (const line of bundle?.lines ?? []) {
      const acc = map.get(line.project_id) ?? { sales: 0, marketing: 0, middle: 0 }
      const amt = Number(line.commission_amount) || 0
      if (line.recipient_role === 'sales_individual') acc.sales += amt
      if (line.recipient_role === 'marketing_dept_pool') acc.marketing += amt
      if (line.recipient_role === 'middle_office_dept_pool') acc.middle += amt
      map.set(line.project_id, acc)
    }
    return map
  }, [bundle?.lines])

  if (isLoading) {
    return <p className="text-muted-foreground p-6">加载中…</p>
  }

  if (!period) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到账期</p>
        <Button variant="link" asChild className="px-0 mt-2">
          <LocaleLink href="/finance">返回账期列表</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-background p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href="/finance">← 账期列表</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/finance/${billingPeriodId}/cost`}>成本毛利</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>弹性算力提成 · {period.period_code}</CardTitle>
            <CardDescription>
              数据来自提成派生模块，与 platform_cost_monthly 无关。政策期 2026-05～2026-12。
              {bundle?.run
                ? ` 最近派生：${bundle.run.finished_at ?? bundle.run.started_at}`
                : ' 尚未派生'}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              disabled={runDerive.isPending}
              onClick={() => void runDerive.mutateAsync({ billingPeriodId })}
            >
              <Play className="size-4" />
              {runDerive.isPending ? '派生中…' : '运行派生'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setRegenerateOpen(true)}
            >
              <RefreshCw className="size-4" />
              重新上传并派生
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">客户经理分段汇总</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>客户经理</TableHead>
                <TableHead className="text-right">1～6 月毛利</TableHead>
                <TableHead className="text-right">1～6 月提成</TableHead>
                <TableHead className="text-right">7～12 月毛利</TableHead>
                <TableHead className="text-right">7～12 月提成</TableHead>
                <TableHead className="text-right">提成合计</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {amPivot.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    暂无数据，请先运行派生
                  </TableCell>
                </TableRow>
              ) : (
                amPivot.map((row) => {
                  const p1 = row.phases.months_1_6
                  const p2 = row.phases.months_7_to_2026_12
                  const totalSales = p1.sales + p2.sales
                  return (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(String(p1.gross))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(String(p1.sales))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(String(p2.gross))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(String(p2.sales))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatMoney(String(totalSales))}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {(['市场', '中台'] as const).map((dept) => (
          <Card key={dept}>
            <CardHeader>
              <CardTitle className="text-base">{dept}部门池</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>分段</TableHead>
                    <TableHead className="text-right">毛利基数 B</TableHead>
                    <TableHead className="text-right">池提成</TableHead>
                    <TableHead className="text-right">项目数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PHASES.map((phase) => {
                    const cell = deptByPhase.get(`${dept}:${phase}`)
                    return (
                      <TableRow key={phase}>
                        <TableCell>{COMMISSION_MONTH_PHASE_LABELS[phase]}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(String(cell?.gross ?? 0))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(String(cell?.pool ?? 0))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {cell?.projects ?? 0}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">项目明细</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>项目</TableHead>
                <TableHead className="text-right">毛利 B</TableHead>
                <TableHead className="text-right">flex 消费</TableHead>
                <TableHead>月序</TableHead>
                <TableHead>商机来源</TableHead>
                <TableHead className="text-right">销售提成</TableHead>
                <TableHead className="text-right">市场</TableHead>
                <TableHead className="text-right">中台</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(bundle?.projects ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    暂无项目行
                  </TableCell>
                </TableRow>
              ) : (
                bundle!.projects.map((p) => {
                  const commissions = lineByProject.get(p.project_id) ?? {
                    sales: 0,
                    marketing: 0,
                    middle: 0,
                  }
                  const opp = p.opportunity_source as OpportunitySource | null
                  return (
                    <TableRow key={p.project_id}>
                      <TableCell className="font-medium">
                        {p.project_name}
                        {p.skipped_commission ? (
                          <Badge variant="outline" className="ml-2 text-xs">
                            已跳过提成
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(p.gross_profit_base)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(p.flex_consumption)}
                      </TableCell>
                      <TableCell>
                        {p.month_phase
                          ? COMMISSION_MONTH_PHASE_LABELS[p.month_phase as CommissionMonthPhase]
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {opp ? OPPORTUNITY_SOURCE_LABELS[opp] : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(String(commissions.sales))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(String(commissions.marketing))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(String(commissions.middle))}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {(bundle?.issues ?? []).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">异常清单</CardTitle>
            <CardDescription>{bundle!.issues.length} 条</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>项目</TableHead>
                  <TableHead>代码</TableHead>
                  <TableHead>说明</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle!.issues.map((issue, i) => (
                  <TableRow key={`${issue.code}-${issue.project_id ?? i}`}>
                    <TableCell>{issue.project_name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{issue.code}</TableCell>
                    <TableCell>{issue.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <CommissionDeriveRegenerateDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        billingPeriodId={billingPeriodId}
        periodCode={period.period_code}
        periodStart={period.period_start}
        periodEnd={period.period_end}
        isPublished={isPublished}
        onSuccess={() => void refetch()}
      />
    </div>
  )
}
