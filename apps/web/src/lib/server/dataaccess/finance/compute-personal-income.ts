import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodPersonalIncomeSummary,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawTenantBill,
  billingPeriodReconciliationReport,
  billingTenant,
} from '@workspace/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { parseMoney, toMoneyString } from '@/lib/finance/income-row-utils'
import {
  PERSONAL_INCOME_RULE_VERSION,
  PERSONAL_INCOME_SUMMARY_KINDS,
  type PersonalIncomeSummaryKind,
} from './constants'
import { FinanceError } from './errors'
import { financeLog } from './logger'
import { appendOperationLog, newId } from './operation-log'
import { buildActiveBlacklistPlatformIdSet } from './personal-income-blacklist'
import {
  listExcludedProjectTenants,
  listProjectLinkedPlatformTenantIds,
} from './personal-income-tenants'
import {
  assertPersonalImportsReady,
  getPersonalImportBatches,
} from './purge-personal'

export type ComputePersonalIncomeResult = {
  summaries: Array<{
    summary_kind: PersonalIncomeSummaryKind
    balance_consumption: string
    bare_metal_consumption: string
    total_consumption: string
    matched_tenant_count: number
  }>
  personalTenantCount: number
  blacklistTenantCount: number
  reconciliationIssues: string[]
}

type TenantAgg = {
  balance: number
  bare: number
  voucher: number
}

function addToAgg(map: Map<string, TenantAgg>, tenantId: string, patch: Partial<TenantAgg>) {
  const key = tenantId.trim()
  const cur = map.get(key) ?? { balance: 0, bare: 0, voucher: 0 }
  map.set(key, {
    balance: cur.balance + (patch.balance ?? 0),
    bare: cur.bare + (patch.bare ?? 0),
    voucher: cur.voucher + (patch.voucher ?? 0),
  })
}

function sumTenants(
  tenantIds: Set<string>,
  agg: Map<string, TenantAgg>,
): { balance: number; bare: number; count: number } {
  let balance = 0
  let bare = 0
  let count = 0
  for (const id of tenantIds) {
    const row = agg.get(id)
    if (!row) continue
    balance += row.balance
    bare += row.bare
    count += 1
  }
  return { balance, bare, count }
}

async function loadPeriodOrThrow(periodId: string) {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, periodId),
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')
  if (period.status === 'void') {
    throw new FinanceError('CONFLICT', '作废账期不可计算')
  }
  if (period.status === 'published' || period.status === 'adjusted') {
    throw new FinanceError('CONFLICT', '已发布账期须先撤回发布后再计算个人收入')
  }
  return period
}

