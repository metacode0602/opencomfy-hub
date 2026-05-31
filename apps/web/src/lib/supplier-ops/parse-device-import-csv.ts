import type {
  DeviceChangelogParsedRow,
  DeviceInventoryParsedRow,
  FaultRecordsParsedRow,
} from "@/lib/types/supplier-domain"
import {
  mapDeviceCooperationType,
  normalizeDeviceChangeAction,
  normalizeDeviceOpsStatus,
  validateDeviceChangelogRowFields,
} from "@/lib/supplier/device-import-utils"
import { DEVICE_OPS_STATUS_SEEDS } from "@workspace/db/schema"

export type ParseCsvResult<T> = { ok: true; rows: T[] } | { ok: false; error: string }

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

/** CSV/TSV 文本 → 行列表 */
export function parseCsvTextToTable(text: string): string[][] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trimEnd())
  const lines = rawLines.filter((l) => normCell(l).length > 0)
  return lines.map(splitLine)
}

/** Excel 矩阵 → 行列表（与 CSV 解析共用后续逻辑） */
export function importMatrixToTable(matrix: unknown[][]): string[][] {
  const rows = matrix.map((row) =>
    (Array.isArray(row) ? row : []).map((v) => {
      if (v == null) return ""
      if (v instanceof Date) {
        return normCell(
          v.toLocaleString("zh-CN", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }),
        )
      }
      return normCell(String(v))
    }),
  )
  return rows.filter((row) => row.some((c) => c.length > 0))
}

function pickIndex(headers: string[], aliases: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i] ?? "")
    if (aliases.some((a) => normHeader(a) === h)) return i
  }
  return -1
}

function cell(row: string[], idx: number): string {
  return idx === -1 ? "" : normCell(row[idx] ?? "")
}

function parseBool(v: string): boolean {
  const s = normCell(v).toLowerCase()
  return s === "是" || s === "true" || s === "1" || s === "yes" || s === "y"
}

const KNOWN_OPS_STATUS = new Set(DEVICE_OPS_STATUS_SEEDS.map((s) => s.stateCode))

