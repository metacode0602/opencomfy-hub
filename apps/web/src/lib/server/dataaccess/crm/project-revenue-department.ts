import { db } from '@/lib/db'
import type { StaffDepartment } from '@/lib/crm/staff-constants'
import { isValidDateString, prevDayDateString } from '@/lib/crm/project-effective-dates'
import { crmProject, projectRevenueDepartmentAssignment } from '@workspace/db/schema'
import { and, eq, isNull } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

export type RevenueDepartmentAssignmentView = {
  department: StaffDepartment | null
  effectiveFrom: string | null
}

async function loadCurrentSegment(projectId: string) {
  return db.query.projectRevenueDepartmentAssignment.findFirst({
    where: and(
      eq(projectRevenueDepartmentAssignment.projectId, projectId),
      isNull(projectRevenueDepartmentAssignment.effectiveTo),
    ),
  })
}

export const projectRevenueDepartmentDataAccess = {
  async getCurrent(projectId: string): Promise<RevenueDepartmentAssignmentView> {
    const row = await loadCurrentSegment(projectId)
    if (!row) {
      const project = await db.query.crmProject.findFirst({
        where: eq(crmProject.id, projectId),
        columns: { revenueDepartment: true },
      })
      return {
        department: (project?.revenueDepartment as StaffDepartment | null) ?? null,
        effectiveFrom: null,
      }
    }
    return {
      department: row.department as StaffDepartment,
      effectiveFrom: row.effectiveFrom,
    }
  },

  async assignInitial(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    input: {
      projectId: string
      department: StaffDepartment
      effectiveFrom: string
      createdBy?: string | null
    },
  ): Promise<void> {
    await tx.insert(projectRevenueDepartmentAssignment).values({
      id: newId(),
      projectId: input.projectId,
      department: input.department,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
      createdBy: input.createdBy ?? null,
    })
    await tx
      .update(crmProject)
      .set({ revenueDepartment: input.department })
      .where(eq(crmProject.id, input.projectId))
  },

  async change(input: {
    projectId: string
    department: StaffDepartment
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
      const current = await tx.query.projectRevenueDepartmentAssignment.findFirst({
        where: and(
          eq(projectRevenueDepartmentAssignment.projectId, input.projectId),
          isNull(projectRevenueDepartmentAssignment.effectiveTo),
        ),
      })

      if (!current) {
        await tx.insert(projectRevenueDepartmentAssignment).values({
          id: newId(),
          projectId: input.projectId,
          department: input.department,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          remark: input.remark ?? null,
          createdBy: input.createdBy ?? null,
        })
        await tx
          .update(crmProject)
          .set({ revenueDepartment: input.department })
          .where(eq(crmProject.id, input.projectId))
        return
      }

      const currentFrom = current.effectiveFrom
      if (current.department === input.department && currentFrom === input.effectiveFrom) {
        return
      }

      if (input.effectiveFrom > currentFrom) {
        await tx
          .update(projectRevenueDepartmentAssignment)
          .set({ effectiveTo: prevDayDateString(input.effectiveFrom) })
          .where(eq(projectRevenueDepartmentAssignment.id, current.id))
        await tx.insert(projectRevenueDepartmentAssignment).values({
          id: newId(),
          projectId: input.projectId,
          department: input.department,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          remark: input.remark ?? null,
          createdBy: input.createdBy ?? null,
        })
        await tx
          .update(crmProject)
          .set({ revenueDepartment: input.department })
          .where(eq(crmProject.id, input.projectId))
        return
      }

      if (input.effectiveFrom < currentFrom) {
        await tx.insert(projectRevenueDepartmentAssignment).values({
          id: newId(),
          projectId: input.projectId,
          department: input.department,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: prevDayDateString(currentFrom),
          remark: input.remark ?? null,
          createdBy: input.createdBy ?? null,
        })
        return
      }

      // 同一起始日：更新当前段部门
      await tx
        .update(projectRevenueDepartmentAssignment)
        .set({
          department: input.department,
          remark: input.remark ?? current.remark,
        })
        .where(eq(projectRevenueDepartmentAssignment.id, current.id))
      await tx
        .update(crmProject)
        .set({ revenueDepartment: input.department })
        .where(eq(crmProject.id, input.projectId))
    })
  },
}

