import { db } from '@/lib/db'
import type {
  CustomerMergePreview,
  CustomerMergeResult,
} from '@/lib/types/customer-merge'
import {
  accountActivity,
  accountManagerAssignment,
  billingTenant,
  commerceOrder,
  consumptionRecord,
  consumptionUsageDaily,
  contract,
  contractSnapshot,
  conversionRecord,
  crmProject,
  customer,
  engagementComment,
  engagementDocument,
  followUpTask,
  lifecycleMilestone,
  rechargeOrder,
  tenantBalanceSnapshot,
  tenantBill,
  tenantConsumptionDailyDetail,
  testVoucherIssue,
} from '@workspace/db/schema'
import { and, count, eq, inArray, ne, type AnyColumn } from 'drizzle-orm'

export const CUSTOMER_MERGE_MAX_SOURCES = 20

type CustomerRow = typeof customer.$inferSelect

type MergeContext = {
  targetCustomerId: string
  sourceCustomerIds: string[]
}

type CustomerIdColumnRef = {
  name: string
  customerId: AnyColumn
  table: Parameters<typeof db.update>[0]
}

const CUSTOMER_ID_TABLES: CustomerIdColumnRef[] = [
  { name: 'account_manager_assignment', customerId: accountManagerAssignment.customerId, table: accountManagerAssignment },
  { name: 'lifecycle_milestone', customerId: lifecycleMilestone.customerId, table: lifecycleMilestone },
  { name: 'conversion_record', customerId: conversionRecord.customerId, table: conversionRecord },
  { name: 'engagement_document', customerId: engagementDocument.customerId, table: engagementDocument },
  { name: 'follow_up_task', customerId: followUpTask.customerId, table: followUpTask },
  { name: 'engagement_comment', customerId: engagementComment.customerId, table: engagementComment },
  { name: 'account_activity', customerId: accountActivity.customerId, table: accountActivity },
  { name: 'contract', customerId: contract.customerId, table: contract },
  { name: 'consumption_record', customerId: consumptionRecord.customerId, table: consumptionRecord },
  { name: 'commerce_order', customerId: commerceOrder.customerId, table: commerceOrder },
  { name: 'tenant_bill', customerId: tenantBill.customerId, table: tenantBill },
  { name: 'test_voucher_issue', customerId: testVoucherIssue.customerId, table: testVoucherIssue },
  { name: 'contract_snapshot', customerId: contractSnapshot.customerId, table: contractSnapshot },
  { name: 'recharge_order', customerId: rechargeOrder.customerId, table: rechargeOrder },
  { name: 'consumption_usage_daily', customerId: consumptionUsageDaily.customerId, table: consumptionUsageDaily },
  {
    name: 'tenant_consumption_daily_detail',
    customerId: tenantConsumptionDailyDetail.customerId,
    table: tenantConsumptionDailyDetail,
  },
  { name: 'tenant_balance_snapshot', customerId: tenantBalanceSnapshot.customerId, table: tenantBalanceSnapshot },
]

const BACKFILL_STRING_FIELDS = [
  'customerCode',
  'shortName',
  'certCode',
  'contactPerson',
  'contactPhone',
  'contactEmail',
  'industry',
  'address',
  'salesManagerId',
  'lifecyclePhase',
  'conversionTrigger',
] as const

const BACKFILL_DATE_FIELDS = ['testStartedOn', 'testCompletedOn', 'conversionDate'] as const

const BACKFILL_JSON_FIELDS = ['expectedScale', 'observedScaleSummary'] as const

function newId() {
  return crypto.randomUUID()
}

function isEmptyString(value: string | null | undefined): boolean {
  return value == null || value.trim() === ''
}

function normalizeSourceIds(targetCustomerId: string, sourceCustomerIds: string[]): string[] {
  const unique = [...new Set(sourceCustomerIds.map((id) => id.trim()).filter(Boolean))]
  return unique.filter((id) => id !== targetCustomerId)
}

function validateMergeInput(targetCustomerId: string, sourceCustomerIds: string[]): MergeContext {
  const sources = normalizeSourceIds(targetCustomerId, sourceCustomerIds)
  if (sources.length === 0) {
    throw new Error('请至少选择一个源客户（不能与目标客户相同）')
  }
  if (sources.length > CUSTOMER_MERGE_MAX_SOURCES) {
    throw new Error(`一次最多合并 ${CUSTOMER_MERGE_MAX_SOURCES} 个源客户`)
  }
  return { targetCustomerId, sourceCustomerIds: sources }
}

async function countRowsForTable(entry: CustomerIdColumnRef, customerIds: string[]): Promise<number> {
  if (customerIds.length === 0) return 0
  const [row] = await db
    .select({ total: count() })
    .from(entry.table)
    .where(inArray(entry.customerId, customerIds))
  return Number(row?.total ?? 0)
}