export async function computePersonalPeriodIncome(input: {
  billingPeriodId: string
  actorId?: string | null
}): Promise<ComputePersonalIncomeResult> {
  const periodId = input.billingPeriodId
  await loadPeriodOrThrow(periodId)
  const batches = await getPersonalImportBatches(periodId)
  assertPersonalImportsReady(batches)

  financeLog('compute-personal-income', 'start', {
    periodId,
    ruleVersion: PERSONAL_INCOME_RULE_VERSION,
  })

  const billRows = await db
    .select()
    .from(billingPeriodRawTenantBill)
    .where(eq(billingPeriodRawTenantBill.batchId, batches.tenantBill!.id))

  const bareRows = await db
    .select()
    .from(billingPeriodRawBaremetalOrder)
    .where(eq(billingPeriodRawBaremetalOrder.batchId, batches.baremetal!.id))

  const agg = new Map<string, TenantAgg>()
  const tBill = new Set<string>()
  const tBare = new Set<string>()

  for (const row of billRows) {
    tBill.add(row.tenantPlatformId)
    addToAgg(agg, row.tenantPlatformId, {
      balance: parseMoney(row.balanceConsumption),
      voucher: parseMoney(row.voucherConsumption),
    })
  }

  for (const row of bareRows) {
    tBare.add(row.tenantPlatformId)
    addToAgg(agg, row.tenantPlatformId, {
      bare: parseMoney(row.finalAmount),
    })
  }

  const tExcel = new Set([...tBill, ...tBare])
  const projectLinked = await listProjectLinkedPlatformTenantIds([...tExcel])
  const tPersonal = new Set([...tExcel].filter((id) => !projectLinked.has(id)))

  if (tPersonal.size === 0) {
    throw new FinanceError(
      'PRECONDITION_FAILED',
      '排除项目关联租户后无有效个人收入租户，请检查 Excel 与 CRM 项目配置',
    )
  }

  const blacklistIds = await buildActiveBlacklistPlatformIdSet()
  const tBlacklistPersonal = new Set(
    [...tPersonal].filter((id) => blacklistIds.has(id.trim())),
  )

  const nonProjectTotals = sumTenants(tPersonal, agg)
  const blacklistTotals = sumTenants(tBlacklistPersonal, agg)

  const issues: string[] = []
  const excluded = await listExcludedProjectTenants([...tExcel].filter((id) => projectLinked.has(id)))
  if (excluded.length > 0) {
    issues.push(`已排除 ${excluded.length} 个项目关联租户`)
  }

  const knownRows =
    tPersonal.size > 0
      ? await db
          .select({ platformTenantId: billingTenant.platformTenantId })
          .from(billingTenant)
          .where(inArray(billingTenant.platformTenantId, [...tPersonal]))
      : []
  const knownIds = new Set(knownRows.map((r) => r.platformTenantId).filter(Boolean))
  const unknownCount = [...tPersonal].filter((id) => !knownIds.has(id)).length
  if (unknownCount > 0) {
    issues.push(`警告：${unknownCount} 个平台租户 ID 未在 CRM 主数据中登记，仍计入汇总`)
  }

  const summaryRows: Array<{
    kind: PersonalIncomeSummaryKind
    balance: number
    bare: number
    count: number
  }> = [
    {
      kind: PERSONAL_INCOME_SUMMARY_KINDS.nonProject,
      balance: nonProjectTotals.balance,
      bare: nonProjectTotals.bare,
      count: nonProjectTotals.count,
    },
    {
      kind: PERSONAL_INCOME_SUMMARY_KINDS.blacklist,
      balance: blacklistTotals.balance,
      bare: blacklistTotals.bare,
      count: blacklistTotals.count,
    },
  ]

  const now = new Date()
  const reportJson = {
    ruleVersion: PERSONAL_INCOME_RULE_VERSION,
    blacklistMatchMode: 'active_open',
    tenantCounts: {
      inExcel: tExcel.size,
      projectLinked: projectLinked.size,
      personal: tPersonal.size,
      blacklistPersonal: tBlacklistPersonal.size,
    },
    excludedProjectTenants: excluded,
    totalVoucherConsumption: toMoneyString(
      [...tPersonal].reduce((s, id) => s + (agg.get(id)?.voucher ?? 0), 0),
    ),
    issues,
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(billingPeriodPersonalIncomeSummary)
      .where(eq(billingPeriodPersonalIncomeSummary.billingPeriodId, periodId))

    for (const row of summaryRows) {
      const total = row.balance + row.bare
      await tx.insert(billingPeriodPersonalIncomeSummary).values({
        id: newId(),
        billingPeriodId: periodId,
        summaryKind: row.kind,
        balanceConsumption: toMoneyString(row.balance),
        bareMetalConsumption: toMoneyString(row.bare),
        totalConsumption: toMoneyString(total),
        matchedTenantCount: row.count,
        tenantBillBatchId: batches.tenantBill!.id,
        baremetalBatchId: batches.baremetal!.id,
        ruleVersion: PERSONAL_INCOME_RULE_VERSION,
        lastComputedAt: now,
      })
    }

    const existingReport = await tx.query.billingPeriodReconciliationReport.findFirst({
      where: eq(billingPeriodReconciliationReport.billingPeriodId, periodId),
    })
    const mergedReport = {
      ...(typeof existingReport?.reportJson === 'object' && existingReport.reportJson !== null
        ? (existingReport.reportJson as Record<string, unknown>)
        : {}),
      personalIncome: reportJson,
    }
    if (existingReport) {
      await tx
        .update(billingPeriodReconciliationReport)
        .set({
          reportJson: mergedReport,
          ruleVersion: PERSONAL_INCOME_RULE_VERSION,
        })
        .where(eq(billingPeriodReconciliationReport.id, existingReport.id))
    } else {
      await tx.insert(billingPeriodReconciliationReport).values({
        id: newId(),
        billingPeriodId: periodId,
        reportJson: mergedReport,
        ruleVersion: PERSONAL_INCOME_RULE_VERSION,
      })
    }
  })

  await appendOperationLog({
    billingPeriodId: periodId,
    operation: 'compute_personal_income',
    actorId: input.actorId,
    metadata: {
      ruleVersion: PERSONAL_INCOME_RULE_VERSION,
      personalTenantCount: tPersonal.size,
      blacklistTenantCount: tBlacklistPersonal.size,
    },
  })

  const summaries = summaryRows.map((row) => ({
    summary_kind: row.kind,
    balance_consumption: toMoneyString(row.balance),
    bare_metal_consumption: toMoneyString(row.bare),
    total_consumption: toMoneyString(row.balance + row.bare),
    matched_tenant_count: row.count,
  }))

  financeLog('compute-personal-income', 'done', { periodId, personalTenantCount: tPersonal.size })

  return {
    summaries,
    personalTenantCount: tPersonal.size,
    blacklistTenantCount: tBlacklistPersonal.size,
    reconciliationIssues: issues,
  }
}
