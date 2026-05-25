import { db } from '@/lib/db'
import { computeTotalConsumption, toMoneyString } from '@/lib/finance/income-row-utils'
import {
  billingPeriodAggCustomerConsumption,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawCustomerConsumption,
  billingTenant,
  crmProject,
  customer,
  platformIncomeMonthly,
  projectTenant,
} from '@workspace/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { TenantProjectBinding } from './enrichment'
import { FinanceError } from './errors'
import { financeLog, financeWarn } from './logger'
import { newId } from './operation-log'

function parseNum(s: string | null | undefined): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isNaN(n) ? 0 : n
}

type TenantAggBase = {
  tenantPlatformId: string
  customerType: string
  total: number
  voucher: number
  balance: number
  sourceRawIds: string[]
  rowCount: number
}

export type ComputeIncomeResult = {
  incomeCount: number
  reconciliationIssues: string[]
}

/** 同一 tenant_platform_id 不得混用 B/C */
export function validateCustomerTypeConsistency(
  customerRows: (typeof billingPeriodRawCustomerConsumption.$inferSelect)[],
): void {
  const typesByTenant = new Map<string, Set<string>>()
  for (const row of customerRows) {
    const set = typesByTenant.get(row.tenantPlatformId) ?? new Set<string>()
    set.add(row.customerType)
    typesByTenant.set(row.tenantPlatformId, set)
  }
  const conflicts: string[] = []
  for (const [platformId, types] of typesByTenant) {
    if (types.size > 1) {
      conflicts.push(`${platformId}(${[...types].join('/')})`)
    }
  }
  if (conflicts.length > 0) {
    const sample = conflicts.slice(0, 5).join('、')
    throw new FinanceError(
      'PRECONDITION_FAILED',
      `${conflicts.length} 个租户的客户类型不一致（B/C 混用），请修正 Excel：${sample}`,
    )
  }
}

function buildTenantAggMap(
  customerRows: (typeof billingPeriodRawCustomerConsumption.$inferSelect)[],
): Map<string, TenantAggBase> {
  const map = new Map<string, TenantAggBase>()
  for (const row of customerRows) {
    const cur = map.get(row.tenantPlatformId) ?? {
      tenantPlatformId: row.tenantPlatformId,
      customerType: row.customerType,
      total: 0,
      voucher: 0,
      balance: 0,
      sourceRawIds: [] as string[],
      rowCount: 0,
    }
    cur.total += parseNum(row.totalConsumption)
    cur.voucher += parseNum(row.voucherConsumption)
    cur.balance += parseNum(row.balanceConsumption)
    cur.sourceRawIds.push(row.id)
    cur.rowCount += 1
    map.set(row.tenantPlatformId, cur)
  }
  return map
}

async function classifyTenants(
  platformIds: string[],
): Promise<{ standard: string[]; multi: string[] }> {
  if (platformIds.length === 0) {
    return { standard: [], multi: [] }
  }
  const rows = await db
    .select({
      platformTenantId: billingTenant.platformTenantId,
      projectCount: sql<number>`count(${projectTenant.projectId})::int`,
    })
    .from(billingTenant)
    .leftJoin(projectTenant, eq(projectTenant.tenantId, billingTenant.id))
    .where(inArray(billingTenant.platformTenantId, platformIds))
    .groupBy(billingTenant.platformTenantId)

  const countByPlatform = new Map<string, number>()
  for (const row of rows) {
    if (row.platformTenantId) {
      countByPlatform.set(row.platformTenantId, row.projectCount)
    }
  }

  const standard: string[] = []
  const multi: string[] = []
  for (const id of platformIds) {
    const count = countByPlatform.get(id) ?? 0
    if (count > 1) multi.push(id)
    else standard.push(id)
  }
  return { standard, multi }
}

