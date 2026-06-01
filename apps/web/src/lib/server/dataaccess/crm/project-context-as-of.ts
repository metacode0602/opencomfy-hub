import type { StaffDepartment } from '@/lib/crm/staff-constants'
import { db } from '@/lib/db'
import { projectRevenueDepartmentAssignment } from '@workspace/db/schema'
import { and, desc, eq, isNull, lte, or, sql } from 'drizzle-orm'

/** 按账期末（自然日）解析项目收入归属部门 — 供下期财务 pipeline 使用 */
export async function resolveRevenueDepartmentAsOf(
  projectId: string,
  asOfDate: string,
): Promise<StaffDepartment | null> {
  const [row] = await db
    .select({ department: projectRevenueDepartmentAssignment.department })
    .from(projectRevenueDepartmentAssignment)
    .where(
      and(
        eq(projectRevenueDepartmentAssignment.projectId, projectId),
        lte(projectRevenueDepartmentAssignment.effectiveFrom, asOfDate),
        or(
          isNull(projectRevenueDepartmentAssignment.effectiveTo),
          sql`${projectRevenueDepartmentAssignment.effectiveTo} > ${asOfDate}`,
        ),
      ),
    )
    .orderBy(desc(projectRevenueDepartmentAssignment.effectiveFrom))
    .limit(1)
  return (row?.department as StaffDepartment | undefined) ?? null
}
