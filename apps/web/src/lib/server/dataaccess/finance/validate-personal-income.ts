import { db } from '@/lib/db'
import {
  billingPeriod,
  billingPeriodRawBaremetalOrder,
  billingPeriodRawTenantBill,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import { FinanceError } from './errors'
import {
  listExcludedProjectTenants,
  listProjectLinkedPlatformTenantIds,
} from './personal-income-tenants'
import { getPersonalImportBatches } from './purge-personal'

export type ValidatePersonalIncomeResult = {
  periodStatus: string
  tenantBillReady: boolean
  baremetalReady: boolean
  canCompute: boolean
  tenantsInExcel: number
  tenantsExcludedProject: number
  tenantsPersonal: number
  excludedProjectTenants: Array<{
    platform_tenant_id: string
    project_names: string[]
  }>
  messages: string[]
}

export async function validatePersonalIncome(
  billingPeriodId: string,
): Promise<ValidatePersonalIncomeResult> {
  const period = await db.query.billingPeriod.findFirst({
    where: eq(billingPeriod.id, billingPeriodId),
  })
  if (!period) throw new FinanceError('NOT_FOUND', '账期不存在')

  const batches = await getPersonalImportBatches(billingPeriodId)
  const tenantBillReady = batches.tenantBill?.parseStatus === 'ok'
  const baremetalReady = batches.baremetal?.parseStatus === 'ok'
  const messages: string[] = []

  if (!batches.tenantBill) {
    messages.push('未上传个人账单详情 Excel')
  } else if (!tenantBillReady) {
    messages.push('个人账单详情解析未通过，请修正后重新上传')
  }
  if (!batches.baremetal) {
    messages.push('未上传个人裸金属订单 Excel')
  } else if (!baremetalReady) {
    messages.push('个人裸金属订单解析未通过，请修正后重新上传')
  }

  let tenantsInExcel = 0
  let tenantsPersonal = 0
  let tenantsExcludedProject = 0
  let excluded: ValidatePersonalIncomeResult['excludedProjectTenants'] = []

  if (tenantBillReady && baremetalReady) {
    const billRows = await db
      .select({ tenantPlatformId: billingPeriodRawTenantBill.tenantPlatformId })
      .from(billingPeriodRawTenantBill)
      .where(eq(billingPeriodRawTenantBill.batchId, batches.tenantBill!.id))
    const bareRows = await db
      .select({ tenantPlatformId: billingPeriodRawBaremetalOrder.tenantPlatformId })
      .from(billingPeriodRawBaremetalOrder)
      .where(eq(billingPeriodRawBaremetalOrder.batchId, batches.baremetal!.id))

    const tExcel = new Set([
      ...billRows.map((r) => r.tenantPlatformId),
      ...bareRows.map((r) => r.tenantPlatformId),
    ])
    tenantsInExcel = tExcel.size

    const projectLinked = await listProjectLinkedPlatformTenantIds([...tExcel])
    const excludedRaw = await listExcludedProjectTenants(
      [...tExcel].filter((id) => projectLinked.has(id)),
    )
    excluded = excludedRaw.map((e) => ({
      platform_tenant_id: e.platformTenantId,
      project_names: e.projectNames,
    }))
    tenantsPersonal = [...tExcel].filter((id) => !projectLinked.has(id)).length
    tenantsExcludedProject = projectLinked.size

    if (tenantsPersonal === 0) {
      messages.push('排除项目关联租户后无有效个人收入租户')
    }
  }

  const canCompute =
    tenantBillReady &&
    baremetalReady &&
    tenantsPersonal > 0 &&
    period.status !== 'void' &&
    period.status !== 'published'

  if (period.status === 'published') {
    messages.push('已发布账期须先撤回发布')
  }

  return {
    periodStatus: period.status,
    tenantBillReady,
    baremetalReady,
    canCompute,
    tenantsInExcel,
    tenantsExcludedProject,
    tenantsPersonal,
    excludedProjectTenants: excluded,
    messages,
  }
}

export function mapPersonalBatchDto(
  batch: {
    id: string
    fileType: string
    fileName: string
    parseStatus: string
    parseErrorCount: number
    rowCount: number
    errorReportPath: string | null
    uploadedAt: Date
  } | undefined,
) {
  if (!batch) return null
  return {
    id: batch.id,
    file_type: batch.fileType,
    file_name: batch.fileName,
    parse_status: batch.parseStatus,
    parse_error_count: batch.parseErrorCount,
    row_count: batch.rowCount,
    has_error_report: Boolean(batch.errorReportPath),
    uploaded_at: batch.uploadedAt.toISOString(),
  }
}