function splitAmountByPercents(total: number, percents: number[]): number[] {
  if (percents.length === 0) return []
  if (percents.length === 1) return [total]

  const parts: number[] = []
  let allocated = 0
  for (let i = 0; i < percents.length; i++) {
    if (i === percents.length - 1) {
      parts.push(Number((total - allocated).toFixed(4)))
    } else {
      const part = Number(((total * percents[i]!) / 100).toFixed(4))
      parts.push(part)
      allocated += part
    }
  }
  return parts
}

function resolveAllocationPercents(
  projects: TenantProjectBinding['projects'],
  issues: string[],
  platformId: string,
): number[] {
  if (projects.length === 0) return []
  if (projects.length === 1) return [100]

  const configured = projects.every((p) => p.allocationPercent != null)
  if (configured) {
    return projects.map((p) => parseNum(p.allocationPercent))
  }

  issues.push(
    `income_split tenant=${platformId}: 多项目无分成配置，按均分处理`,
  )
  const each = Number((100 / projects.length).toFixed(4))
  const percents = projects.map(() => each)
  const sum = percents.reduce((a, b) => a + b, 0)
  percents[percents.length - 1] = Number(
    ((percents[percents.length - 1] ?? 0) + (100 - sum)).toFixed(4),
  )
  return percents
}

async function insertAggBaseRows(
  periodId: string,
  tenantAggMap: Map<string, TenantAggBase>,
): Promise<void> {
  const rows: (typeof billingPeriodAggCustomerConsumption.$inferInsert)[] = [
    ...tenantAggMap.values(),
  ].map((a) => ({
    id: newId(),
    billingPeriodId: periodId,
    tenantPlatformId: a.tenantPlatformId,
    customerType: a.customerType,
    totalConsumption: toMoneyString(a.total),
    voucherConsumption: toMoneyString(a.voucher),
    balanceConsumption: toMoneyString(a.balance),
    sourceRawIds: a.sourceRawIds,
    rowCountByType: a.rowCount,
  }))

  if (rows.length === 0) return
  await db.insert(billingPeriodAggCustomerConsumption).values(rows)
}

async function enrichStandardAggRows(
  periodId: string,
  standardPlatformIds: string[],
): Promise<void> {
  if (standardPlatformIds.length === 0) return

  const baseRows = await db
    .select()
    .from(billingPeriodAggCustomerConsumption)
    .where(
      and(
        eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId),
        inArray(billingPeriodAggCustomerConsumption.tenantPlatformId, standardPlatformIds),
      ),
    )

  for (const aggRow of baseRows) {
    const linked = await db
      .select({
        tenantId: billingTenant.id,
        customerId: customer.id,
        customerFullName: customer.name,
        projectId: crmProject.id,
        projectName: crmProject.name,
      })
      .from(billingTenant)
      .innerJoin(customer, eq(customer.id, billingTenant.customerId))
      .leftJoin(projectTenant, eq(projectTenant.tenantId, billingTenant.id))
      .leftJoin(crmProject, eq(crmProject.id, projectTenant.projectId))
      .where(eq(billingTenant.platformTenantId, aggRow.tenantPlatformId))
      .limit(1)

    const row = linked[0]
    if (!row) continue

    await db
      .update(billingPeriodAggCustomerConsumption)
      .set({
        tenantId: row.tenantId,
        customerId: row.customerId,
        customerFullName: row.customerFullName,
        projectId: row.projectId,
        projectName: row.projectName,
        allocationPercent: '100.0000',
      })
      .where(eq(billingPeriodAggCustomerConsumption.id, aggRow.id))
  }
}

