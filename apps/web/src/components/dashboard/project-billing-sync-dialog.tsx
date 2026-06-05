'use client'

import { useMemo, useState } from 'react'
import { IconCloudDownload, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
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
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { validateBillingDateRange } from '@/lib/crm/tenant-billing-import-utils'
import { trpc } from '@/lib/trpc/client'

function formatDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultBillingStartDate(): string {
  const now = new Date()
  return formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1))
}

function defaultBillingEndDate(): string {
  return formatDateInput(new Date())
}

type ProjectBillingSyncDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  onSynced?: () => void
}

function ProjectBillingSyncDialogBody({
  onOpenChange,
  projectId,
  projectName,
  onSynced,
}: Omit<ProjectBillingSyncDialogProps, 'open'>) {
  const utils = trpc.useUtils()
  const [startDate, setStartDate] = useState(defaultBillingStartDate)
  const [endDate, setEndDate] = useState(defaultBillingEndDate)

  const { data: billingTenants = [], isLoading: tenantsLoading } =
    trpc.crm.projects.listBillingTenants.useQuery({ projectId })

  const syncBilling = trpc.crm.projects.syncBilling.useMutation()

  const dateRangeError = useMemo(() => {
    try {
      validateBillingDateRange(startDate || undefined, endDate || undefined)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : '日期范围无效'
    }
  }, [startDate, endDate])

  const syncableTenants = billingTenants.filter((tenant) => tenant.platformTenantId?.trim())
  const skippedTenants = billingTenants.filter((tenant) => !tenant.platformTenantId?.trim())

  const handleConfirm = async () => {
    if (dateRangeError) {
      toast.error(dateRangeError)
      return
    }
    if (billingTenants.length === 0) {
      toast.error('未找到关联计费租户')
      return
    }
    if (syncableTenants.length === 0) {
      toast.error('关联租户均未绑定平台租户 ID，无法同步')
      return
    }

    try {
      const result = await syncBilling.mutateAsync({
        projectId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })

      onSynced?.()
      onOpenChange(false)

      if (result.failedCount > 0) {
        const failedNames = result.items
          .filter((item) => !item.success)
          .map((item) => item.tenantName)
          .slice(0, 3)
          .join('、')
        toast.warning(
          `账单同步完成：${result.successCount}/${result.items.length} 个租户成功${result.failedCount > 0 ? `；失败：${failedNames}` : ''}`,
        )
      } else if (result.successCount === 0) {
        toast.info('无可同步的计费租户')
      } else {
        toast.success(`账单同步完成：${result.successCount} 个租户已更新`)
      }

      void utils.crm.projects.getById.invalidate({ id: projectId })
      void utils.crm.projects.listBills.invalidate({ projectId })
      void utils.crm.projects.listMonthlyBills.invalidate({ projectId })
      void utils.crm.projects.listRecharges.invalidate({ projectId })
      void utils.crm.projects.listOrders.invalidate({ projectId })
      void utils.crm.projects.listConsumptions.invalidate({ projectId })
      void utils.crm.projects.listDailyConsumptions.invalidate({ projectId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '账单同步失败')
    }
  }

  const isBusy = syncBilling.isPending

  return (
    <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>确认同步账单？</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                将从算算力平台导入项目「{projectName}」关联计费租户的裸金属订单、月度账单、充值记录、账单明细及每日用量。
                受平台 API 限流影响，同步可能耗时较长。
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="project-billing-start">开始日期（可选）</Label>
                  <Input
                    id="project-billing-start"
                    type="date"
                    value={startDate}
                    disabled={isBusy}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project-billing-end">结束日期（可选）</Label>
                  <Input
                    id="project-billing-end"
                    type="date"
                    value={endDate}
                    disabled={isBusy}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={isBusy}
                  onClick={() => {
                    setStartDate('')
                    setEndDate('')
                  }}
                >
                  清除日期
                </Button>
                <span className="text-xs">
                  开始与结束须同时填写或同时留空；留空表示拉取全部历史。
                </span>
              </div>

              {dateRangeError ? (
                <p className="text-destructive text-xs">{dateRangeError}</p>
              ) : null}

              <div className="rounded-md border bg-muted/30 p-3 text-xs text-foreground">
                {tenantsLoading ? (
                  <p>正在加载关联租户…</p>
                ) : billingTenants.length === 0 ? (
                  <p className="text-destructive">未找到关联计费租户</p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      将同步 {syncableTenants.length} 个租户
                      {skippedTenants.length > 0
                        ? `，跳过 ${skippedTenants.length} 个未绑定平台 ID 的租户`
                        : ''}
                      ：
                    </p>
                    <ul className="list-inside list-disc space-y-1">
                      {billingTenants.map((tenant) => (
                        <li key={tenant.id}>
                          <div>
                            {tenant.name}
                            {tenant.platformTenantId
                              ? `（平台 ID：${tenant.platformTenantId}）`
                              : '（未绑定平台 ID，将跳过）'}
                          </div>
                          {tenant.billingSyncLastFinishedAt ? (
                            <div className="text-muted-foreground ml-4 mt-0.5">
                              自动同步：{tenant.billingSyncLastStatus ?? '—'} ·{' '}
                              {new Date(tenant.billingSyncLastFinishedAt).toLocaleString('zh-CN', {
                                hour12: false,
                              })}
                              {tenant.billingSyncCursorEndDate
                                ? ` · 游标 ${tenant.billingSyncCursorEndDate}`
                                : ''}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={isBusy}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            disabled={
              isBusy ||
              tenantsLoading ||
              billingTenants.length === 0 ||
              syncableTenants.length === 0 ||
              Boolean(dateRangeError)
            }
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
          >
            {isBusy ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                同步中…
              </>
            ) : (
              <>
                <IconCloudDownload className="mr-2 size-4" />
                确认同步
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
  )
}

export function ProjectBillingSyncDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSynced,
}: ProjectBillingSyncDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ProjectBillingSyncDialogBody
          onOpenChange={onOpenChange}
          projectId={projectId}
          projectName={projectName}
          onSynced={onSynced}
        />
      ) : null}
    </AlertDialog>
  )
}
