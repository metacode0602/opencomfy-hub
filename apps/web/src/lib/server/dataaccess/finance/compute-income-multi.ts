import { db } from '@/lib/db'
import { computeTotalConsumption, toMoneyString } from '@/lib/finance/income-row-utils'
import {
  billingPeriodAggCustomerConsumption,
  billingPeriodImportBatch,
  billingPeriodRawBaremetalOrder,
  billingTenant,
  crmProject,
  customer,
  platformIncomeMonthly,
  projectTenant,
} from '@workspace/db/schema'
import { and, eq } from 'drizzle-orm'
import type { TenantAggBase } from './compute-income-shared'
import { parseIncomeNum } from './compute-income-shared'
import type { TenantProjectBinding } from './enrichment'
import { FinanceError } from './errors'
import { financeLog } from './logger'
import { newId } from './operation-log'

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
    return projects.map((p) => parseIncomeNum(p.allocationPercent))
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

export async function loadBaremetalByTenant(
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
    map.set(row.tenantPlatformId, cur + parseIncomeNum(row.finalAmount))
  }
  return map
}

/** 多项目租户内存拆行（income-sql-compute-design §5） */
export async function processMultiProjectTenants(input: {
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

    financeLog('compute-income-multi', 'multi-project tenant', {
      periodId: input.periodId,
      platformId,
      projectCount: bindingProjects.length,
    })
  }

  return incomeCount
}