async function countProjectsForCustomers(customerIds: string[]): Promise<number> {
  if (customerIds.length === 0) return 0
  const [row] = await db
    .select({ total: count() })
    .from(crmProject)
    .where(inArray(crmProject.customerId, customerIds))
  return Number(row?.total ?? 0)
}

async function loadCustomersByIds(ids: string[]): Promise<Map<string, CustomerRow>> {
  if (ids.length === 0) return new Map()
  const rows = await db.select().from(customer).where(inArray(customer.id, ids))
  return new Map(rows.map((row) => [row.id, row]))
}

async function loadTenantsByCustomerIds(customerIds: string[]) {
  if (customerIds.length === 0) return []
  return db.select().from(billingTenant).where(inArray(billingTenant.customerId, customerIds))
}

async function loadProjectsByCustomerIds(customerIds: string[]) {
  if (customerIds.length === 0) return []
  return db.select().from(crmProject).where(inArray(crmProject.customerId, customerIds))
}

function computeBackfill(
  target: CustomerRow,
  sources: CustomerRow[],
): { patch: Partial<CustomerRow>; fields: string[]; warnings: string[] } {
  const patch: Partial<CustomerRow> = {}
  const fields: string[] = []
  const warnings: string[] = []

  for (const field of BACKFILL_STRING_FIELDS) {
    const current = target[field]
    if (!isEmptyString(current)) continue

    const values = sources
      .map((row) => row[field])
      .filter((value): value is string => !isEmptyString(value))
    const unique = [...new Set(values.map((value) => value.trim()))]
    if (unique.length === 1) {
      patch[field] = unique[0] as CustomerRow[typeof field]
      fields.push(field)
    } else if (unique.length > 1) {
      warnings.push(`字段 ${field} 在多个源客户中不一致，已保留目标客户原值`)
    }
  }

  for (const field of BACKFILL_DATE_FIELDS) {
    const current = target[field]
    if (current != null) continue
    const values = sources.map((row) => row[field]).filter((value) => value != null)
    const unique = [...new Set(values.map((value) => String(value)))]
    if (unique.length === 1) {
      patch[field] = values[0] as CustomerRow[typeof field]
      fields.push(field)
    } else if (unique.length > 1) {
      warnings.push(`字段 ${field} 在多个源客户中不一致，已保留目标客户原值`)
    }
  }

  for (const field of BACKFILL_JSON_FIELDS) {
    const current = target[field]
    if (current != null) continue
    const values = sources.map((row) => row[field]).filter((value) => value != null)
    if (values.length === 1) {
      patch[field] = values[0] as CustomerRow[typeof field]
      fields.push(field)
    } else if (values.length > 1) {
      warnings.push(`字段 ${field} 在多个源客户中不一致，已保留目标客户原值`)
    }
  }

  if (isEmptyString(target.customerCode)) {
    const codes = sources
      .map((row) => row.customerCode)
      .filter((value): value is string => !isEmptyString(value))
    const unique = [...new Set(codes.map((value) => value.trim()))]
    if (unique.length > 1) {
      warnings.push('多个源客户存在不同的 customer_code，未自动回填')
    }
  } else if (
    sources.some((row) => !isEmptyString(row.customerCode) && row.customerCode !== target.customerCode)
  ) {
    warnings.push('源客户存在不同的 customer_code，已保留目标客户编码')
  }

  return { patch, fields, warnings }
}

function resolveDefaultTenantId(
  targetTenants: Awaited<ReturnType<typeof loadTenantsByCustomerIds>>,
  sourceTenants: Awaited<ReturnType<typeof loadTenantsByCustomerIds>>,
  sourceCustomers: CustomerRow[],
  overrideId?: string,
): string {
  const allTenants = [...targetTenants, ...sourceTenants]
  if (allTenants.length === 0) {
    throw new Error('合并后目标客户下没有计费租户')
  }

  if (overrideId) {
    const hit = allTenants.find((tenant) => tenant.id === overrideId)
    if (!hit) throw new Error('所选默认计费账户不属于本次合并范围')
    return overrideId
  }

  const targetDefault = targetTenants.find((tenant) => tenant.isDefault)
  if (targetDefault) return targetDefault.id

  for (const source of sourceCustomers) {
    const sourceDefault = sourceTenants.find(
      (tenant) => tenant.customerId === source.id && tenant.isDefault,
    )
    if (sourceDefault) return sourceDefault.id
  }

  return allTenants[0]!.id
}

function findDuplicateNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  for (const name of names) {
    seen.set(name, (seen.get(name) ?? 0) + 1)
  }
  return [...seen.entries()].filter(([, countValue]) => countValue > 1).map(([name]) => name)
}

