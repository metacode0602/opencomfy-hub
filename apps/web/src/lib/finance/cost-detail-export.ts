import { parseMoney } from "@/lib/finance/income-row-utils"
import { groupCostByStaff } from "@/lib/finance/cost-group-utils"
import type { PlatformCostMonthly } from "@/lib/types/finance"
import XLSX from "xlsx-js-style"

const METRIC_HEADERS = [
  "求和项:余额消费",
  "求和项:余额卡时",
  "求和项:券卡时",
  "确认收入(不含税)",
  "售出时长成本(不含税)",
  "赠送时长成本(不含税)",
  "毛利",
] as const

const COL_COUNT = 2 + METRIC_HEADERS.length
const GROSS_PROFIT_COL = COL_COUNT - 1

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFFFF" } },
  fill: { patternType: "solid" as const, fgColor: { rgb: "FF4472C4" } },
}

const GROSS_PROFIT_FILL = {
  patternType: "solid" as const,
  fgColor: { rgb: "FFFFFF00" },
}

function formatText(value: string | null | undefined): string {
  if (value == null || value === "") return ""
  return value
}

function formatMoneyCell(value: string | null | undefined): number | "" {
  if (value == null || value === "") return ""
  return parseMoney(value)
}

function metricCells(row: PlatformCostMonthly): (number | "")[] {
  return [
    formatMoneyCell(row.balance_consumption),
    formatMoneyCell(row.balance_card_hours),
    formatMoneyCell(row.voucher_card_hours),
    formatMoneyCell(row.confirmed_revenue_excl_tax),
    formatMoneyCell(row.sold_duration_cost_excl_tax),
    formatMoneyCell(row.gifted_duration_cost_excl_tax),
    formatMoneyCell(row.gross_profit),
  ]
}

function emptyRow(): (string | number)[] {
  return Array.from({ length: COL_COUNT }, () => "")
}

type SheetRowMeta =
  | { kind: "header" }
  | { kind: "summary" }
  | { kind: "detail" }
  | { kind: "blank" }

function buildSheetRows(input: {
  periodCode: string
  groups: ReturnType<typeof groupCostByStaff>["staffGroups"]
}): { wsData: (string | number)[][]; rowMeta: SheetRowMeta[] } {
  const wsData: (string | number)[][] = []
  const rowMeta: SheetRowMeta[] = []

  input.groups.forEach((group, index) => {
    if (index > 0) {
      wsData.push(emptyRow())
      rowMeta.push({ kind: "blank" })
    }

    wsData.push([input.periodCode, "", ...METRIC_HEADERS])
    rowMeta.push({ kind: "header" })

    const summaryRow = group.sumRow
    wsData.push([
      group.accountManager,
      "",
      ...(summaryRow ? metricCells(summaryRow) : emptyMetricCells(group.recordRows)),
    ])
    rowMeta.push({ kind: "summary" })

    for (const record of group.recordRows) {
      wsData.push([
        formatText(record.idc_code),
        formatText(record.card_type),
        ...metricCells(record),
      ])
      rowMeta.push({ kind: "detail" })
    }
  })

  return { wsData, rowMeta }
}

function emptyMetricCells(records: PlatformCostMonthly[]): (number | "")[] {
  if (records.length === 0) {
    return METRIC_HEADERS.map(() => "")
  }
  const totals = records.reduce(
    (acc, row) => {
      acc.balance_consumption += parseMoney(row.balance_consumption)
      acc.balance_card_hours += parseMoney(row.balance_card_hours)
      acc.voucher_card_hours += parseMoney(row.voucher_card_hours)
      acc.confirmed_revenue_excl_tax += parseMoney(row.confirmed_revenue_excl_tax)
      acc.sold_duration_cost_excl_tax += parseMoney(
        row.sold_duration_cost_excl_tax,
      )
      acc.gifted_duration_cost_excl_tax += parseMoney(
        row.gifted_duration_cost_excl_tax,
      )
      acc.gross_profit += parseMoney(row.gross_profit)
      return acc
    },
    {
      balance_consumption: 0,
      balance_card_hours: 0,
      voucher_card_hours: 0,
      confirmed_revenue_excl_tax: 0,
      sold_duration_cost_excl_tax: 0,
      gifted_duration_cost_excl_tax: 0,
      gross_profit: 0,
    },
  )
  return [
    totals.balance_consumption,
    totals.balance_card_hours,
    totals.voucher_card_hours,
    totals.confirmed_revenue_excl_tax,
    totals.sold_duration_cost_excl_tax,
    totals.gifted_duration_cost_excl_tax,
    totals.gross_profit,
  ]
}

function applySheetStyles(
  ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>,
  rowMeta: SheetRowMeta[],
) {
  for (let r = 0; r < rowMeta.length; r++) {
    const meta = rowMeta[r]!
    for (let c = 0; c < COL_COUNT; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) {
        ws[addr] = { t: "s", v: "" }
      }

      if (meta.kind === "header") {
        ws[addr].s = HEADER_STYLE
        continue
      }

      if (meta.kind === "summary" && c === GROSS_PROFIT_COL) {
        ws[addr].s = { fill: GROSS_PROFIT_FILL }
      }
    }
  }
}

export function downloadCostDetailExcel(params: {
  rows: PlatformCostMonthly[]
  periodCode: string
}): boolean {
  const recordRows = params.rows.filter((r) => r.type === "record")
  if (recordRows.length === 0) return false

  const { staffGroups } = groupCostByStaff(params.rows)
  if (staffGroups.length === 0) return false

  const { wsData, rowMeta } = buildSheetRows({
    periodCode: params.periodCode,
    groups: staffGroups,
  })

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  applySheetStyles(ws, rowMeta)

  ws["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    ...METRIC_HEADERS.map(() => ({ wch: 18 })),
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "成本毛利明细")
  XLSX.writeFile(wb, `成本毛利明细-${params.periodCode}.xlsx`)
  return true
}
