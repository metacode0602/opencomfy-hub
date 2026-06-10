import { db } from '@/lib/db'
import {
  dateEndUtc,
  effectiveFromStartUtc,
  isValidDateString,
  prevDayDateString,
  toEffectiveDateString,
} from '@/lib/crm/project-effective-dates'
import { crmProject, projectStaffAssignment, userStaff } from '@workspace/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

export const projectStaffAssignmentDataAccess = {
  async change(input: {
    projectId: string
    roleType: string
    staffId: string
    effectiveFrom: string
    createdBy?: string | null
  }): Promise<void> {
    if (!isValidDateString(input.effectiveFrom)) {
      throw new Error('生效日期格式无效')
    }

    const project = await db.query.crmProject.findFirst({
      where: eq(crmProject.id, input.projectId),
    })
    if (!project) throw new Error('项目不存在')

    const staff = await db.query.userStaff.findFirst({
      where: eq(userStaff.id, input.staffId),
    })
    if (!staff || staff.status !== 'active') {
      throw new Error('员工不存在或已停用')
    }

    const effectiveFromTs = effectiveFromStartUtc(input.effectiveFrom)

    await db.transaction(async (tx) => {
      const current = await tx.query.projectStaffAssignment.findFirst({
        where: and(
          eq(projectStaffAssignment.projectId, input.projectId),
          eq(projectStaffAssignment.roleType, input.roleType),
          isNull(projectStaffAssignment.effectiveTo),
        ),
      })

      if (!current) {
        await tx.insert(projectStaffAssignment).values({
          id: newId(),
          projectId: input.projectId,
          userStaffId: input.staffId,
          roleType: input.roleType,
          effectiveFrom: effectiveFromTs,
          effectiveTo: null,
          createdBy: input.createdBy ?? null,
        })
        return
      }

      if (current.userStaffId === input.staffId) {
        const currentFromDate = toEffectiveDateString(current.effectiveFrom)
        if (currentFromDate === input.effectiveFrom) return
      }

      const currentFromDate = toEffectiveDateString(current.effectiveFrom)

      if (input.effectiveFrom > currentFromDate) {
        await tx
          .update(projectStaffAssignment)
          .set({ effectiveTo: dateEndUtc(prevDayDateString(input.effectiveFrom)) })
          .where(eq(projectStaffAssignment.id, current.id))
        await tx.insert(projectStaffAssignment).values({
          id: newId(),
          projectId: input.projectId,
          userStaffId: input.staffId,
          roleType: input.roleType,
          effectiveFrom: effectiveFromTs,
          effectiveTo: null,
          createdBy: input.createdBy ?? null,
        })
        return
      }

      if (input.effectiveFrom < currentFromDate) {
        await tx.insert(projectStaffAssignment).values({
          id: newId(),
          projectId: input.projectId,
          userStaffId: input.staffId,
          roleType: input.roleType,
          effectiveFrom: effectiveFromTs,
          effectiveTo: dateEndUtc(prevDayDateString(currentFromDate)),
          createdBy: input.createdBy ?? null,
        })
        return
      }

      await tx
        .update(projectStaffAssignment)
        .set({
          userStaffId: input.staffId,
          createdBy: input.createdBy ?? current.createdBy,
        })
        .where(eq(projectStaffAssignment.id, current.id))
    })
  },
}