function emptyBlockedPreview(
  targetCustomerId: string,
  sourceCustomerIds: string[],
  blockReason: string,
): CustomerMergePreview {
  return {
    targetCustomer: {
      id: targetCustomerId,
      name: '',
      tenantCount: 0,
      projectCount: 0,
    },
    sourceCustomers: sourceCustomerIds.map((id) => ({
      id,
      name: '',
      tenantCount: 0,
      projectCount: 0,
      tenants: [],
      projects: [],
    })),
    blocked: true,
    blockReason,
    impacts: {
      tenantsToMove: 0,
      projectsToMove: 0,
      rowsByTable: {},
    },
    defaultTenant: {
      recommendedId: '',
      candidates: [],
    },
    backfillFields: [],
    warnings: [],
  }
}

async function buildPreview(ctx: MergeContext): Promise<CustomerMergePreview> {
  const { targetCustomerId, sourceCustomerIds } = ctx
  const allIds = [targetCustomerId, ...sourceCustomerIds]
  const customerMap = await loadCustomersByIds(allIds)

  const targetRow = customerMap.get(targetCustomerId)
  if (!targetRow) {
    return emptyBlockedPreview(targetCustomerId, sourceCustomerIds, '目标客户不存在')
  }

  const sourceRows = sourceCustomerIds
    .map((id) => customerMap.get(id))
    .filter((row): row is CustomerRow => row != null)

  if (sourceRows.length !== sourceCustomerIds.length) {
    return emptyBlockedPreview(targetCustomerId, sourceCustomerIds, '部分源客户不存在')
  }

  const [targetTenants, sourceTenants, sourceProjects, targetProjectCount] = await Promise.all([
    loadTenantsByCustomerIds([targetCustomerId]),
    loadTenantsByCustomerIds(sourceCustomerIds),
    loadProjectsByCustomerIds(sourceCustomerIds),
    countProjectsForCustomers([targetCustomerId]),
  ])

  const emptySources = sourceRows.filter((row) => {
    const tenantCount = sourceTenants.filter((tenant) => tenant.customerId === row.id).length
    const projectCount = sourceProjects.filter((project) => project.customerId === row.id).length
    return row.status === 'inactive' && tenantCount === 0 && projectCount === 0
  })

  if (emptySources.length > 0) {
    return emptyBlockedPreview(
      targetCustomerId,
      sourceCustomerIds,
      `源客户「${emptySources.map((row) => row.name).join('、')}」已合并或无可迁移数据`,
    )
  }

  const rowsByTable: Record<string, number> = {
    tenant: sourceTenants.length,
    project: sourceProjects.length,
  }

  for (const entry of CUSTOMER_ID_TABLES) {
    rowsByTable[entry.name] = await countRowsForTable(entry, sourceCustomerIds)
  }

  const { fields: backfillFields, warnings: backfillWarnings } = computeBackfill(targetRow, sourceRows)

  const duplicateProjectNames = findDuplicateNames(sourceProjects.map((project) => project.name))
  const warnings = [...backfillWarnings]
  if (duplicateProjectNames.length > 0) {
    warnings.push(`源客户之间存在同名项目：${duplicateProjectNames.join('、')}`)
  }

  const sourceCustomers = sourceRows.map((row) => {
    const tenants = sourceTenants.filter((tenant) => tenant.customerId === row.id)
    const projects = sourceProjects.filter((project) => project.customerId === row.id)
    return {
      id: row.id,
      name: row.name,
      tenantCount: tenants.length,
      projectCount: projects.length,
      tenants: tenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        platformTenantId: tenant.platformTenantId ?? undefined,
        isDefault: tenant.isDefault,
      })),
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
      })),
    }
  })

  const customerNameById = new Map(allIds.map((id) => [id, customerMap.get(id)?.name ?? id]))
  const candidates = [...targetTenants, ...sourceTenants].map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    fromCustomerName: customerNameById.get(tenant.customerId) ?? tenant.customerId,
  }))

  const recommendedId = resolveDefaultTenantId(targetTenants, sourceTenants, sourceRows)

  return {
    targetCustomer: {
      id: targetRow.id,
      name: targetRow.name,
      tenantCount: targetTenants.length,
      projectCount: targetProjectCount,
    },
    sourceCustomers,
    blocked: false,
    impacts: {
      tenantsToMove: sourceTenants.length,
      projectsToMove: sourceProjects.length,
      rowsByTable,
    },
    defaultTenant: {
      currentTargetDefaultId: targetTenants.find((tenant) => tenant.isDefault)?.id,
      recommendedId,
      candidates,
    },
    backfillFields,
    warnings,
  }
}

async function ensureCustomerCodeAvailable(code: string, targetCustomerId: string) {
  const existing = await db.query.customer.findFirst({
    where: and(eq(customer.customerCode, code), ne(customer.id, targetCustomerId)),
    columns: { id: true },
  })
  if (existing) {
    throw new Error(`客户编码 ${code} 已被其它客户占用，无法回填`)
  }
}

