'use client'

import { useMemo, useState } from 'react'
import {
  Ban,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Plus,
  Receipt,
  Percent,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingUp,
  Undo2,
  User,
  Wallet,
} from 'lucide-react'
import { LocaleLink, useLocaleRouter } from '@/lib/i18n/navigation'
import { trpc } from '@/lib/trpc/client'
import { formatMoney } from '@/app/[locale]/(protected)/finance/_lib/display'
import {
  formatPeriodStatus,
  isPublishedPeriodStatus,
} from '@/app/[locale]/(protected)/finance/_lib/period'
import { CommissionDeriveRegenerateDialog } from '@/app/[locale]/(protected)/finance/_components/commission-derive-regenerate-dialog'
import { CreateBillingPeriodDialog } from '@/app/[locale]/(protected)/finance/_components/create-billing-period-dialog'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { toast } from 'sonner'
import { IconDots } from '@tabler/icons-react'

function sumDecimal(values: (string | null)[]): number {
  return values.reduce((acc, v) => acc + (Number(v) || 0), 0)
}

type PeriodRow = {
  id: string
  period_code: string
  period_start: string
  period_end: string
  status: string
  enterprise_income: string | null
  personal_income: string | null
  income_total: string | null
  total_income: string | null
  project_cost: string | null
  internal_user_cost: string | null
  total_cost: string | null
}

type ConfirmAction =
  | { type: 'regenerate'; periodId: string; periodCode: string }
  | { type: 'void'; periodId: string; periodCode: string }
  | { type: 'publish'; periodId: string; periodCode: string }
  | { type: 'unpublish'; periodId: string; periodCode: string }
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

function canPublishPeriod(status: string): boolean {
  return status === 'computed' || status === 'adjusted'
}

function canUnpublishPeriod(status: string): boolean {
  return isPublishedPeriodStatus(status)
}

function canRegeneratePeriod(status: string): boolean {
  return (
    status !== 'published' &&
    status !== 'adjusted' &&
    status !== 'void'
  )
}

function canVoidPeriod(status: string): boolean {
  return status === 'published' || status === 'adjusted'
}

