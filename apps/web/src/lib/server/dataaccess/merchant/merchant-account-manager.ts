import { db } from '@/lib/db'
import {
  dateEndUtc,
  effectiveFromStartUtc,
  isValidDateString,
  prevDayDateString,
  toEffectiveDateString,
  todayShanghaiDateString,
} from '@/lib/crm/project-effective-dates'
import { merchant, merchantAccountManagerAssignment, userStaff } from '@workspace/db/schema'
import { and, asc, eq, isNull } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

const ACCOUNT_MANAGER_ROLE = 'account_manager'

export type MerchantAccountManagerAssignmentView = {
  staffId: string | null
  staffName: string | null
  effectiveFrom: string | null
}

async function loadCurrentAssignment(merchantId: string) {
  return db.query.merchantAccountManagerAssignment.findFirst({
    where: and(
      eq(merchantAccountManagerAssignment.merchantId, merchantId),
      eq(merchantAccountManagerAssignment.roleType, ACCOUNT_MANAGER_ROLE),
      isNull(merchantAccountManagerAssignment.effectiveTo),
    ),
  })
}

export const merchantAccountManagerDataAccess = {
  async getCurrent(merchantId: string): Promise<MerchantAccountManagerAssignmentView> {
    const row = await loadCurrentAssignment(merchantId)
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

  async listAccountManagerFilterOptions(): Promise<{ id: string; displayName: string }[]> {
    const rows = await db
      .selectDistinct({
        id: userStaff.id,
        displayName: userStaff.displayName,
      })
      .from(merchantAccountManagerAssignment)
      .innerJoin(userStaff, eq(merchantAccountManagerAssignment.userStaffId, userStaff.id))
      .where(
        and(
          eq(merchantAccountManagerAssignment.roleType, ACCOUNT_MANAGER_ROLE),
          isNull(merchantAccountManagerAssignment.effectiveTo),
        ),
      )
      .orderBy(asc(userStaff.displayName))

    return rows
  },

  async change(input: {
    merchantId: string
    staffId: string
    effectiveFrom: string
    remark?: string | null
    createdByStaffId?: string | null
  }): Promise<void> {
    if (!isValidDateString(input.effectiveFrom)) {
      throw new Error('生效日期格式无效')
    }

    const merchantRow = await db.query.merchant.findFirst({
      where: eq(merchant.id, input.merchantId),
    })
    if (!merchantRow) throw new Error('商户不存在')

    const staff = await db.query.userStaff.findFirst({
      where: eq(userStaff.id, input.staffId),
    })
    if (!staff || staff.status !== 'active') {
      throw new Error('客户经理不存在或已停用')
    }

    const effectiveFromTs = effectiveFromStartUtc(input.effectiveFrom)

    await db.transaction(async (tx) => {
      const current = await tx.query.merchantAccountManagerAssignment.findFirst({
        where: and(
          eq(merchantAccountManagerAssignment.merchantId, input.merchantId),
          eq(merchantAccountManagerAssignment.roleType, ACCOUNT_MANAGER_ROLE),
          isNull(merchantAccountManagerAssignment.effectiveTo),
        ),
      })

      if (!current) {
        await tx.insert(merchantAccountManagerAssignment).values({
          id: newId(),
          merchantId: input.merchantId,
          userStaffId: input.staffId,
          roleType: ACCOUNT_MANAGER_ROLE,
          effectiveFrom: effectiveFromTs,
          effectiveTo: null,
          remark: input.remark ?? null,
          createdByStaffId: input.createdByStaffId ?? null,
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
          .update(merchantAccountManagerAssignment)
          .set({ effectiveTo: dateEndUtc(prevDayDateString(input.effectiveFrom)) })
          .where(eq(merchantAccountManagerAssignment.id, current.id))
        await tx.insert(merchantAccountManagerAssignment).values({
          id: newId(),
          merchantId: input.merchantId,
          userStaffId: input.staffId,
          roleType: ACCOUNT_MANAGER_ROLE,
          effectiveFrom: effectiveFromTs,
          effectiveTo: null,
          remark: input.remark ?? null,
          createdByStaffId: input.createdByStaffId ?? null,
        })
        return
      }

      if (input.effectiveFrom < currentFromDate) {
        await tx.insert(merchantAccountManagerAssignment).values({
          id: newId(),
          merchantId: input.merchantId,
          userStaffId: input.staffId,
          roleType: ACCOUNT_MANAGER_ROLE,
          effectiveFrom: effectiveFromTs,
          effectiveTo: dateEndUtc(prevDayDateString(currentFromDate)),
          remark: input.remark ?? null,
          createdByStaffId: input.createdByStaffId ?? null,
        })
        return
      }

      await tx
        .update(merchantAccountManagerAssignment)
        .set({
          userStaffId: input.staffId,
          remark: input.remark ?? current.remark,
          createdByStaffId: input.createdByStaffId ?? current.createdByStaffId,
        })
        .where(eq(merchantAccountManagerAssignment.id, current.id))
    })
  },
}

export { todayShanghaiDateString as defaultMerchantAccountManagerEffectiveDate }