export const customerMergeDataAccess = {
  async previewMerge(input: {
    targetCustomerId: string
    sourceCustomerIds: string[]
  }): Promise<CustomerMergePreview> {
    const ctx = validateMergeInput(input.targetCustomerId, input.sourceCustomerIds)
    return buildPreview(ctx)
  },

  async mergeCustomers(input: {
    targetCustomerId: string
    sourceCustomerIds: string[]
    defaultTenantId?: string
  }): Promise<CustomerMergeResult> {
    const ctx = validateMergeInput(input.targetCustomerId, input.sourceCustomerIds)
    const preview = await buildPreview(ctx)
    if (preview.blocked) {
      throw new Error(preview.blockReason ?? '无法合并')
    }

    const customerMap = await loadCustomersByIds([ctx.targetCustomerId, ...ctx.sourceCustomerIds])
    const targetRow = customerMap.get(ctx.targetCustomerId)!
    const sourceRows = ctx.sourceCustomerIds.map((id) => customerMap.get(id)!)

    const [targetTenants, sourceTenants, sourceProjects] = await Promise.all([
      loadTenantsByCustomerIds([ctx.targetCustomerId]),
      loadTenantsByCustomerIds(ctx.sourceCustomerIds),
      loadProjectsByCustomerIds(ctx.sourceCustomerIds),
    ])

    const defaultTenantId = resolveDefaultTenantId(
      targetTenants,
      sourceTenants,
      sourceRows,
      input.defaultTenantId,
    )

    const { patch: backfillPatch, fields: backfilledFields } = computeBackfill(targetRow, sourceRows)
    if (backfillPatch.customerCode) {
      await ensureCustomerCodeAvailable(backfillPatch.customerCode, ctx.targetCustomerId)
    }

    const sourceIds = ctx.sourceCustomerIds
    const sourceTenantIds = sourceTenants.map((tenant) => tenant.id)

    try {
      await db.transaction(async (tx) => {
      if (Object.keys(backfillPatch).length > 0) {
        await tx
          .update(customer)
          .set(backfillPatch)
          .where(eq(customer.id, ctx.targetCustomerId))
      }

      // 迁移 customer_id 前必须先清除源 tenant 的 default，否则会违反
      // tenant_customer_default_uk（同一 customer_id 只能有一个 is_default=true）
      if (sourceTenantIds.length > 0) {
        await tx
          .update(billingTenant)
          .set({ isDefault: false })
          .where(inArray(billingTenant.id, sourceTenantIds))
      }

      await tx
        .update(billingTenant)
        .set({ customerId: ctx.targetCustomerId })
        .where(inArray(billingTenant.customerId, sourceIds))

      await tx
        .update(crmProject)
        .set({ customerId: ctx.targetCustomerId })
        .where(inArray(crmProject.customerId, sourceIds))

      for (const entry of CUSTOMER_ID_TABLES) {
        await tx
          .update(entry.table)
          .set({ customerId: ctx.targetCustomerId })
          .where(inArray(entry.customerId, sourceIds))
      }

      const allTenantIds = [...targetTenants, ...sourceTenants].map((tenant) => tenant.id)
      if (allTenantIds.length > 0) {
        await tx
          .update(billingTenant)
          .set({ isDefault: false })
          .where(inArray(billingTenant.id, allTenantIds))

        await tx
          .update(billingTenant)
          .set({ isDefault: true })
          .where(eq(billingTenant.id, defaultTenantId))
      }

      await tx
        .update(customer)
        .set({ status: 'inactive' })
        .where(inArray(customer.id, sourceIds))

      await tx.insert(accountActivity).values({
        id: newId(),
        customerId: ctx.targetCustomerId,
        tenantId: null,
        occurredAt: new Date(),
        refDomain: 'customer_merge',
        titleSnapshot: '客户合并',
        summarySnapshot: `合并 ${sourceRows.length} 个源客户：${sourceRows.map((row) => row.name).join('、')}`,
        payload: {
          targetCustomerId: ctx.targetCustomerId,
          sourceCustomerIds: ctx.sourceCustomerIds,
          movedTenantIds: sourceTenants.map((tenant) => tenant.id),
          movedProjectIds: sourceProjects.map((project) => project.id),
          defaultTenantId,
          backfilledFields,
        },
        idempotencyKey: `customer_merge_${ctx.targetCustomerId}_${Date.now()}`,
      })
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : '客户合并失败'
      throw new Error(`客户合并失败：${message}`)
    }

    return {
      targetCustomerId: ctx.targetCustomerId,
      archivedSourceCustomerIds: ctx.sourceCustomerIds,
      movedTenantCount: sourceTenants.length,
      movedProjectCount: sourceProjects.length,
      defaultTenantId,
      backfilledFields,
    }
  },
}