export function FinanceBillingPeriodsContent() {
  const router = useLocaleRouter()
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [acting, setActing] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [reuploadPeriodId, setReuploadPeriodId] = useState<string | null>(null)
  const [commissionReupload, setCommissionReupload] = useState<{
    id: string
    periodCode: string
    periodStart: string
    periodEnd: string
    isPublished: boolean
  } | null>(null)

  const { data: periods = [], isLoading } = trpc.finance.periods.list.useQuery()
  const regeneratePeriod = trpc.finance.periods.regenerate.useMutation()
  const voidPeriod = trpc.finance.periods.void.useMutation()
  const publishPeriod = trpc.finance.periods.publish.useMutation()
  const unpublishPeriod = trpc.finance.periods.unpublish.useMutation()

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
  const totalIncome = sumDecimal(
    periods.map((p) => p.income_total ?? p.total_income),
  )
  const totalGrossProfit = sumDecimal(
    periods.map((p) => {
      const income = Number(p.income_total ?? p.total_income) || 0
      const cost = Number(p.total_cost) || 0
      return String(income - cost)
    }),
  )

  const handleConfirmAction = async () => {
    if (!confirmAction) return
    setActing(true)
    try {
      if (confirmAction.type === 'regenerate') {
        await regeneratePeriod.mutateAsync({ billingPeriodId: confirmAction.periodId })
        toast.success(`账期 ${confirmAction.periodCode} 已清空，请重新上传成本文件`)
        setReuploadPeriodId(confirmAction.periodId)
        setCreateDialogOpen(true)
      } else if (confirmAction.type === 'void') {
        await voidPeriod.mutateAsync({ billingPeriodId: confirmAction.periodId })
        toast.success(`账期 ${confirmAction.periodCode} 已作废`)
        setReuploadPeriodId(confirmAction.periodId)
        setCreateDialogOpen(true)
      } else if (confirmAction.type === 'publish') {
        await publishPeriod.mutateAsync({ billingPeriodId: confirmAction.periodId })
        toast.success(`账期 ${confirmAction.periodCode} 已发布`)
      } else {
        await unpublishPeriod.mutateAsync({ billingPeriodId: confirmAction.periodId })
        toast.success(`账期 ${confirmAction.periodCode} 已撤回发布`)
      }
      await utils.finance.periods.list.invalidate()
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
        <Button type="button" onClick={() => {
          setReuploadPeriodId(null)
          setCreateDialogOpen(true)
        }}>
          <Plus className="w-4 h-4 mr-2" />
          添加账期
        </Button>
      </div>

      <CreateBillingPeriodDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          if (!open) setReuploadPeriodId(null)
        }}
        initialPeriodId={reuploadPeriodId}
        onPeriodReady={async (period) => {
          await utils.finance.periods.list.invalidate()
          router.push(`/finance/${period.id}/cost`)
        }}
      />

      {commissionReupload ? (
        <CommissionDeriveRegenerateDialog
          open={Boolean(commissionReupload)}
          onOpenChange={(open) => {
            if (!open) setCommissionReupload(null)
          }}
          billingPeriodId={commissionReupload.id}
          periodCode={commissionReupload.periodCode}
          periodStart={commissionReupload.periodStart}
          periodEnd={commissionReupload.periodEnd}
          isPublished={commissionReupload.isPublished}
          onSuccess={async () => {
            await utils.finance.periods.list.invalidate()
            router.push(`/finance/${commissionReupload.id}/commission`)
          }}
        />
      ) : null}

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
                <p className="text-sm text-muted-foreground">累计收入合计</p>
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
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账期编码</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>账期开始</TableHead>
                <TableHead>账期结束</TableHead>
                <TableHead className="text-right whitespace-nowrap">企业收入</TableHead>
                <TableHead className="text-right whitespace-nowrap">个人收入</TableHead>
                <TableHead className="text-right whitespace-nowrap">收入合计</TableHead>
                <TableHead className="text-right whitespace-nowrap">项目成本</TableHead>
                <TableHead className="text-right whitespace-nowrap">内部用户成本</TableHead>
                <TableHead className="text-right whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : filteredPeriods.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-center text-muted-foreground py-8"
                  >
                    未找到匹配的账期
                  </TableCell>
                </TableRow>
              ) : (
                filteredPeriods.map((p) => (
                  <PeriodActionsRow
                    key={p.id}
                    period={p}
                    onConfirm={setConfirmAction}
                    onCommissionReupload={(period) => setCommissionReupload(period)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialogs
        confirmAction={confirmAction}
        acting={acting}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void handleConfirmAction()}
      />
    </div>
  )
}

function PeriodActionsRow({
  period: p,
  onConfirm,
  onCommissionReupload,
}: {
  period: PeriodRow
  onConfirm: (action: ConfirmAction) => void
  onCommissionReupload: (period: {
    id: string
    periodCode: string
    periodStart: string
    periodEnd: string
    isPublished: boolean
  }) => void
}) {
  const showPublish = canPublishPeriod(p.status)
  const showUnpublish = canUnpublishPeriod(p.status)
  const showRegenerate = canRegeneratePeriod(p.status)
  const showVoid = canVoidPeriod(p.status)
  const showLifecycle =
    showPublish || showUnpublish || showRegenerate || showVoid

  return (
    <TableRow>
      <TableCell className="font-medium">{p.period_code}</TableCell>
      <TableCell>
        <Badge variant="outline" className={STATUS_BADGE_CLASS[p.status] ?? ''}>
          {formatPeriodStatus(p.status)}
        </Badge>
      </TableCell>
      <TableCell className="tabular-nums">{p.period_start}</TableCell>
      <TableCell className="tabular-nums">{p.period_end}</TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap">
        {formatMoney(p.enterprise_income ?? '0')}
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap">
        {formatMoney(p.personal_income ?? '0')}
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap font-medium">
        {formatMoney(p.income_total ?? p.total_income ?? '0')}
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap">
        {formatMoney(p.project_cost ?? '0')}
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap">
        {formatMoney(p.internal_user_cost ?? '0')}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <IconDots className="size-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <LocaleLink href={`/finance/${p.id}/income`} className="flex cursor-pointer items-center gap-2">
                <Wallet className="size-4" />
                企业收入
              </LocaleLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <LocaleLink href={`/finance/${p.id}/personal`} className="flex cursor-pointer items-center gap-2">
                <User className="size-4" />
                个人收入
              </LocaleLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <LocaleLink href={`/finance/${p.id}/cost`} className="flex cursor-pointer items-center gap-2">
                <Receipt className="size-4" />
                成本毛利
              </LocaleLink>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <LocaleLink
                href={`/finance/${p.id}/commission`}
                className="flex cursor-pointer items-center gap-2"
              >
                <Percent className="size-4" />
                弹性算力提成
              </LocaleLink>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2"
              onSelect={() =>
                onCommissionReupload({
                  id: p.id,
                  periodCode: p.period_code,
                  periodStart: p.period_start,
                  periodEnd: p.period_end,
                  isPublished: isPublishedPeriodStatus(p.status),
                })
              }
            >
              <RefreshCw className="size-4" />
              重新上传并派生提成
            </DropdownMenuItem>
            {showLifecycle ? <DropdownMenuSeparator /> : null}
            {showPublish ? (
              <DropdownMenuItem
                className="gap-2"
                onSelect={() =>
                  onConfirm({ type: 'publish', periodId: p.id, periodCode: p.period_code })
                }
              >
                <CheckCircle2 className="size-4" />
                发布账期
              </DropdownMenuItem>
            ) : null}
            {showUnpublish ? (
              <DropdownMenuItem
                className="gap-2"
                onSelect={() =>
                  onConfirm({ type: 'unpublish', periodId: p.id, periodCode: p.period_code })
                }
              >
                <Undo2 className="size-4" />
                撤回发布
              </DropdownMenuItem>
            ) : null}
            {showRegenerate ? (
              <DropdownMenuItem
                className="gap-2"
                onSelect={() =>
                  onConfirm({ type: 'regenerate', periodId: p.id, periodCode: p.period_code })
                }
              >
                <RotateCcw className="size-4" />
                清空并重新上传
              </DropdownMenuItem>
            ) : null}
            {showVoid ? (
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onSelect={() =>
                  onConfirm({ type: 'void', periodId: p.id, periodCode: p.period_code })
                }
              >
                <Ban className="size-4" />
                作废账期
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function ConfirmDialogs({
  confirmAction,
  acting,
  onClose,
  onConfirm,
}: {
  confirmAction: ConfirmAction
  acting: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <AlertDialog
        open={confirmAction?.type === 'regenerate'}
        onOpenChange={(open) => !open && onClose()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空并重新上传？</AlertDialogTitle>
            <AlertDialogDescription>
              将清空账期 {confirmAction?.periodCode} 的全部已导入与计算结果，之后需重新上传裸金属与客户账单并计算成本。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={acting}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction type="button" disabled={acting} onClick={onConfirm}>
              {acting ? '处理中…' : '确认清空并继续'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAction?.type === 'void'}
        onOpenChange={(open) => !open && onClose()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认作废已发布账期？</AlertDialogTitle>
            <AlertDialogDescription>
              账期 {confirmAction?.periodCode} 已发布。作废后将清空全部导入与计算数据，并撤回发布状态；之后需重新上传成本文件。此操作不可撤销。
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
              onClick={onConfirm}
            >
              {acting ? '处理中…' : '确认作废'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAction?.type === 'publish'}
        onOpenChange={(open) => !open && onClose()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认发布账期？</AlertDialogTitle>
            <AlertDialogDescription>
              发布后账期 {confirmAction?.periodCode} 的收入与成本明细将锁定；如需修改须先撤回发布或作废。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={acting}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction type="button" disabled={acting} onClick={onConfirm}>
              {acting ? '处理中…' : '确认发布'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmAction?.type === 'unpublish'}
        onOpenChange={(open) => !open && onClose()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认撤回发布？</AlertDialogTitle>
            <AlertDialogDescription>
              账期 {confirmAction?.periodCode} 将恢复为已计算状态，可继续调整并重新发布。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={acting}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction type="button" disabled={acting} onClick={onConfirm}>
              {acting ? '处理中…' : '确认撤回'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
