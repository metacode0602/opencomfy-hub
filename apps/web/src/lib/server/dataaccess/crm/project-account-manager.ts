import { db } from '@/lib/db'
import {
  dateEndUtc,
  effectiveFromStartUtc,
  isValidDateString,
  prevDayDateString,
  toEffectiveDateString,
  todayShanghaiDateString,
} from '@/lib/crm/project-effective-dates'
import { crmProject, projectStaffAssignment, userStaff } from '@workspace/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

const ACCOUNT_MANAGER_ROLE = 'account_manager'

export type AccountManagerAssignmentView = {
  staffId: string | null
  staffName: string | null
  effectiveFrom: string | null
}

async function loadCurrentAssignment(projectId: string) {
  return db.query.projectStaffAssignment.findFirst({
    where: and(
      eq(projectStaffAssignment.projectId, projectId),
      eq(projectStaffAssignment.roleType, ACCOUNT_MANAGER_ROLE),
      isNull(projectStaffAssignment.effectiveTo),
    ),
  })
}

export const projectAccountManagerDataAccess = {
  async getCurrent(projectId: string): Promise<AccountManagerAssignmentView> {
    const row = await loadCurrentAssignment(projectId)
    if (!row) {
      return { staffId: null, staffName: null, effectiveFrom: null }
    }
    const staff = await db.query.userStaff.findFirst({
      where: eq(userStaff.id, row.userStaffId),
      columns: { displayName: true },
    })
    return {
      staffId: row.userStaffId,
      staffName: staff?.displayName ?? null,
      effectiveFrom: toEffectiveDateString(row.effectiveFrom),
    }
  },

  async change(input: {
    projectId: string
    staffId: string
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

    const staff = await db.query.userStaff.findFirst({
      where: eq(userStaff.id, input.staffId),
    })
    if (!staff || staff.status !== 'active') {
      throw new Error('客户经理不存在或已停用')
    }

    const effectiveFromTs = effectiveFromStartUtc(input.effectiveFrom)

    await db.transaction(async (tx) => {
      const current = await tx.query.projectStaffAssignment.findFirst({
        where: and(
          eq(projectStaffAssignment.projectId, input.projectId),
          eq(projectStaffAssignment.roleType, ACCOUNT_MANAGER_ROLE),
          isNull(projectStaffAssignment.effectiveTo),
        ),
      })

      if (!current) {
        await tx.insert(projectStaffAssignment).values({
          id: newId(),
          projectId: input.projectId,
          userStaffId: input.staffId,
          roleType: ACCOUNT_MANAGER_ROLE,
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
          roleType: ACCOUNT_MANAGER_ROLE,
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
          roleType: ACCOUNT_MANAGER_ROLE,
          effectiveFrom: effectiveFromTs,
          effectiveTo: dateEndUtc(prevDayDateString(currentFromDate)),
          createdBy: input.createdBy ?? null,
        })
        return
      }

      // 同一起始日换人
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

export { todayShanghaiDateString as defaultAccountManagerEffectiveDate }