async function insertStandardIncomeRows(
  periodId: string,
  standardPlatformIds: string[],
  issues: string[],
): Promise<number> {
  if (standardPlatformIds.length === 0) return 0

  const aggRows = await db
    .select()
    .from(billingPeriodAggCustomerConsumption)
    .where(
      and(
        eq(billingPeriodAggCustomerConsumption.billingPeriodId, periodId),
        inArray(billingPeriodAggCustomerConsumption.tenantPlatformId, standardPlatformIds),
      ),
    )

  const tenantIds = [
    ...new Set(aggRows.map((r) => r.tenantId).filter(Boolean) as string[]),
  ]
  const tenantNameById = new Map<string, string>()
  if (tenantIds.length > 0) {
    const tenants = await db
      .select({ id: billingTenant.id, name: billingTenant.name })
      .from(billingTenant)
      .where(inArray(billingTenant.id, tenantIds))
    for (const t of tenants) tenantNameById.set(t.id, t.name)
  }

  const incomeRows: (typeof platformIncomeMonthly.$inferInsert)[] = []
  for (const a of aggRows) {
    if (!a.tenantId) {
      if (a.customerType === 'B') {
        throw new FinanceError(
          'PRECONDITION_FAILED',
          `B 端租户 ${a.tenantPlatformId} 未在 CRM 中维护`,
        )
      }
      issues.push(`未知租户 platform_id=${a.tenantPlatformId}`)
      continue
    }

    const balance = a.balanceConsumption ?? '0'
    incomeRows.push({
      id: newId(),
      billingPeriodId: periodId,
      customerType: a.customerType,
      tenantId: a.tenantId,
      tenantPlatformId: a.tenantPlatformId,
      tenantName: tenantNameById.get(a.tenantId) ?? a.tenantPlatformId,
      customerId: a.customerId,
      customerFullName: a.customerFullName,
      projectId: a.projectId,
      projectName: a.projectName,
      supplementaryConsumption: '0',
      balanceConsumption: balance,
      bareMetalConsumption: '0',
      totalConsumption: balance,
    })
  }

  if (incomeRows.length === 0) return 0
  await db.insert(platformIncomeMonthly).values(incomeRows)
  return incomeRows.length
}

async function applyStandardBaremetal(
  periodId: string,
  standardPlatformIds: string[],
): Promise<void> {
  if (standardPlatformIds.length === 0) return

  const bareRows = await db
    .select({
      tenantPlatformId: billingPeriodRawBaremetalOrder.tenantPlatformId,
      finalAmount: billingPeriodRawBaremetalOrder.finalAmount,
    })
    .from(billingPeriodRawBaremetalOrder)
    .innerJoin(
      billingPeriodImportBatch,
      eq(billingPeriodImportBatch.id, billingPeriodRawBaremetalOrder.batchId),
    )
    .where(
      and(
        eq(billingPeriodImportBatch.billingPeriodId, periodId),
        eq(billingPeriodImportBatch.fileType, 'baremetal_order'),
        inArray(billingPeriodRawBaremetalOrder.tenantPlatformId, standardPlatformIds),
      ),
    )

  const bareByTenant = new Map<string, number>()
  for (const row of bareRows) {
    const cur = bareByTenant.get(row.tenantPlatformId) ?? 0
    bareByTenant.set(row.tenantPlatformId, cur + parseNum(row.finalAmount))
  }

  for (const [platformId, mBare] of bareByTenant) {
    const bareStr = toMoneyString(mBare)
    const incomeRows = await db
      .select()
      .from(platformIncomeMonthly)
      .where(
        and(
          eq(platformIncomeMonthly.billingPeriodId, periodId),
          eq(platformIncomeMonthly.tenantPlatformId, platformId),
        ),
      )

    for (const row of incomeRows) {
      const total = computeTotalConsumption({
        supplementary_consumption: row.supplementaryConsumption ?? '0',
        balance_consumption: row.balanceConsumption ?? '0',
        bare_metal_consumption: bareStr,
      })
      await db
        .update(platformIncomeMonthly)
        .set({
          bareMetalConsumption: bareStr,
          totalConsumption: total,
        })
        .where(eq(platformIncomeMonthly.id, row.id))
    }
  }
}

