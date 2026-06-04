import { db } from '@/lib/db'
import type { OpportunitySource } from '@/lib/crm/commission-constants'
import { isValidDateString, prevDayDateString } from '@/lib/crm/project-effective-dates'
import { crmProject, projectOpportunitySourceAssignment } from '@workspace/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

export type OpportunitySourceAssignmentView = {
  opportunitySource: OpportunitySource | null
  effectiveFrom: string | null
}

export const projectOpportunitySourceDataAccess = {
  async getCurrent(projectId: string): Promise<OpportunitySourceAssignmentView> {
    const row = await db.query.projectOpportunitySourceAssignment.findFirst({
      where: and(
        eq(projectOpportunitySourceAssignment.projectId, projectId),
        isNull(projectOpportunitySourceAssignment.effectiveTo),
      ),
    })
    if (!row) {
      const project = await db.query.crmProject.findFirst({
        where: eq(crmProject.id, projectId),
        columns: { opportunitySource: true },
      })
      return {
        opportunitySource: (project?.opportunitySource as OpportunitySource | null) ?? null,
        effectiveFrom: null,
      }
    }
    return {
      opportunitySource: row.opportunitySource as OpportunitySource,
      effectiveFrom: row.effectiveFrom,
    }
  },

  async change(input: {
    projectId: string
    opportunitySource: OpportunitySource
    effectiveFrom: string
    remark?: string | null
    createdBy?: string | null
  }): Promise<void> {
    if (!isValidDateString(input.effectiveFrom)) {
      throw new Error('生效日期格式无效')
    }

    const project = await db.query.crmProject.findFirst({
      where: eq(crmProject.id, input.projectId),
    })
    if (!project) throw new Error('项目不存在')

    await db.transaction(async (tx) => {
      const current = await tx.query.projectOpportunitySourceAssignment.findFirst({
        where: and(
          eq(projectOpportunitySourceAssignment.projectId, input.projectId),
          isNull(projectOpportunitySourceAssignment.effectiveTo),
        ),
      })

      if (!current) {
        await tx.insert(projectOpportunitySourceAssignment).values({
          id: newId(),
          projectId: input.projectId,
          opportunitySource: input.opportunitySource,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          remark: input.remark ?? null,
          createdBy: input.createdBy ?? null,
        })
        await tx
          .update(crmProject)
          .set({ opportunitySource: input.opportunitySource })
          .where(eq(crmProject.id, input.projectId))
        return
      }

      const currentFrom = current.effectiveFrom
      if (
        current.opportunitySource === input.opportunitySource &&
        currentFrom === input.effectiveFrom
      ) {
        return
      }

      if (input.effectiveFrom > currentFrom) {
        await tx
          .update(projectOpportunitySourceAssignment)
          .set({ effectiveTo: prevDayDateString(input.effectiveFrom) })
          .where(eq(projectOpportunitySourceAssignment.id, current.id))
        await tx.insert(projectOpportunitySourceAssignment).values({
          id: newId(),
          projectId: input.projectId,
          opportunitySource: input.opportunitySource,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          remark: input.remark ?? null,
          createdBy: input.createdBy ?? null,
        })
        await tx
          .update(crmProject)
          .set({ opportunitySource: input.opportunitySource })
          .where(eq(crmProject.id, input.projectId))
        return
      }

      if (input.effectiveFrom < currentFrom) {
        await tx.insert(projectOpportunitySourceAssignment).values({
          id: newId(),
          projectId: input.projectId,
          opportunitySource: input.opportunitySource,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: prevDayDateString(currentFrom),
          remark: input.remark ?? null,
          createdBy: input.createdBy ?? null,
        })
        return
      }

      await tx
        .update(projectOpportunitySourceAssignment)
        .set({
          opportunitySource: input.opportunitySource,
          remark: input.remark ?? current.remark,
        })
        .where(eq(projectOpportunitySourceAssignment.id, current.id))
      await tx
        .update(crmProject)
        .set({ opportunitySource: input.opportunitySource })
        .where(eq(crmProject.id, input.projectId))
    })
  },
}
