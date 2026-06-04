import { db } from '@/lib/db'
import type { CommissionMonthPhase } from '@/lib/crm/commission-constants'
import {
  computeCommissionMonthPhase,
  currentShanghaiMonth,
  shouldLockCommissionPhase,
  type CommissionPhaseSnapshot,
} from '@/lib/crm/commission-phase'
import { crmProject } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

export const projectCommissionPhaseDataAccess = {
  async resolve(projectId: string, asOfMonth?: string): Promise<CommissionPhaseSnapshot> {
    const project = await db.query.crmProject.findFirst({
      where: eq(crmProject.id, projectId),
      columns: {
        dealClosedMonth: true,
        commissionMonthPhase: true,
        commissionPhaseLockedAt: true,
      },
    })

    if (!project) {
      throw new Error('项目不存在')
    }

    const month = asOfMonth ?? currentShanghaiMonth()
    const lockedPhase = project.commissionMonthPhase as CommissionMonthPhase | null
    const isLocked = lockedPhase === 'months_7_to_2026_12'

    const computed = computeCommissionMonthPhase(
      project.dealClosedMonth,
      month,
      lockedPhase,
    )

    if (
      shouldLockCommissionPhase(project.dealClosedMonth, month, lockedPhase)
    ) {
      await db
        .update(crmProject)
        .set({
          commissionMonthPhase: 'months_7_to_2026_12',
          commissionPhaseLockedAt: new Date(),
        })
        .where(eq(crmProject.id, projectId))
    }

    return {
      dealClosedMonth: project.dealClosedMonth,
      asOfMonth: month,
      monthsSinceDeal: computed.monthsSinceDeal,
      monthPhase: computed.monthPhase,
      monthPhaseLabel: computed.monthPhaseLabel,
      isLocked: isLocked || computed.monthPhase === 'months_7_to_2026_12',
    }
  },
}
