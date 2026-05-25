import type { PlatformCostMonthly } from "@/lib/types/finance"

export type StaffCostGroup = {
  staffId: string
  accountManager: string
  sumRow: PlatformCostMonthly | null
  recordRows: PlatformCostMonthly[]
}

export function groupCostByStaff(rows: PlatformCostMonthly[]): {
  staffGroups: StaffCostGroup[]
  periodSumRow: PlatformCostMonthly | null
} {
  const periodSumRow =
    rows.find((r) => r.type === "sum" && r.staff_id == null) ?? null
  const recordAndStaffSumRows = rows.filter(
    (r) => !(r.type === "sum" && r.staff_id == null),
  )

  const map = new Map<
    string,
    { sum: PlatformCostMonthly | null; records: PlatformCostMonthly[] }
  >()

  for (const r of recordAndStaffSumRows) {
    const staffKey = r.staff_id ?? "__unknown__"
    let g = map.get(staffKey)
    if (!g) {
      g = { sum: null, records: [] }
      map.set(staffKey, g)
    }
    if (r.type === "sum") g.sum = r
    else g.records.push(r)
  }

  const staffGroups: StaffCostGroup[] = []
  for (const [staffId, g] of map) {
    if (!g.sum && g.records.length === 0) continue
    const accountManager =
      g.sum?.staff_name ??
      g.sum?.account_manager ??
      g.records[0]?.staff_name ??
      g.records[0]?.account_manager ??
      ""
    staffGroups.push({
      staffId: staffId === "__unknown__" ? "" : staffId,
      accountManager,
      sumRow: g.sum,
      recordRows: [...g.records].sort((a, b) => {
        const idc = (a.idc_code ?? "").localeCompare(b.idc_code ?? "", "zh-CN")
        if (idc !== 0) return idc
        return (a.card_type ?? "").localeCompare(b.card_type ?? "", "zh-CN")
      }),
    })
  }

  return {
    staffGroups: staffGroups.sort((a, b) =>
      a.accountManager.localeCompare(b.accountManager, "zh-CN"),
    ),
    periodSumRow,
  }
}