async function loadBaremetalByTenant(
  periodId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      tenantPlatformId: billingPeriodRawBaremetalOrder.tenantPlatformId,
      finalAmount: billingPeriodRawBaremetalOrder.finalAmount,
    })
    .from(billingPeriodRawBaremetalOrder)
    .innerJoin(
      billingPeriodImportBatch,
      eq(billingPeriodImportBatch.id, billingPeriodRawBaremetalOrder.batchId),
    )
    .where(
      and(
        eq(billingPeriodImportBatch.billingPeriodId, periodId),
        eq(billingPeriodImportBatch.fileType, 'baremetal_order'),
      ),
    )

  const map = new Map<string, number>()
  for (const row of rows) {
    const cur = map.get(row.tenantPlatformId) ?? 0
    map.set(row.tenantPlatformId, cur + parseNum(row.finalAmount))
  }
  return map
}

async function processMultiProjectTenants(input: {
  periodId: string
  multiPlatformIds: string[]
  tenantAggMap: Map<string, TenantAggBase>
  bindings: TenantProjectBinding[]
  bareByTenant: Map<string, number>
  issues: string[]
}): Promise<number> {
  let incomeCount = 0

  for (const platformId of input.multiPlatformIds) {
    const base = input.tenantAggMap.get(platformId)
    if (!base) {
      input.issues.push(`multi_income_skip tenant=${platformId}: 无客户消费汇总`)
      continue
    }

    const binding = input.bindings.find((b) => b.tenantPlatformId === platformId)
    if (!binding?.tenantId) {
      if (base.customerType === 'B') {
        throw new FinanceError(
          'PRECONDITION_FAILED',
          `B 端租户 ${platformId} 未在 CRM 中维护`,
        )
      }
      input.issues.push(`未知租户 platform_id=${platformId}`)
      continue
    }

    const projectRows = await db
      .select({
        projectId: crmProject.id,
        projectName: crmProject.name,
      })
      .from(projectTenant)
      .innerJoin(crmProject, eq(crmProject.id, projectTenant.projectId))
      .where(eq(projectTenant.tenantId, binding.tenantId))

    if (projectRows.length === 0) {
      input.issues.push(`multi_income tenant=${platformId}: 无 project_tenant 关联`)
      continue
    }

    const bindingProjects =
      binding.projects.length > 0
        ? binding.projects
        : projectRows.map((p) => ({
            projectId: p.projectId,
            projectName: p.projectName,
            staffId: null,
            accountManagerName: null,
            allocationPercent: null,
            presetId: null,
          }))

    const percents = resolveAllocationPercents(bindingProjects, input.issues, platformId)
    const totalParts = splitAmountByPercents(base.total, percents)
    const voucherParts = splitAmountByPercents(base.voucher, percents)
    const balanceParts = splitAmountByPercents(base.balance, percents)
    const bareTotal = input.bareByTenant.get(platformId) ?? 0
    const bareParts = splitAmountByPercents(bareTotal, percents)

    const tenant = await db.query.billingTenant.findFirst({
      where: eq(billingTenant.id, binding.tenantId),
    })
    const customerRow = tenant
      ? await db.query.customer.findFirst({
          where: eq(customer.id, tenant.customerId),
        })
      : null

    await db
      .delete(billingPeriodAggCustomerConsumption)
      .where(
        and(
          eq(billingPeriodAggCustomerConsumption.billingPeriodId, input.periodId),
          eq(billingPeriodAggCustomerConsumption.tenantPlatformId, platformId),
        ),
      )

    const aggInserts: (typeof billingPeriodAggCustomerConsumption.$inferInsert)[] = []
    const incomeInserts: (typeof platformIncomeMonthly.$inferInsert)[] = []

    for (let i = 0; i < bindingProjects.length; i++) {
      const proj = bindingProjects[i]!
      const pct = percents[i] ?? 0
      const balanceStr = toMoneyString(balanceParts[i] ?? 0)
      const bareStr = toMoneyString(bareParts[i] ?? 0)
      const supStr = '0'
      const totalStr = computeTotalConsumption({
        supplementary_consumption: supStr,
        balance_consumption: balanceStr,
        bare_metal_consumption: bareStr,
      })

      aggInserts.push({
        id: newId(),
        billingPeriodId: input.periodId,
        tenantPlatformId: platformId,
        customerType: base.customerType,
        tenantId: binding.tenantId,
        customerId: tenant?.customerId ?? null,
        customerFullName: customerRow?.name ?? null,
        projectId: proj.projectId,
        projectName: proj.projectName,
        allocationPercent: pct.toFixed(4),
        totalConsumption: toMoneyString(totalParts[i] ?? 0),
        voucherConsumption: toMoneyString(voucherParts[i] ?? 0),
        balanceConsumption: balanceStr,
        sourceRawIds: base.sourceRawIds,
        rowCountByType: base.rowCount,
      })

      incomeInserts.push({
        id: newId(),
        billingPeriodId: input.periodId,
        customerType: base.customerType,
        tenantId: binding.tenantId,
        tenantPlatformId: platformId,
        tenantName: tenant?.name ?? platformId,
        customerId: tenant?.customerId ?? null,
        customerFullName: customerRow?.name ?? null,
        projectId: proj.projectId,
        projectName: proj.projectName,
        supplementaryConsumption: supStr,
        balanceConsumption: balanceStr,
        bareMetalConsumption: bareStr,
        totalConsumption: totalStr,
      })
    }

    if (aggInserts.length > 0) {
      await db.insert(billingPeriodAggCustomerConsumption).values(aggInserts)
    }
    if (incomeInserts.length > 0) {
      await db.insert(platformIncomeMonthly).values(incomeInserts)
      incomeCount += incomeInserts.length
    }

    financeLog('compute-income', 'multi-project tenant', {
      periodId: input.periodId,
      platformId,
      projectCount: bindingProjects.length,
    })
  }

  return incomeCount
}

