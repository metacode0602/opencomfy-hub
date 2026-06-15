import { db } from '@/lib/db'
import type { ConversionReason } from '@/lib/crm/commission-constants'
import {
  dateEndUtc,
  effectiveFromStartUtc,
  isValidDateString,
} from '@/lib/crm/project-effective-dates'
import {
  billingTenant,
  crmProject,
  projectActivity,
  projectConversionSetting,
  projectTenant,
  recharge,
} from '@workspace/db/schema'
import { CONVERSION_REASON_LABELS } from '@/lib/crm/commission-constants'
import { and, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm'

const SIGNING_CONVERSION_REASONS = new Set<ConversionReason>([
  'offline_signing',
  'online_signing',
])

async function getBillingTenantIdsForProject(projectId: string): Promise<string[]> {
  const project = await db.query.crmProject.findFirst({ where: eq(crmProject.id, projectId) })
  if (!project) return []

  const ids = new Set<string>()
  if (project.primaryTenantId) ids.add(project.primaryTenantId)

  const links = await db
    .select({ tenantId: projectTenant.tenantId })
    .from(projectTenant)
    .where(eq(projectTenant.projectId, projectId))
  for (const link of links) ids.add(link.tenantId)

  if (ids.size === 0) {
    const defaults = await db
      .select({ id: billingTenant.id })
      .from(billingTenant)
      .where(and(eq(billingTenant.customerId, project.customerId), eq(billingTenant.isDefault, true)))
    for (const row of defaults) ids.add(row.id)
  }
  return [...ids]
}

function newId() {
  return crypto.randomUUID()
}

export type ProjectConversionSettingView = {
  reason: ConversionReason
  signedOn: string
  conversionDate: string
  remark: string | null
} | null

export const projectConversionSettingDataAccess = {
  async hasRechargeOnDate(projectId: string, dateStr: string): Promise<boolean> {
    if (!isValidDateString(dateStr)) return false
    const tenantIds = await getBillingTenantIdsForProject(projectId)
    if (tenantIds.length === 0) return false

    const start = effectiveFromStartUtc(dateStr)
    const end = dateEndUtc(dateStr)
    const rows = await db
      .select({ id: recharge.id })
      .from(recharge)
      .where(
        and(
          inArray(recharge.tenantId, tenantIds),
          eq(recharge.status, 'paid'),
          isNotNull(recharge.completedAt),
          gte(recharge.completedAt, start),
          lt(recharge.completedAt, new Date(end.getTime() + 1)),
        ),
      )
      .limit(1)
    return rows.length > 0
  },

  async getByProjectIds(projectIds: string[]): Promise<
    Map<
      string,
      {
        reason: ConversionReason
        signedOn: string
        conversionDate: string
        remark: string | null
      }
    >
  > {
    if (projectIds.length === 0) return new Map()
    const rows = await db
      .select()
      .from(projectConversionSetting)
      .where(inArray(projectConversionSetting.projectId, projectIds))
    return new Map(
      rows.map((row) => [
        row.projectId,
        {
          reason: row.reason as ConversionReason,
          signedOn: row.signedOn,
          conversionDate: row.conversionDate,
          remark: row.remark,
        },
      ]),
    )
  },

  async getByProjectId(projectId: string): Promise<ProjectConversionSettingView> {
    const row = await db.query.projectConversionSetting.findFirst({
      where: eq(projectConversionSetting.projectId, projectId),
    })
    if (!row) return null
    return {
      reason: row.reason as ConversionReason,
      signedOn: row.signedOn,
      conversionDate: row.conversionDate,
      remark: row.remark,
    }
  },

  async set(input: {
    projectId: string
    reason: ConversionReason
    signedOn: string
    conversionDate: string
    remark?: string | null
    createdBy?: string | null
  }): Promise<void> {
    if (!isValidDateString(input.signedOn)) {
      throw new Error('签约日期格式无效')
    }
    if (!isValidDateString(input.conversionDate)) {
      throw new Error('转正日期格式无效')
    }

    if (input.reason === 'online_registration_only') {
      if (!input.remark?.trim()) {
        throw new Error('仅线上注册须填写备注')
      }
    } else if (SIGNING_CONVERSION_REASONS.has(input.reason)) {
      const hasRecharge = await this.hasRechargeOnDate(input.projectId, input.conversionDate)
      if (!hasRecharge) {
        throw new Error('指定转正日期当天无已完成充值记录，无法保存')
      }
    }

    const project = await db.query.crmProject.findFirst({
      where: eq(crmProject.id, input.projectId),
    })
    if (!project) throw new Error('项目不存在')

    const reasonLabel = CONVERSION_REASON_LABELS[input.reason]

    await db.transaction(async (tx) => {
      const existing = await tx.query.projectConversionSetting.findFirst({
        where: eq(projectConversionSetting.projectId, input.projectId),
      })

      if (existing) {
        await tx
          .update(projectConversionSetting)
          .set({
            reason: input.reason,
            signedOn: input.signedOn,
            conversionDate: input.conversionDate,
            remark: input.remark ?? null,
            updatedAt: new Date(),
          })
          .where(eq(projectConversionSetting.id, existing.id))
      } else {
        await tx.insert(projectConversionSetting).values({
          id: newId(),
          projectId: input.projectId,
          reason: input.reason,
          signedOn: input.signedOn,
          conversionDate: input.conversionDate,
          remark: input.remark ?? null,
          createdBy: input.createdBy ?? null,
        })
      }

      await tx.update(crmProject).set({ stage: 'converted' }).where(eq(crmProject.id, input.projectId))

      await tx.insert(projectActivity).values({
        id: newId(),
        projectId: input.projectId,
        type: 'stage_change',
        title: '项目转正',
        description: `${reasonLabel}；签约 ${input.signedOn}；转正 ${input.conversionDate}${input.remark ? `；${input.remark}` : ''}`,
        authorStaffId: input.createdBy ?? null,
        metadata: {
          reason: input.reason,
          signedOn: input.signedOn,
          conversionDate: input.conversionDate,
          remark: input.remark ?? null,
        },
      })
    })
  },
}
