import { db } from '@/lib/db'
import type { OpportunitySource } from '@/lib/crm/commission-constants'
import { OPPORTUNITY_SOURCE_VALUES } from '@/lib/crm/commission-constants'
import { dateEndUtc, effectiveFromStartUtc } from '@/lib/crm/project-effective-dates'
import {
  crmProject,
  projectOpportunitySourceAssignment,
  projectRevenueDepartmentAssignment,
  projectStaffAssignment,
  userStaff,
} from '@workspace/db/schema'
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm'

function monthStartDate(month: string): string {
  return `${month}-01`
}

function monthEndDate(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y!, m!, 0).getDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

export async function resolveOpportunitySourceAtMonth(
  projectId: string,
  settlementMonth: string,
): Promise<OpportunitySource | null> {
  const monthStart = monthStartDate(settlementMonth)
  const monthEnd = monthEndDate(settlementMonth)

  const rows = await db
    .select()
    .from(projectOpportunitySourceAssignment)
    .where(
      and(
        eq(projectOpportunitySourceAssignment.projectId, projectId),
        lte(projectOpportunitySourceAssignment.effectiveFrom, monthEnd),
        or(
          isNull(projectOpportunitySourceAssignment.effectiveTo),
          gte(projectOpportunitySourceAssignment.effectiveTo, monthStart),
        ),
      ),
    )
    .orderBy(desc(projectOpportunitySourceAssignment.effectiveFrom))
    .limit(1)

  const source = rows[0]?.opportunitySource ?? null
  if (source && OPPORTUNITY_SOURCE_VALUES.includes(source as OpportunitySource)) {
    return source as OpportunitySource
  }

  const project = await db.query.crmProject.findFirst({
    where: eq(crmProject.id, projectId),
    columns: { opportunitySource: true },
  })
  const fallback = project?.opportunitySource
  if (fallback && OPPORTUNITY_SOURCE_VALUES.includes(fallback as OpportunitySource)) {
    return fallback as OpportunitySource
  }
  return null
}

export async function resolveEffectiveAccountManager(
  projectId: string,
  settlementMonth: string,
): Promise<string | null> {
  const monthStart = monthStartDate(settlementMonth)
  const monthEnd = monthEndDate(settlementMonth)
  const rangeStart = effectiveFromStartUtc(monthStart)
  const rangeEnd = dateEndUtc(monthEnd)

  const row = await db
    .select({ userStaffId: projectStaffAssignment.userStaffId })
    .from(projectStaffAssignment)
    .where(
      and(
        eq(projectStaffAssignment.projectId, projectId),
        eq(projectStaffAssignment.roleType, 'account_manager'),
        lte(projectStaffAssignment.effectiveFrom, rangeEnd),
        or(
          isNull(projectStaffAssignment.effectiveTo),
          gte(projectStaffAssignment.effectiveTo, rangeStart),
        ),
      ),
    )
    .orderBy(desc(projectStaffAssignment.effectiveFrom))
    .limit(1)

  return row[0]?.userStaffId ?? null
}

export async function resolveRevenueDepartmentAtMonth(
  projectId: string,
  settlementMonth: string,
): Promise<string | null> {
  const monthStart = monthStartDate(settlementMonth)
  const monthEnd = monthEndDate(settlementMonth)

  const rows = await db
    .select({ department: projectRevenueDepartmentAssignment.department })
    .from(projectRevenueDepartmentAssignment)
    .where(
      and(
        eq(projectRevenueDepartmentAssignment.projectId, projectId),
        lte(projectRevenueDepartmentAssignment.effectiveFrom, monthEnd),
        or(
          isNull(projectRevenueDepartmentAssignment.effectiveTo),
          gte(projectRevenueDepartmentAssignment.effectiveTo, monthStart),
        ),
      ),
    )
    .orderBy(desc(projectRevenueDepartmentAssignment.effectiveFrom))
    .limit(1)

  if (rows[0]?.department) return rows[0].department

  const project = await db.query.crmProject.findFirst({
    where: eq(crmProject.id, projectId),
    columns: { revenueDepartment: true },
  })
  return project?.revenueDepartment ?? null
}

export async function loadStaffPosition(staffId: string): Promise<string | null> {
  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { position: true },
  })
  return staff?.position ?? null
}
