import {
  COMMISSION_MONTH_PHASE_LABELS,
  COMMISSION_POLICY_END_MONTH,
  type CommissionMonthPhase,
} from '@/lib/crm/commission-constants'

/** YYYY-MM 自然月差（asOf - anchor，结果 ≥ 0） */
export function monthDiff(asOfMonth: string, anchorMonth: string): number {
  const [ay, am] = anchorMonth.split('-').map(Number)
  const [by, bm] = asOfMonth.split('-').map(Number)
  return (by! - ay!) * 12 + (bm! - am!)
}

export function dateToMonth(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function currentShanghaiMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}`
}

export type CommissionPhaseSnapshot = {
  dealClosedMonth: string | null
  asOfMonth: string
  monthsSinceDeal: number | null
  monthPhase: CommissionMonthPhase | null
  monthPhaseLabel: string | null
  isLocked: boolean
}

export function computeCommissionMonthPhase(
  dealClosedMonth: string | null | undefined,
  asOfMonth: string,
  lockedPhase: CommissionMonthPhase | null | undefined,
): Pick<CommissionPhaseSnapshot, 'monthsSinceDeal' | 'monthPhase' | 'monthPhaseLabel'> {
  if (lockedPhase === 'months_7_to_2026_12') {
    return {
      monthsSinceDeal: dealClosedMonth ? monthDiff(asOfMonth, dealClosedMonth) + 1 : null,
      monthPhase: lockedPhase,
      monthPhaseLabel: COMMISSION_MONTH_PHASE_LABELS[lockedPhase],
    }
  }

  if (!dealClosedMonth) {
    return { monthsSinceDeal: null, monthPhase: null, monthPhaseLabel: null }
  }

  const monthsSinceDeal = monthDiff(asOfMonth, dealClosedMonth) + 1

  if (asOfMonth > COMMISSION_POLICY_END_MONTH) {
    return { monthsSinceDeal, monthPhase: null, monthPhaseLabel: null }
  }

  if (monthsSinceDeal <= 6) {
    const phase: CommissionMonthPhase = 'months_1_6'
    return {
      monthsSinceDeal,
      monthPhase: phase,
      monthPhaseLabel: COMMISSION_MONTH_PHASE_LABELS[phase],
    }
  }

  const phase: CommissionMonthPhase = 'months_7_to_2026_12'
  return {
    monthsSinceDeal,
    monthPhase: phase,
    monthPhaseLabel: COMMISSION_MONTH_PHASE_LABELS[phase],
  }
}

export function shouldLockCommissionPhase(
  dealClosedMonth: string | null | undefined,
  asOfMonth: string,
  lockedPhase: CommissionMonthPhase | null | undefined,
): boolean {
  if (lockedPhase === 'months_7_to_2026_12') return false
  if (!dealClosedMonth) return false
  const { monthPhase } = computeCommissionMonthPhase(dealClosedMonth, asOfMonth, lockedPhase)
  return monthPhase === 'months_7_to_2026_12'
}
