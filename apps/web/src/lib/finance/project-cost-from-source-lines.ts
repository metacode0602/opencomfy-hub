import { computeSourceLineFinancials } from '@/lib/finance/cost-source-line-financials'
import type { CostSourceLineDto } from '@/lib/server/dataaccess/finance/list-cost-source-lines'

export type ProjectCostMetricRow = {
  region: string
  cardType: string
  dataCenterName: string
  balanceConsumption: number
  balanceCardHours: number
  voucherCardHours: number
  confirmedRevenueExclTax: number
  soldDurationCostExclTax: number
  giftedDurationCostExclTax: number
  grossProfit: number
}

export type ProjectCostTenantGroup = {
  tenantPlatformId: string
  tenantName: string
  customerFullName: string
  accountManager: string
  opportunitySource: string
  monthPhaseLabel: string
  sumRow: ProjectCostMetricRow
  detailRows: ProjectCostMetricRow[]
}

export type ProjectCostResult = {
  groups: ProjectCostTenantGroup[]
  unmatchedTenantPlatformIds: string[]
  skippedLineCount: number
}

export function parseTenantPlatformIds(input: string): string[] {
  return [...new Set(input.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean))]
}

export function collectTenantPlatformIdsFromSourceLines(
  lines: CostSourceLineDto[],
): string[] {
  return [...new Set(lines.map((line) => line.tenant_platform_id).filter(Boolean))]
}

function emptyMetrics(): ProjectCostMetricRow {
  return {
    region: '',
    cardType: '',
    dataCenterName: '',
    balanceConsumption: 0,
    balanceCardHours: 0,
    voucherCardHours: 0,
    confirmedRevenueExclTax: 0,
    soldDurationCostExclTax: 0,
    giftedDurationCostExclTax: 0,
    grossProfit: 0,
  }
}

function addMetrics(
  target: ProjectCostMetricRow,
  source: ProjectCostMetricRow,
): void {
  target.balanceConsumption += source.balanceConsumption
  target.balanceCardHours += source.balanceCardHours
  target.voucherCardHours += source.voucherCardHours
  target.confirmedRevenueExclTax += source.confirmedRevenueExclTax
  target.soldDurationCostExclTax += source.soldDurationCostExclTax
  target.giftedDurationCostExclTax += source.giftedDurationCostExclTax
  target.grossProfit += source.grossProfit
}

function detailKey(line: CostSourceLineDto): string {
  return `${line.data_center_id}::${line.gpu_card_type_id}`
}

function lineMatchesTenantIds(
  line: CostSourceLineDto,
  tenantPlatformIds: string[],
): boolean {
  return tenantPlatformIds.some(
    (id) => line.tenant_platform_id === id || line.tenant_id === id,
  )
}

function buildDetailRow(
  line: CostSourceLineDto,
  financials: NonNullable<ReturnType<typeof computeSourceLineFinancials>>,
): ProjectCostMetricRow {
  return {
    region: line.region ?? '',
    cardType: line.gpu_card_type_name ?? '',
    dataCenterName: line.data_center_name ?? '',
    balanceConsumption: financials.balanceConsumption,
    balanceCardHours: financials.balanceCardHours,
    voucherCardHours: financials.voucherCardHours,
    confirmedRevenueExclTax: financials.confirmedRevenueExclTax,
    soldDurationCostExclTax: financials.soldDurationCostExclTax,
    giftedDurationCostExclTax: financials.giftedDurationCostExclTax,
    grossProfit: financials.grossProfit,
  }
}

export function computeProjectCostFromSourceLines(input: {
  lines: CostSourceLineDto[]
  tenantPlatformIds?: string[]
  allProjects?: boolean
}): ProjectCostResult {
  const { lines, allProjects = false } = input
  const tenantPlatformIds = allProjects
    ? collectTenantPlatformIdsFromSourceLines(lines)
    : (input.tenantPlatformIds ?? [])

  if (tenantPlatformIds.length === 0) {
    return { groups: [], unmatchedTenantPlatformIds: [], skippedLineCount: 0 }
  }

  const matchedLines = allProjects
    ? lines
    : lines.filter((line) => lineMatchesTenantIds(line, tenantPlatformIds))
  const matchedTenantPlatformIds = new Set<string>()
  let skippedLineCount = 0

  const detailBuckets = new Map<
    string,
    {
      tenantPlatformId: string
      tenantName: string
      detail: ProjectCostMetricRow
    }
  >()

  for (const line of matchedLines) {
    matchedTenantPlatformIds.add(line.tenant_platform_id)
    const financials = computeSourceLineFinancials(line)
    if (!financials) {
      skippedLineCount += 1
      continue
    }

    const bucketKey = `${line.tenant_platform_id}::${detailKey(line)}`
    const existing = detailBuckets.get(bucketKey)
    const detail = buildDetailRow(line, financials)
    if (existing) {
      addMetrics(existing.detail, detail)
      continue
    }

    detailBuckets.set(bucketKey, {
      tenantPlatformId: line.tenant_platform_id,
      tenantName: line.tenant_name ?? line.tenant_platform_id,
      detail,
    })
  }

  const groupsByTenant = new Map<string, ProjectCostTenantGroup>()
  for (const bucket of detailBuckets.values()) {
    let group = groupsByTenant.get(bucket.tenantPlatformId)
    if (!group) {
      group = {
        tenantPlatformId: bucket.tenantPlatformId,
        tenantName: bucket.tenantName,
        customerFullName: '',
        accountManager: '',
        opportunitySource: '',
        monthPhaseLabel: '',
        sumRow: emptyMetrics(),
        detailRows: [],
      }
      groupsByTenant.set(bucket.tenantPlatformId, group)
    }
    group.detailRows.push(bucket.detail)
    addMetrics(group.sumRow, bucket.detail)
  }

  for (const line of matchedLines) {
    const group = groupsByTenant.get(line.tenant_platform_id)
    if (group && !group.accountManager && line.staff_name) {
      group.accountManager = line.staff_name
    }
  }

  const groups = [...groupsByTenant.values()]
    .map((group) => ({
      ...group,
      detailRows: [...group.detailRows].sort((a, b) => {
        const regionCmp = a.region.localeCompare(b.region, 'zh-CN')
        if (regionCmp !== 0) return regionCmp
        return a.cardType.localeCompare(b.cardType, 'zh-CN')
      }),
    }))
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName, 'zh-CN'))

  const unmatchedTenantPlatformIds = allProjects
    ? []
    : tenantPlatformIds.filter((id) => !matchedTenantPlatformIds.has(id))

  return { groups, unmatchedTenantPlatformIds, skippedLineCount }
}

export function sumProjectCostGroups(
  groups: ProjectCostTenantGroup[],
): ProjectCostMetricRow {
  const total = emptyMetrics()
  for (const group of groups) {
    addMetrics(total, group.sumRow)
  }
  return total
}
