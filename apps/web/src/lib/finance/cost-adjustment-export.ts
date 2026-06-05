import {
  computeAdjustmentAmountFromHistoryEntry,
} from "@/lib/finance/cost-row-utils"
import { parseMoney } from "@/lib/finance/income-row-utils"
import type {
  PlatformCostMonthly,
  VoucherCardHoursAdjustmentHistoryEntry,
} from "@/lib/types/finance"
import XLSX from "xlsx-js-style"

export type CostAdjustmentFlatRow = {
  costRow: PlatformCostMonthly
  history: VoucherCardHoursAdjustmentHistoryEntry
}

const HEADERS = [
  "时间",
  "客户经理",
  "机房代码",
  "卡型",
  "调账值",
  "余额卡时（原）",
  "余额卡时（新）",
  "调账金额",
  "售出成本（原）",
  "售出成本（新）",
  "毛利（原）",
  "毛利（新）",
  "调账原因",
] as const

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFFFF" } },
  fill: { patternType: "solid" as const, fgColor: { rgb: "FF4472C4" } },
}

export function collectCostAdjustmentRows(
  rows: PlatformCostMonthly[],
  adjustmentHistories: Record<string, VoucherCardHoursAdjustmentHistoryEntry[]>,
): CostAdjustmentFlatRow[] {
  const result: CostAdjustmentFlatRow[] = []
  for (const row of rows) {
    if (row.type !== "record") continue
    for (const history of adjustmentHistories[row.id] ?? []) {
      result.push({ costRow: row, history })
    }
  }
  return result.sort((a, b) =>
    a.history.created_at.localeCompare(b.history.created_at),
  )
}

function formatHoursCell(value: string | null | undefined): number | "" {
  if (value == null || value === "") return ""
  const n = Number(value)
  return Number.isNaN(n) ? "" : n
}

function formatAdjustmentHours(value: string): number | "" {
  const n = Number(value)
  return Number.isNaN(n) ? "" : n
}

function buildExportRow(entry: CostAdjustmentFlatRow): (string | number)[] {
  const { costRow, history } = entry
  const adjAmount = computeAdjustmentAmountFromHistoryEntry(history)
  return [
    history.created_at.slice(0, 19).replace("T", " "),
    costRow.account_manager ?? "",
    costRow.idc_code ?? "",
    costRow.card_type ?? "",
    formatAdjustmentHours(history.adjustment_hours),
    formatHoursCell(history.balance_card_hours_before),
    formatHoursCell(history.balance_card_hours_after),
    adjAmount,
    parseMoney(history.sold_duration_cost_excl_tax_before),
    parseMoney(history.sold_duration_cost_excl_tax_after),
    parseMoney(history.gross_profit_before),
    parseMoney(history.gross_profit_after),
    history.reason,
  ]
}

export function downloadCostAdjustmentExcel(params: {
  rows: PlatformCostMonthly[]
  adjustmentHistories: Record<string, VoucherCardHoursAdjustmentHistoryEntry[]>
  periodCode: string
}): boolean {
  const flatRows = collectCostAdjustmentRows(
    params.rows,
    params.adjustmentHistories,
  )
  if (flatRows.length === 0) return false

  const wsData: (string | number)[][] = [
    [...HEADERS],
    ...flatRows.map(buildExportRow),
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  for (let c = 0; c < HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = HEADER_STYLE
  }

  ws["!cols"] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 32 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "余额卡时调账记录")
  XLSX.writeFile(wb, `余额卡时调账记录-${params.periodCode}.xlsx`)
  return true
}
