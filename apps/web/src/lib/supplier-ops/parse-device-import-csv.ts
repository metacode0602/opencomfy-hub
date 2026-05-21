import type {
  DeviceChangelogParsedRow,
  DeviceInventoryParsedRow,
  FaultRecordsParsedRow,
} from "@/lib/types/supplier-domain"

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

function parseLines(text: string): string[][] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trimEnd())
  const lines = rawLines.filter((l) => normCell(l).length > 0)
  if (lines.length < 2) return []
  return lines.map(splitLine)
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

const KNOWN_OPS_STATUS = new Set([
  "预留闲置中",
  "在集群中",
  "集群组件运行中",
  "网关直连裸金属上架中",
  "网关代理裸金属上架中",
  "线下裸金属交付中",
  "其他部门使用中",
  "不可调度节点运行中",
  "网关节点上架中",
  "已退订",
])

/** 设备主数据表：supplier_device + compute_node */
export function parseDeviceInventoryCsv(text: string): ParseCsvResult<DeviceInventoryParsedRow> {
  const table = parseLines(text)
  if (table.length < 2) {
    return { ok: false, error: "文件至少需要表头一行与一行数据" }
  }
  const headers = table[0]!
  const iDeviceId = pickIndex(headers, ["设备id", "设备ID", "external_device_id"])
  const iInternalIp = pickIndex(headers, ["内网ip地址", "内网ip", "内网IP", "internal_ip"])
  const iAsset = pickIndex(headers, ["设备标识", "asset_no", "sn"])
  const iGpuType = pickIndex(headers, ["显卡型号", "gpu_card_type", "卡型"])
  const iGpuCount = pickIndex(headers, ["显卡数量", "gpu_count"])
  const iOpsStatus = pickIndex(headers, ["设备状态", "ops_status"])
  const iMaint = pickIndex(headers, ["维修中", "in_maintenance"])
  const iBw = pickIndex(headers, ["带宽组", "bandwidth_group"])
  const iRate = pickIndex(headers, ["限速", "rate_limit"])
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
    const ops_status = cell(cells, iOpsStatus)
    if (!ops_status && !cell(cells, iInternalIp) && !cell(cells, iDeviceId)) continue
    if (!ops_status) {
      return { ok: false, error: `第 ${li + 1} 行缺少设备状态` }
    }
    const in_maintenance = iMaint === -1 ? false : parseBool(cell(cells, iMaint))
    let parse_status: "ok" | "warning" | "error" = "ok"
    let parse_message: string | null = null
    if (!KNOWN_OPS_STATUS.has(ops_status)) {
      parse_status = "warning"
      parse_message = `未知设备状态「${ops_status}」，入库时将尝试映射`
    }
    const assetRaw = cell(cells, iAsset)
    rows.push({
      row_no: li + 1,
      external_device_id: cell(cells, iDeviceId) || undefined,
      internal_ip: cell(cells, iInternalIp) || undefined,
      asset_no: assetRaw || undefined,
      sn: assetRaw || undefined,
      gpu_card_type_code: cell(cells, iGpuType) || undefined,
      gpu_count: cell(cells, iGpuCount) ? Number(cell(cells, iGpuCount)) || undefined : undefined,
      ops_status,
      in_maintenance,
      bandwidth_group: cell(cells, iBw) || undefined,
      rate_limit: cell(cells, iRate) || undefined,
      device_spec: cell(cells, iSpec) || undefined,
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

/** 设备变更表：supplier_device_change_log */
export function parseDeviceChangelogCsv(text: string): ParseCsvResult<DeviceChangelogParsedRow> {
  const table = parseLines(text)
  if (table.length < 2) {
    return { ok: false, error: "文件至少需要表头一行与一行数据" }
  }
  const headers = table[0]!
  const iDeviceId = pickIndex(headers, ["设备id", "设备ID"])
  const iInternalIp = pickIndex(headers, ["内网ip", "内网IP"])
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
    const change_action = cell(cells, iAction)
    if (!occurred_at && !change_action && !cell(cells, iDeviceId)) continue
    if (!occurred_at || !change_action) {
      return { ok: false, error: `第 ${li + 1} 行缺少操作时间或变更动作` }
    }
    let parse_status: "ok" | "warning" | "error" = "ok"
    let parse_message: string | null = null
    if (!cell(cells, iDeviceId) && !cell(cells, iInternalIp)) {
      parse_status = "warning"
      parse_message = "缺少设备ID与内网IP，commit 时可能无法匹配设备"
    }
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

/** 故障记录表：fault_incident via supplier_ops_upload_batch */
export function parseFaultRecordsCsv(text: string): ParseCsvResult<FaultRecordsParsedRow> {
  const table = parseLines(text)
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
