import { db } from '@/lib/db'
import { toMoneyString } from '@/lib/finance/income-row-utils'
import type { CommissionMonthPhase } from '@/lib/crm/commission-constants'
import {
  platformCostCommissionDeriveAmPhase,
  platformCostCommissionDeriveDeptPhase,
  platformCostCommissionDeriveLine,
  platformCostCommissionDeriveProject,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import { DERIVE_RECIPIENT_ROLES } from './constants'
import { newId } from '../operation-log'

export async function materializeAmPhaseRollup(runId: string): Promise<void> {
  const projects = await db
    .select()
    .from(platformCostCommissionDeriveProject)
    .where(eq(platformCostCommissionDeriveProject.runId, runId))

  const salesLines = await db
    .select()
    .from(platformCostCommissionDeriveLine)
    .where(eq(platformCostCommissionDeriveLine.runId, runId))

  const salesByAmPhase = new Map<string, number>()
  for (const line of salesLines) {
    if (line.recipientRole !== DERIVE_RECIPIENT_ROLES.salesIndividual || !line.recipientStaffId) {
      continue
    }
    const key = `${line.recipientStaffId}:${line.monthPhase}`
    salesByAmPhase.set(key, (salesByAmPhase.get(key) ?? 0) + Number(line.commissionAmount))
  }

  const bucket = new Map<
    string,
    {
      staffId: string
      monthPhase: string
      projectCount: number
      grossSum: number
      flexSum: number
      salesSum: number
    }
  >()

  for (const p of projects) {
    if (!p.accountManagerStaffId || !p.monthPhase) continue
    const key = `${p.accountManagerStaffId}:${p.monthPhase}`
    const acc = bucket.get(key) ?? {
      staffId: p.accountManagerStaffId,
      monthPhase: p.monthPhase,
      projectCount: 0,
      grossSum: 0,
      flexSum: 0,
      salesSum: salesByAmPhase.get(key) ?? 0,
    }
    acc.projectCount += 1
    acc.grossSum += Number(p.grossProfitBase)
    acc.flexSum += Number(p.flexConsumption)
    bucket.set(key, acc)
  }

  for (const acc of bucket.values()) {
    await db.insert(platformCostCommissionDeriveAmPhase).values({
      id: newId(),
      runId,
      accountManagerStaffId: acc.staffId,
      monthPhase: acc.monthPhase,
      projectCount: acc.projectCount,
      grossProfitBaseSum: toMoneyString(acc.grossSum),
      salesCommissionSum: toMoneyString(acc.salesSum),
      flexConsumptionSum: acc.flexSum > 0 ? toMoneyString(acc.flexSum) : null,
    })
  }
}

export async function materializeDeptPhaseRollup(runId: string): Promise<void> {
  const lines = await db
    .select()
    .from(platformCostCommissionDeriveLine)
    .where(eq(platformCostCommissionDeriveLine.runId, runId))

  const bucket = new Map<
    string,
    {
      dept: string
      monthPhase: CommissionMonthPhase
      projectIds: Set<string>
      grossSum: number
      poolSum: number
    }
  >()

  for (const line of lines) {
    if (
      line.recipientRole !== DERIVE_RECIPIENT_ROLES.marketingDeptPool &&
      line.recipientRole !== DERIVE_RECIPIENT_ROLES.middleOfficeDeptPool
    ) {
      continue
    }
    const dept = line.recipientDept ?? ''
    const phase = line.monthPhase as CommissionMonthPhase
    const key = `${dept}:${phase}`
    const acc = bucket.get(key) ?? {
      dept,
      monthPhase: phase,
      projectIds: new Set<string>(),
      grossSum: 0,
      poolSum: 0,
    }
    acc.projectIds.add(line.projectId)
    acc.grossSum += Number(line.grossProfitBase)
    acc.poolSum += Number(line.commissionAmount)
    bucket.set(key, acc)
  }

  for (const acc of bucket.values()) {
    await db.insert(platformCostCommissionDeriveDeptPhase).values({
      id: newId(),
      runId,
      recipientDept: acc.dept,
      monthPhase: acc.monthPhase,
      grossProfitBaseSum: toMoneyString(acc.grossSum),
      commissionPoolSum: toMoneyString(acc.poolSum),
      projectCount: acc.projectIds.size,
    })
  }
}