/** 设备主数据表：supplier_device + compute_node */
export function parseDeviceInventoryTable(
  table: string[][],
): ParseCsvResult<DeviceInventoryParsedRow> {
  if (table.length < 2) {
    return { ok: false, error: "文件至少需要表头一行与一行数据" }
  }
  const headers = table[0]!
  const iDeviceId = pickIndex(headers, ["设备id", "设备ID", "external_device_id"])
  const iInternalIp = pickIndex(headers, [
    "ip地址",
    "IP地址",
    "内网ip地址",
    "内网ip",
    "内网IP",
    "internal_ip",
  ])
  const iAsset = pickIndex(headers, ["设备标识", "asset_no", "sn"])
  const iGpuType = pickIndex(headers, ["显卡型号", "gpu_card_type", "卡型"])
  const iGpuCount = pickIndex(headers, ["显卡数量", "gpu_count"])
  const iOpsStatus = pickIndex(headers, ["设备状态", "ops_status"])
  const iMaint = pickIndex(headers, ["维修中", "in_maintenance"])
  const iBw = pickIndex(headers, ["带宽组", "bandwidth_group"])
  const iRate = pickIndex(headers, ["限速", "rate_limit"])
  const iCoop = pickIndex(headers, ["合作类型", "cooperation_type"])
  const iPurpose = pickIndex(headers, ["设备用途", "device_purpose"])
  const iSpec = pickIndex(headers, ["设备配置", "device_spec"])
  const iReceived = pickIndex(headers, ["设备接收时间", "received_at"])
  const iRemark = pickIndex(headers, ["备注", "remark"])
  const iLoginUser = pickIndex(headers, ["登录用户名", "root_account", "login_username"])
  const iLoginPwd = pickIndex(headers, ["登录密码", "root_password", "login_password"])
  const iCluster = pickIndex(headers, ["k8s集群", "集群", "cluster_name"])
  const iNodeName = pickIndex(headers, ["集群中节点名称", "node_name"])
  const iNodeRole = pickIndex(headers, ["集群角色", "node_role"])
  const iExpected = pickIndex(headers, ["预期集群提供服务", "expected_service"])

  if (iOpsStatus === -1) {
    return { ok: false, error: "未识别到必需列「设备状态」" }
  }

  const rows: DeviceInventoryParsedRow[] = []
  for (let li = 1; li < table.length; li++) {
    const cells = table[li]!
    const rawOpsStatus = cell(cells, iOpsStatus)
    const ops_status = normalizeDeviceOpsStatus(rawOpsStatus)
    if (!ops_status && !cell(cells, iInternalIp) && !cell(cells, iDeviceId)) continue
    if (!ops_status) {
      return { ok: false, error: `第 ${li + 1} 行缺少设备状态` }
    }
    const in_maintenance = iMaint === -1 ? false : parseBool(cell(cells, iMaint))
    let parse_status: "ok" | "warning" | "error" = "ok"
    let parse_message: string | null = null
    if (rawOpsStatus !== ops_status) {
      parse_status = "warning"
      parse_message = `设备状态「${rawOpsStatus}」已归一化为「${ops_status}」`
    }
    if (!KNOWN_OPS_STATUS.has(ops_status)) {
      parse_status = "warning"
      parse_message = parse_message
        ? `${parse_message}；未知设备状态，入库时将尝试映射`
        : `未知设备状态「${ops_status}」，入库时将尝试映射`
    }
    const coopRaw = cell(cells, iCoop)
    const cooperation = mapDeviceCooperationType(coopRaw || undefined)
    if (cooperation.warning) {
      if (parse_status === "ok") parse_status = "warning"
      parse_message = parse_message
        ? `${parse_message}；${cooperation.warning}`
        : cooperation.warning
    }
    const assetRaw = cell(cells, iAsset)
    rows.push({
      row_no: li + 1,
      external_device_id: cell(cells, iDeviceId) || undefined,
      internal_ip: cell(cells, iInternalIp) || undefined,
      asset_no: assetRaw || undefined,
      sn: undefined,
      gpu_card_type_code: cell(cells, iGpuType) || undefined,
      gpu_count: cell(cells, iGpuCount) ? Number(cell(cells, iGpuCount)) || undefined : undefined,
      ops_status,
      in_maintenance,
      bandwidth_group: cell(cells, iBw) || undefined,
      rate_limit: cell(cells, iRate) || undefined,
      cooperation_type: cooperation.type,
      device_spec: cell(cells, iSpec) || undefined,
      device_purpose: cell(cells, iPurpose) || undefined,
      received_at: cell(cells, iReceived) || undefined,
      remark: cell(cells, iRemark) || undefined,
      login_username: cell(cells, iLoginUser) || undefined,
      login_password: cell(cells, iLoginPwd) || undefined,
      cluster_name: cell(cells, iCluster) || undefined,
      node_name: cell(cells, iNodeName) || undefined,
      node_role: cell(cells, iNodeRole) || undefined,
      expected_service: cell(cells, iExpected) || undefined,
      parse_status,
      parse_message,
    })
  }
  if (rows.length === 0) return { ok: false, error: "没有有效的数据行" }
  return { ok: true, rows }
}

export function parseDeviceInventoryCsv(text: string): ParseCsvResult<DeviceInventoryParsedRow> {
  return parseDeviceInventoryTable(parseCsvTextToTable(text))
}

