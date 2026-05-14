import type { SupplierOpsInventoryRow } from "@/lib/types/supplier-ops-batch"

export type ParseInventoryResult =
  | { ok: true; rows: SupplierOpsInventoryRow[] }
  | { ok: false; error: string }

function normCell(s: string): string {
  return s.replace(/^\ufeff/, "").trim()
}

function normHeader(s: string): string {
  return normCell(s).replace(/\s+/g, "").toLowerCase()
}

function splitLine(line: string): string[] {
  const t = line.includes("\t")
  if (t) return line.split("\t").map(normCell)
  const out: string[] = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQ = !inQ
      continue
    }
    if (!inQ && ch === ",") {
      out.push(normCell(cur))
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(normCell(cur))
  return out
}

const PUBLIC = new Set([
  "公网ip",
  "外网ip",
  "publicip",
  "public_ip",
  "eip",
  "公网",
])
const PRIVATE = new Set(["内网ip", "privateip", "private_ip", "内网", "internalip"])
const ROOT = new Set(["root账号", "root用户", "root", "用户名", "账号", "account", "user"])
const PWD = new Set(["密码", "password", "passwd", "pwd"])

function pickIndex(headers: string[], set: Set<string>): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i] ?? "")
    if (set.has(h)) return i
  }
  return -1
}

/** 解析 UTF-8 CSV/TSV；首行为表头，需包含公网/内网 IP、root 账号与密码列（支持中英文列名）。 */
export function parseInventoryCsv(text: string): ParseInventoryResult {
  const rawLines = text.split(/\r?\n/).map((l) => l.trimEnd())
  const lines = rawLines.filter((l) => normCell(l).length > 0)
  if (lines.length < 2) {
    return { ok: false, error: "文件至少需要表头一行与一行数据" }
  }
  const headers = splitLine(lines[0]!)
  const iPub = pickIndex(headers, PUBLIC)
  const iPrv = pickIndex(headers, PRIVATE)
  const iRoot = pickIndex(headers, ROOT)
  const iPwd = pickIndex(headers, PWD)
  if (iPub === -1 || iPrv === -1 || iRoot === -1 || iPwd === -1) {
    return {
      ok: false,
      error:
        "未识别到必需列，请包含：公网ip（或外网ip）、内网ip、root账号（或 root）、密码（或 password）",
    }
  }
  const rows: SupplierOpsInventoryRow[] = []
  for (let li = 1; li < lines.length; li++) {
    const cells = splitLine(lines[li]!)
    const public_ip = normCell(cells[iPub] ?? "")
    const private_ip = normCell(cells[iPrv] ?? "")
    const root_account = normCell(cells[iRoot] ?? "")
    const root_password = normCell(cells[iPwd] ?? "")
    if (!public_ip && !private_ip && !root_account && !root_password) continue
    if (!public_ip || !private_ip || !root_account || !root_password) {
      return { ok: false, error: `第 ${li + 1} 行存在空字段，请补全四列` }
    }
    rows.push({ public_ip, private_ip, root_account, root_password })
  }
  if (rows.length === 0) return { ok: false, error: "没有有效的数据行" }
  return { ok: true, rows }
}
