import { db } from '@/lib/db'
import type { UserStaff } from '@/lib/types/crm'
import { mapUserStaffRow } from '@/lib/server/mappers/crm'
import { ensureCrmSeeded } from './ensure-seeded'
import { accountManagerAssignment, customer, userStaff } from '@workspace/db/schema'
import { and, count, desc, eq, ilike, inArray, isNull, ne, or } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

export type StaffUpsertInput = {
  displayName: string
  mobile: string
  email?: string | null
  employeeNo?: string | null
  status: string
  department?: string | null
  position?: string | null
  roles?: string[]
  isDefaultPreSales?: boolean
  isDefaultAccountManager?: boolean
  isDefaultDeliveryManager?: boolean
  isDefaultProjectManager?: boolean
}

type StaffListFilters = {
  search?: string
  status?: string
  department?: string
  position?: string
}

function staffValuesFromInput(input: StaffUpsertInput) {
  return {
    displayName: input.displayName.trim(),
    mobile: input.mobile.trim(),
    email: input.email?.trim() || null,
    employeeNo: input.employeeNo?.trim() || null,
    status: input.status,
    department: input.department ?? null,
    position: input.position?.trim() || null,
    roles: input.roles ?? [],
    isDefaultPreSales: input.isDefaultPreSales ?? false,
    isDefaultAccountManager: input.isDefaultAccountManager ?? false,
    isDefaultDeliveryManager: input.isDefaultDeliveryManager ?? false,
    isDefaultProjectManager: input.isDefaultProjectManager ?? false,
  }
}

async function clearExclusiveDefaultFlags(
  input: StaffUpsertInput,
  excludeId?: string,
): Promise<void> {
  const clears: Promise<unknown>[] = []

  if (input.isDefaultPreSales) {
    clears.push(
      db
        .update(userStaff)
        .set({ isDefaultPreSales: false })
        .where(
          excludeId
            ? and(eq(userStaff.isDefaultPreSales, true), ne(userStaff.id, excludeId))
            : eq(userStaff.isDefaultPreSales, true),
        ),
    )
  }
  if (input.isDefaultAccountManager) {
    clears.push(
      db
        .update(userStaff)
        .set({ isDefaultAccountManager: false })
        .where(
          excludeId
            ? and(eq(userStaff.isDefaultAccountManager, true), ne(userStaff.id, excludeId))
            : eq(userStaff.isDefaultAccountManager, true),
        ),
    )
  }
  if (input.isDefaultDeliveryManager) {
    clears.push(
      db
        .update(userStaff)
        .set({ isDefaultDeliveryManager: false })
        .where(
          excludeId
            ? and(eq(userStaff.isDefaultDeliveryManager, true), ne(userStaff.id, excludeId))
            : eq(userStaff.isDefaultDeliveryManager, true),
        ),
    )
  }
  if (input.isDefaultProjectManager) {
    clears.push(
      db
        .update(userStaff)
        .set({ isDefaultProjectManager: false })
        .where(
          excludeId
            ? and(eq(userStaff.isDefaultProjectManager, true), ne(userStaff.id, excludeId))
            : eq(userStaff.isDefaultProjectManager, true),
        ),
    )
  }

  await Promise.all(clears)
}

export const staffDataAccess = {
  async list(filters: StaffListFilters = {}): Promise<
    (UserStaff & { assignmentCount: number })[]
  > {
    await ensureCrmSeeded()

    const conditions = []
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(userStaff.status, filters.status))
    }
    if (filters.department && filters.department !== 'all') {
      conditions.push(eq(userStaff.department, filters.department))
    }
    if (filters.position?.trim()) {
      conditions.push(ilike(userStaff.position, `%${filters.position.trim()}%`))
    }
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`
      conditions.push(
        or(
          ilike(userStaff.displayName, q),
          ilike(userStaff.mobile, q),
          ilike(userStaff.email, q),
          ilike(userStaff.employeeNo, q),
          ilike(userStaff.position, q),
        )!,
      )
    }

    const rows = await db
      .select()
      .from(userStaff)
      .where(conditions.length ? and(...conditions) : undefined)

    const assignmentCounts = await db
      .select({ userStaffId: accountManagerAssignment.userStaffId, value: count() })
      .from(accountManagerAssignment)
      .where(isNull(accountManagerAssignment.effectiveTo))
      .groupBy(accountManagerAssignment.userStaffId)

    const countMap = new Map(assignmentCounts.map((r) => [r.userStaffId, Number(r.value)]))

    return rows.map((row) => ({
      ...mapUserStaffRow(row),
      assignmentCount: countMap.get(row.id) ?? 0,
    }))
  },

  async listActive(): Promise<UserStaff[]> {
    await ensureCrmSeeded()
    const rows = await db.select().from(userStaff).where(eq(userStaff.status, 'active'))
    return rows.map(mapUserStaffRow)
  },

  async getById(id: string): Promise<(UserStaff & { assignmentCount: number }) | null> {
    await ensureCrmSeeded()
    const row = await db.query.userStaff.findFirst({ where: eq(userStaff.id, id) })
    if (!row) return null

    const [countRow] = await db
      .select({ value: count() })
      .from(accountManagerAssignment)
      .where(
        and(eq(accountManagerAssignment.userStaffId, id), isNull(accountManagerAssignment.effectiveTo)),
      )

    return { ...mapUserStaffRow(row), assignmentCount: Number(countRow?.value ?? 0) }
  },

  async create(input: StaffUpsertInput): Promise<UserStaff> {
    await clearExclusiveDefaultFlags(input)

    const id = newId()
    const values = staffValuesFromInput(input)
    await db.insert(userStaff).values({ id, ...values })
    const row = await db.query.userStaff.findFirst({ where: eq(userStaff.id, id) })
    if (!row) throw new Error('创建员工失败')
    return mapUserStaffRow(row)
  },

  async update(id: string, input: StaffUpsertInput): Promise<UserStaff> {
    await clearExclusiveDefaultFlags(input, id)

    await db
      .update(userStaff)
      .set(staffValuesFromInput(input))
      .where(eq(userStaff.id, id))

    const row = await db.query.userStaff.findFirst({ where: eq(userStaff.id, id) })
    if (!row) throw new Error('员工不存在')
    return mapUserStaffRow(row)
  },

  async listAssignments(staffId: string) {
    await ensureCrmSeeded()
    const rows = await db
      .select()
      .from(accountManagerAssignment)
      .where(eq(accountManagerAssignment.userStaffId, staffId))
      .orderBy(desc(accountManagerAssignment.effectiveFrom))

    const customerIds = [...new Set(rows.map((r) => r.customerId))]
    const customers =
      customerIds.length > 0
        ? await db.select().from(customer).where(inArray(customer.id, customerIds))
        : []
    const customerMap = new Map(
      customers.map((c) => [c.id, c.accountName || c.name]),
    )

    return rows.map((r) => ({
      id: r.id,
      customer_id: r.customerId,
      user_staff_id: r.userStaffId,
      role_type: r.roleType,
      effective_from: r.effectiveFrom.toISOString(),
      effective_to: r.effectiveTo?.toISOString() ?? null,
      created_at: r.createdAt.toISOString(),
      customer_name: customerMap.get(r.customerId) ?? '',
    }))
  },

  async delete(id: string): Promise<void> {
    await db
      .update(accountManagerAssignment)
      .set({ effectiveTo: new Date() })
      .where(
        and(eq(accountManagerAssignment.userStaffId, id), isNull(accountManagerAssignment.effectiveTo)),
      )
    await db.delete(userStaff).where(eq(userStaff.id, id))
  },
}