/** 设备变更表：supplier_device_change_log */
export function parseDeviceChangelogTable(
  table: string[][],
): ParseCsvResult<DeviceChangelogParsedRow> {
  if (table.length < 2) {
    return { ok: false, error: "文件至少需要表头一行与一行数据" }
  }
  const headers = table[0]!
  const iDeviceId = pickIndex(headers, ["设备id", "设备ID"])
  const iInternalIp = pickIndex(headers, ["内网ip", "内网IP", "ip地址", "IP地址"])
  const iOccurred = pickIndex(headers, ["操作时间", "occurred_at"])
  const iAction = pickIndex(headers, ["变更动作", "change_action"])
  const iContent = pickIndex(headers, ["变更内容", "change_content"])
  const iDesc = pickIndex(headers, ["详细说明", "description"])
  const iTicket = pickIndex(headers, ["工单", "ticket_no"])

  if (iOccurred === -1 || iAction === -1) {
    return { ok: false, error: "未识别到必需列：操作时间、变更动作" }
  }

  const rows: DeviceChangelogParsedRow[] = []
  for (let li = 1; li < table.length; li++) {
    const cells = table[li]!
    const occurred_at = cell(cells, iOccurred)
    const rawChangeAction = cell(cells, iAction)
    const change_action = normalizeDeviceChangeAction(rawChangeAction)
    if (!occurred_at && !change_action && !cell(cells, iDeviceId)) continue
    if (!occurred_at || !change_action) {
      return { ok: false, error: `第 ${li + 1} 行缺少操作时间或变更动作` }
    }
    const { parse_status, parse_message } = validateDeviceChangelogRowFields({
      change_action,
      raw_change_action: rawChangeAction,
      external_device_id: cell(cells, iDeviceId) || undefined,
      internal_ip: cell(cells, iInternalIp) || undefined,
    })
    rows.push({
      row_no: li + 1,
      external_device_id: cell(cells, iDeviceId) || undefined,
      internal_ip: cell(cells, iInternalIp) || undefined,
      occurred_at,
      change_action,
      change_content: cell(cells, iContent) || undefined,
      description: cell(cells, iDesc) || undefined,
      ticket_no: cell(cells, iTicket) || undefined,
      parse_status,
      parse_message,
    })
  }
  if (rows.length === 0) return { ok: false, error: "没有有效的数据行" }
  return { ok: true, rows }
}

export function parseDeviceChangelogCsv(text: string): ParseCsvResult<DeviceChangelogParsedRow> {
  return parseDeviceChangelogTable(parseCsvTextToTable(text))
}

/** 故障记录表：fault_incident via supplier_ops_upload_batch */
export function parseDeviceFaultRecordsTable(
  table: string[][],
): ParseCsvResult<FaultRecordsParsedRow> {
  if (table.length < 2) {
    return { ok: false, error: "文件至少需要表头一行与一行数据" }
  }
  const headers = table[0]!
  const iOpened = pickIndex(headers, ["记录时间", "opened_at"])
  const iClosed = pickIndex(headers, ["解决时间", "closed_at"])
  const iType = pickIndex(headers, ["故障类型", "fault_type"])
  const iImpactMin = pickIndex(headers, ["影响时长(分钟)", "影响时长", "impact_minutes"])
  const iScope = pickIndex(headers, ["影响范围", "impact_scope"])
  const iCount = pickIndex(headers, ["影响台数", "affected_device_count"])
  const iPost = pickIndex(headers, ["故障复盘", "postmortem"])

  if (iOpened === -1 || iType === -1) {
    return { ok: false, error: "未识别到必需列：记录时间、故障类型" }
  }

  const rows: FaultRecordsParsedRow[] = []
  for (let li = 1; li < table.length; li++) {
    const cells = table[li]!
    const opened_at = cell(cells, iOpened)
    const fault_type = cell(cells, iType)
    if (!opened_at && !fault_type) continue
    if (!opened_at || !fault_type) {
      return { ok: false, error: `第 ${li + 1} 行缺少记录时间或故障类型` }
    }
    const impactRaw = cell(cells, iImpactMin)
    const countRaw = cell(cells, iCount)
    rows.push({
      row_no: li + 1,
      opened_at,
      closed_at: cell(cells, iClosed) || undefined,
      fault_type,
      impact_minutes: impactRaw ? Number(impactRaw) || undefined : undefined,
      impact_scope: cell(cells, iScope) || undefined,
      affected_device_count: countRaw ? Number(countRaw) || undefined : undefined,
      postmortem: cell(cells, iPost) || undefined,
      parse_status: "ok",
      parse_message: null,
    })
  }
  if (rows.length === 0) return { ok: false, error: "没有有效的数据行" }
  return { ok: true, rows }
}

/** @deprecated 使用 parseDeviceFaultRecordsTable */
export function parseFaultRecordsCsv(text: string): ParseCsvResult<FaultRecordsParsedRow> {
  return parseDeviceFaultRecordsTable(parseCsvTextToTable(text))
}
