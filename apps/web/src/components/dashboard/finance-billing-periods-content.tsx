'use client'

import { useMemo, useState } from 'react'
import { Calendar, Plus, Receipt, RotateCcw, Search, TrendingUp } from 'lucide-react'
import { LocaleLink, useLocaleRouter } from '@/lib/i18n/navigation'
import { trpc } from '@/lib/trpc/client'
import { formatMoney } from '@/app/[locale]/(protected)/finance/_lib/display'
import {
  formatPeriodStatus,
  isPublishedPeriodStatus,
} from '@/app/[locale]/(protected)/finance/_lib/period'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { toast } from 'sonner'
import { CreateBillingPeriodDialog } from '@/app/[locale]/(protected)/finance/create/_components/create-billing-period-dialog'

function sumDecimal(values: (string | null)[]): number {
  return values.reduce((acc, v) => acc + (Number(v) || 0), 0)
}

type ConfirmAction =
  | { type: 'regenerate'; periodId: string; periodCode: string }
  | { type: 'void'; periodId: string; periodCode: string }
  | null

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'border-muted-foreground/30 text-muted-foreground',
  imported: 'border-blue-500/40 text-blue-700 dark:text-blue-300',
  import_error: 'border-destructive/40 text-destructive',
  pending_allocation: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  pending_pricing: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  computed: 'border-violet-500/40 text-violet-700 dark:text-violet-300',
  published: 'border-green-500/40 text-green-700 dark:text-green-300',
  adjusted: 'border-green-500/40 text-green-700 dark:text-green-300',
}

export function FinanceBillingPeriodsContent() {
  const router = useLocaleRouter()
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [acting, setActing] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const { data: periods = [], isLoading } = trpc.finance.periods.list.useQuery()
  const regeneratePeriod = trpc.finance.periods.regenerate.useMutation()
  const voidPeriod = trpc.finance.periods.void.useMutation()

  const filteredPeriods = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return periods
    return periods.filter(
      (p) =>
        p.period_code.toLowerCase().includes(q) ||
        p.period_start.includes(q) ||
        p.period_end.includes(q),
    )
  }, [periods, search])

  const periodCount = periods.length
  const totalIncome = sumDecimal(periods.map((p) => p.total_income))
  const totalGrossProfit = sumDecimal(
    periods.map(
      (p) => String((Number(p.total_income) || 0) - (Number(p.total_cost) || 0)),
    ),
  )

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    setActing(true)
    try {
      if (confirmAction.type === 'regenerate') {
        await regeneratePeriod.mutateAsync({ billingPeriodId: confirmAction.periodId })
        toast.success(`账期 ${confirmAction.periodCode} 已清空，请重新上传数据`)
      } else {
        await voidPeriod.mutateAsync({ billingPeriodId: confirmAction.periodId })
        toast.success(`账期 ${confirmAction.periodCode} 已作废，请重新上传生成`)
      }
      await utils.finance.periods.list.invalidate()
      router.push(`/finance/create?periodId=${confirmAction.periodId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setActing(false)
      setConfirmAction(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">账期管理</h1>
          <p className="text-muted-foreground">
            管理全部账期，按账期查看收入明细与成本毛利明细
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* <Button variant="outline" asChild>
            <LocaleLink href="/finance/create/single">
              <Receipt className="w-4 h-4 mr-2" />
              CRM 账单收入
            </LocaleLink>
          </Button> */}
          <Button type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            添加账期
          </Button>
        </div>
      </div>

      <CreateBillingPeriodDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onPeriodReady={async (period) => {
          await utils.finance.periods.list.invalidate()
          router.push(`/finance/create?periodId=${period.id}`)
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">账期总数</p>
                <p className="text-2xl font-bold">{periodCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">累计总收入</p>
                <p className="text-2xl font-bold">¥{formatMoney(String(totalIncome))}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">累计毛利</p>
                <p className="text-2xl font-bold">
                  ¥{formatMoney(String(totalGrossProfit))}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索账期编码、开始或结束日期..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账期编码</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>账期开始</TableHead>
                <TableHead>账期结束</TableHead>
                <TableHead className="text-right">账期总收入</TableHead>
                <TableHead className="text-right">账期总成本</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : filteredPeriods.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    未找到匹配的账期
                  </TableCell>
                </TableRow>
              ) : (
                filteredPeriods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.period_code}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE_CLASS[p.status] ?? ''}
                      >
                        {formatPeriodStatus(p.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{p.period_start}</TableCell>
                    <TableCell className="tabular-nums">{p.period_end}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.total_income ?? '0')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(p.total_cost ?? '0')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/finance/${p.id}/income`}>企业收入</LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/finance/${p.id}/personal`}>个人收入</LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`/finance/${p.id}/cost`}>成本</LocaleLink>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmAction?.type === 'regenerate'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重新上传生成？</AlertDialogTitle>
            <AlertDialogDescription>
              将清空账期 {confirmAction?.periodCode} 的全部已导入与计算结果，之后需重新上传三类
              Excel 并计算。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={acting}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={acting}
              onClick={() => void handleConfirmAction()}
            >
              {acting ? '处理中…' : '确认清空并继续'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAction?.type === 'void'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认作废已发布账期？</AlertDialogTitle>
            <AlertDialogDescription>
              账期 {confirmAction?.periodCode} 已发布。作废后将清空全部导入与计算数据，并撤回发布状态；
              之后需重新上传三类 Excel 并重新计算发布。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={acting}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={acting}
              onClick={() => void handleConfirmAction()}
            >
              {acting ? '处理中…' : '确认作废'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
