import {
  MissingPricingAlerts,
  type MissingPricingIssue,
} from '@/app/[locale]/(protected)/finance/_components/missing-pricing-alerts'

export type PendingAllocationIssue = {
  tenantPlatformId: string
  tenantId: string
  tenantName: string | null
  customerFullName: string | null
  reason: 'missing_project' | 'sum_not_100'
  projects: {
    projectId: string
    projectName: string
    staffName: string | null
    allocationPercent: string | null
  }[]
  missingProjects: {
    projectId: string
    projectName: string
    staffName: string | null
    allocationPercent: string | null
  }[]
  allocationSumPercent: number | null
}

function formatTenantAllocationLabel(issue: PendingAllocationIssue): string {
  const parts = [`租户 ${issue.tenantPlatformId}`]
  if (issue.customerFullName) parts.push(`客户：${issue.customerFullName}`)
  if (issue.tenantName && issue.tenantName !== issue.customerFullName) {
    parts.push(`计费租户：${issue.tenantName}`)
  }
  return parts.join('，')
}

type BillingPeriodCostPreCheckAlertsProps = {
  computeError?: string | null
  missingPricing?: MissingPricingIssue[]
  pendingAllocationCount?: number
  pendingAllocations?: PendingAllocationIssue[]
  priceWindowInfo?: {
    hasChanges: boolean
    changedCardTypes: Array<{ code: string; changeDates: string[] }>
  }
  priceWindowPreview?: {
    hasChanges: boolean
    changedCardTypes: Array<{ code: string; changeDates: string[] }>
  }
  ignoreListPriceWindows?: boolean
}

export function BillingPeriodCostPreCheckAlerts({
  computeError,
  missingPricing = [],
  pendingAllocationCount = 0,
  pendingAllocations = [],
  priceWindowInfo,
  priceWindowPreview,
  ignoreListPriceWindows = false,
}: BillingPeriodCostPreCheckAlertsProps) {
  const changedCards =
    priceWindowInfo?.changedCardTypes ?? priceWindowPreview?.changedCardTypes ?? []

  const showPriceWindowHint =
    !ignoreListPriceWindows && changedCards.length > 0

  if (
    !computeError &&
    missingPricing.length === 0 &&
    pendingAllocationCount === 0 &&
    !showPriceWindowHint
  ) {
    return null
  }

  return (
    <div className="space-y-3" role="alert">
      <MissingPricingAlerts message={computeError} missingPricing={missingPricing} />

      {showPriceWindowHint ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">
            账期内平台刊例价有变动，请按时间段分别上传客户账单详情：
          </p>
          <ul className="mt-1 list-inside list-disc">
            {changedCards.map((c) => (
              <li key={c.code}>
                {c.code}（调价日：{c.changeDates.join('、')}）
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ignoreListPriceWindows && changedCards.length > 0 ? (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-muted-foreground">
          已开启「忽略刊例价分段」：整月上传一份客户账单，成本按账期结束日当前刊例价计算。
        </div>
      ) : null}

      {pendingAllocationCount > 0 ? (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">
            {pendingAllocationCount}{' '}
            个租户需先配置成本分成比例（各项目合计 100%）后方可计算：
          </p>
          <ul className="mt-2 list-none space-y-3 pl-0">
            {pendingAllocations.map((issue) => (
              <li
                key={issue.tenantPlatformId}
                className="rounded border border-amber-500/30 bg-background/60 px-3 py-2"
              >
                <p className="font-medium">{formatTenantAllocationLabel(issue)}</p>
                {issue.reason === 'sum_not_100' ? (
                  <p className="mt-1 text-amber-800 dark:text-amber-100">
                    已填分成合计 {issue.allocationSumPercent?.toFixed(2) ?? '—'}%，须为 100%。
                  </p>
                ) : (
                  <p className="mt-1 text-amber-800 dark:text-amber-100">
                    关联 {issue.projects.length} 个项目，{issue.missingProjects.length}{' '}
                    个未配置分成。
                  </p>
                )}
                <ul className="mt-1 list-inside list-disc text-amber-950/90 dark:text-amber-50/90">
                  {(issue.reason === 'sum_not_100'
                    ? issue.projects
                    : issue.missingProjects
                  ).map((project) => (
                    <li key={project.projectId}>
                      {project.projectName}
                      {project.staffName
                        ? `（客户经理：${project.staffName}）`
                        : '（未配置客户经理）'}
                      {project.allocationPercent != null
                        ? ` — 已配 ${project.allocationPercent}%`
                        : ' — 未配置分成'}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-amber-800 dark:text-amber-100">
            请在 CRM 租户详情维护「项目成本分成」预置后重新校验。
          </p>
        </div>
      ) : null}
    </div>
  )
}