function appendRefGapIssues(
  issues: string[],
  tenantAggMap: Map<string, TenantAggBase>,
  bareByTenant: Map<string, number>,
  bBalanceByTenant: Map<string, number>,
): void {
  for (const [platformId, agg] of tenantAggMap) {
    const cBalance = agg.balance
    const bBalance = bBalanceByTenant.get(platformId) ?? 0
    const mBare = bareByTenant.get(platformId) ?? 0
    issues.push(
      `ref_gap tenant=${platformId}: ${(cBalance - bBalance - mBare).toFixed(4)}`,
    )
  }
}

export async function computePeriodIncome(input: {
  periodId: string
  customerRows: (typeof billingPeriodRawCustomerConsumption.$inferSelect)[]
  baremetalRows: (typeof billingPeriodRawBaremetalOrder.$inferSelect)[]
  tenantBillBalanceByTenant: Map<string, number>
  bindings: TenantProjectBinding[]
}): Promise<ComputeIncomeResult> {
  const { periodId, customerRows, bindings } = input
  const issues: string[] = []

  validateCustomerTypeConsistency(customerRows)

  const tenantAggMap = buildTenantAggMap(customerRows)
  const platformIds = [...tenantAggMap.keys()]
  if (platformIds.length === 0) {
    financeWarn('compute-income', 'no customer consumption tenants', { periodId })
    return { incomeCount: 0, reconciliationIssues: issues }
  }

  const { standard, multi } = await classifyTenants(platformIds)
  financeLog('compute-income', 'tenant classified', {
    periodId,
    standard: standard.length,
    multi: multi.length,
  })

  await insertAggBaseRows(periodId, tenantAggMap)

  await enrichStandardAggRows(periodId, standard)

  const bareByTenant = await loadBaremetalByTenant(periodId)
  appendRefGapIssues(issues, tenantAggMap, bareByTenant, input.tenantBillBalanceByTenant)

  let incomeCount = 0

  incomeCount += await insertStandardIncomeRows(periodId, standard, issues)

  await applyStandardBaremetal(periodId, standard)

  incomeCount += await processMultiProjectTenants({
    periodId,
    multiPlatformIds: multi,
    tenantAggMap,
    bindings,
    bareByTenant,
    issues,
  })

  financeLog('compute-income', 'done', { periodId, incomeCount, issueCount: issues.length })
  return { incomeCount, reconciliationIssues: issues }
}
