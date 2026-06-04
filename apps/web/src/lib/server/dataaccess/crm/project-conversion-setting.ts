import { db } from '@/lib/db'
import type { ConversionReason } from '@/lib/crm/commission-constants'
import { isValidDateString } from '@/lib/crm/project-effective-dates'
import {
  crmProject,
  projectActivity,
  projectConversionSetting,
} from '@workspace/db/schema'
import { CONVERSION_REASON_LABELS } from '@/lib/crm/commission-constants'
import { eq } from 'drizzle-orm'

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
