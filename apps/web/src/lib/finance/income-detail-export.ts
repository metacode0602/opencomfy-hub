import { parseMoney } from "@/lib/finance/income-row-utils"
import type { PlatformIncomeMonthly } from "@/lib/types/finance"
import XLSX from "xlsx-js-style"

const BASE_HEADERS = [
  "项目名称",
  "客户全称",
  "租户Id",
  "补充消费",
  "余额消费",
  "线上裸金属消费",
  "总消费",
  "总收入",
] as const

const TOTAL_INCOME_COL = BASE_HEADERS.indexOf("总收入")

const HEADER_STYLE = {
  font: { bold: true },
  fill: { patternType: "solid" as const, fgColor: { rgb: "E8EEF4" } },
}

const TOTAL_INCOME_FILL = {
  patternType: "solid" as const,
  fgColor: { rgb: "FFFFFF00" },
}

function formatText(value: string | null | undefined): string {
  if (value == null || value === "") return ""
  return value
}

function formatMoneyCell(value: string | null | undefined): number | "" {
  if (value == null || value === "") return ""
  const n = parseMoney(value)
  return n
}

function buildRowCells(row: PlatformIncomeMonthly): (string | number)[] {
  return [
    formatText(row.project_name),
    formatText(row.customer_full_name),
    row.tenant_platform_id,
    formatMoneyCell(row.supplementary_consumption),
    formatMoneyCell(row.balance_consumption),
    formatMoneyCell(row.bare_metal_consumption),
    formatMoneyCell(row.total_consumption),
    formatMoneyCell(row.total_consumption),
  ]
}

function applySheetStyles(
  ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>,
  rowCount: number,
  colCount: number,
  totalIncomeCol: number,
) {
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) continue

      if (c === totalIncomeCol) {
        ws[addr].s = {
          ...(r === 0 ? { font: { bold: true } } : {}),
          fill: TOTAL_INCOME_FILL,
        }
        continue
      }

      if (r === 0) {
        ws[addr].s = HEADER_STYLE
      }
    }
  }
}

export function downloadIncomeDetailExcel(params: {
  rows: PlatformIncomeMonthly[]
  periodCode: string
  showPeriodColumn?: boolean
}): boolean {
  const { rows, periodCode, showPeriodColumn = false } = params
  if (rows.length === 0) return false

  const headers = showPeriodColumn
    ? (["账期", ...BASE_HEADERS] as string[])
    : [...BASE_HEADERS]

  const wsData: (string | number)[][] = [
    headers,
    ...rows.map((row) => {
      const cells = buildRowCells(row)
      return showPeriodColumn
        ? [row.billing_period_id, ...cells]
        : cells
    }),
  ]

  const totalIncomeCol = TOTAL_INCOME_COL + (showPeriodColumn ? 1 : 0)

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  applySheetStyles(ws, wsData.length, headers.length, totalIncomeCol)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "收入明细")
  XLSX.writeFile(wb, `收入明细-${periodCode}.xlsx`)
  return true
}
