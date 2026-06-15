import { db } from '@/lib/db'
import {
  dateEndUtc,
  effectiveFromStartUtc,
  isValidDateString,
  prevDayDateString,
  toEffectiveDateString,
} from '@/lib/crm/project-effective-dates'
import type { ProjectStaffRoleType } from '@/lib/crm/project-staff-roles'
import { crmProject, projectStaffAssignment, userStaff } from '@workspace/db/schema'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

export type { ProjectStaffRoleType } from '@/lib/crm/project-staff-roles'

export type ProjectStaffAssignmentHistoryItem = {
  id: string
  staffName: string
  effectiveFrom: string
  effectiveTo: string | null
  createdAt: string
  createdByName: string | null
  isCurrent: boolean
}

const ROLE_LABELS: Record<ProjectStaffRoleType, string> = {
  pre_sales: '售前经理',
  account_manager: '客户经理',
  delivery_manager: '交付经理',
  project_manager: '项目经理',
}

export const projectStaffAssignmentDataAccess = {
  async change(input: {
    projectId: string
    roleType: ProjectStaffRoleType
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
      throw new Error(`${ROLE_LABELS[input.roleType]}不存在或已停用`)
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

  async listHistory(
    projectId: string,
    roleType: ProjectStaffRoleType,
  ): Promise<ProjectStaffAssignmentHistoryItem[]> {
    const rows = await db
      .select({
        id: projectStaffAssignment.id,
        staffName: userStaff.displayName,
        effectiveFrom: projectStaffAssignment.effectiveFrom,
        effectiveTo: projectStaffAssignment.effectiveTo,
        createdAt: projectStaffAssignment.createdAt,
        createdBy: projectStaffAssignment.createdBy,
      })
      .from(projectStaffAssignment)
      .innerJoin(userStaff, eq(projectStaffAssignment.userStaffId, userStaff.id))
      .where(
        and(
          eq(projectStaffAssignment.projectId, projectId),
          eq(projectStaffAssignment.roleType, roleType),
        ),
      )
      .orderBy(desc(projectStaffAssignment.effectiveFrom), desc(projectStaffAssignment.createdAt))

    const creatorIds = [
      ...new Set(rows.map((row) => row.createdBy).filter((id): id is string => !!id)),
    ]
    const creatorMap = new Map<string, string>()
    if (creatorIds.length > 0) {
      const creators = await db
        .select({ id: userStaff.id, displayName: userStaff.displayName })
        .from(userStaff)
        .where(inArray(userStaff.id, creatorIds))
      for (const creator of creators) {
        creatorMap.set(creator.id, creator.displayName)
      }
    }

    return rows.map((row) => ({
      id: row.id,
      staffName: row.staffName,
      effectiveFrom: toEffectiveDateString(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? toEffectiveDateString(row.effectiveTo) : null,
      createdAt: row.createdAt.toISOString(),
      createdByName: row.createdBy ? (creatorMap.get(row.createdBy) ?? null) : null,
      isCurrent: row.effectiveTo === null,
    }))
  },
}
