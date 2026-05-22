import type {
  ComputeNode,
  DeviceChangelogParsedRow,
  DeviceCooperationType,
  DeviceInventoryParsedRow,
  FaultIncident,
  FaultRecordsParsedRow,
  OnboardingBatch,
  OnboardingBatchKind,
  SupplierDevice,
  SupplierDeviceChangeLog,
  SupplierOpsUploadBatch,
} from "@/lib/types/supplier-domain"
import { maskPassword } from "@/lib/supplier/onboarding-batch-utils"

/** Excel 设备状态 → CRM lifecycle_status（§2.1） */
export const OPS_STATUS_TO_LIFECYCLE: Record<string, string> = {
  预留闲置中: "待接入",
  在集群中: "在线",
  集群组件运行中: "在线",
  网关直连裸金属上架中: "接入中",
  网关代理裸金属上架中: "接入中",
  线下裸金属交付中: "接入中",
  其他部门使用中: "维护中",
  不可调度节点运行中: "在线",
  网关节点上架中: "接入中",
  已退订: "退订",
}

export const BATCH_KIND_LABELS: Record<OnboardingBatchKind, string> = {
  online: "设备上架",
  order_access: "订单接入",
  device_inventory: "设备主数据",
  device_changelog: "设备变更",
  device_retire: "设备下架",
}

export const DEVICE_IMPORT_ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt'
export const DEVICE_IMPORT_MAX_BYTES = 10 * 1024 * 1024

export function isDeviceImportFileName(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.tsv') ||
    lower.endsWith('.txt')
  )
}

export const FAULT_IMPORT_STATUS_LABELS: Record<string, string> = {
  uploaded: "已上传",
  parsed: "待确认入库",
  committed: "已入库",
  parse_failed: "解析失败",
}

export function resolveLifecycleStatus(opsStatus: string, inMaintenance: boolean): string {
  if (inMaintenance) return "维护中"
  return OPS_STATUS_TO_LIFECYCLE[opsStatus] ?? "待接入"
}

export function mapDeviceCooperationType(raw: string | undefined): {
  type: DeviceCooperationType
  warning?: string
} {
  const s = raw?.trim()
  if (!s) return { type: "idle_time" }
  const normalized = s.replace(/\s+/g, "")
  if (normalized.includes("整租")) return { type: "whole_rent" }
  if (normalized.includes("闲时")) return { type: "idle_time" }
  return { type: "idle_time", warning: `无法识别合作类型「${raw}」，默认闲时合作` }
}

export function generateImportBatchCode(batchKind: OnboardingBatchKind): string {
  const prefix =
    batchKind === "device_inventory"
      ? "DINV"
      : batchKind === "device_changelog"
        ? "DCHG"
        : batchKind === "device_retire"
          ? "RET"
          : batchKind === "online"
            ? "ONB"
            : "ORD"
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}-${y}${m}-${seq}`
}

export function maskInventoryRowsForPreview(
  rows: DeviceInventoryParsedRow[],
): DeviceInventoryParsedRow[] {
  return rows.map((r) => ({
    ...r,
    login_password: r.login_password ? maskPassword(r.login_password) : r.login_password,
  }))
}

export function findDeviceByImportKeys(
  devices: SupplierDevice[],
  row: {
    external_device_id?: string | null
    internal_ip?: string
    sn?: string
    asset_no?: string
  },
): SupplierDevice | undefined {
  if (row.sn?.trim()) {
    const hit = devices.find((d) => d.sn === row.sn?.trim())
    if (hit) return hit
  }
  if (row.asset_no?.trim()) {
    const hit = devices.find((d) => d.asset_no === row.asset_no?.trim())
    if (hit) return hit
  }
  if (row.external_device_id) {
    const hit = devices.find((d) => d.external_device_id === row.external_device_id)
    if (hit) return hit
  }
  if (row.internal_ip) {
    return devices.find((d) => d.internal_ip === row.internal_ip)
  }
  return undefined
}

export function buildDevicesFromInventoryImport(params: {
  batchId: string
  supplierId: string
  contractId: string | null
  dataCenterId: string
  idcCode: string
  idcRegion: string
  cardTypeDefault: string
  rows: DeviceInventoryParsedRow[]
  createId: (prefix: string) => string
}): { devices: SupplierDevice[]; nodes: ComputeNode[] } {
  const {
    batchId,
    supplierId,
    contractId,
    dataCenterId,
    idcCode,
    idcRegion,
    cardTypeDefault,
    rows,
    createId,
  } = params
  const okRows = rows.filter((r) => r.parse_status !== "error")
  const devices: SupplierDevice[] = []
  const nodes: ComputeNode[] = []

  okRows.forEach((row, idx) => {
    const inMaint = row.in_maintenance ?? false
    const lifecycle = resolveLifecycleStatus(row.ops_status, inMaint)
    const cooperationType = row.cooperation_type ?? "idle_time"
    const sn = row.sn?.trim() || row.asset_no?.trim() || `SN-${idcCode}-${String(idx + 1).padStart(4, "0")}`
    const asset = row.asset_no?.trim() || `AST-${idcCode}-${String(idx + 1).padStart(5, "0")}`
    const deviceId = createId("dev")
    devices.push({
      id: deviceId,
      supplier_id: supplierId,
      contract_id: contractId,
      onboarding_batch_id: batchId,
      data_center_id: dataCenterId,
      asset_no: asset,
      sn,
      lifecycle_status: lifecycle,
      onboarding_substage: lifecycle === "在线" ? "已完成" : "待施工",
      idc_region: idcRegion,
      idc_code: idcCode,
      gpu_count: String(row.gpu_count ?? 8),
      card_type: row.gpu_card_type_code ?? cardTypeDefault,
      external_ip: "",
      internal_ip: row.internal_ip ?? "",
      platform_resource_id: null,
      external_device_id: row.external_device_id ?? null,
      ops_status: row.ops_status,
      in_maintenance: inMaint,
      bandwidth_group: row.bandwidth_group ?? null,
      rate_limit: row.rate_limit ?? null,
      cooperation_type: cooperationType,
      device_spec: row.device_spec ?? null,
      device_purpose: row.device_purpose ?? null,
      received_at: row.received_at ?? null,
      remark: row.remark ?? null,
      login_username: row.login_username ?? null,
      login_password: row.login_password ?? null,
    })
    const hasCluster =
      row.cluster_name || row.node_name || row.node_role || row.expected_service
    if (hasCluster) {
      nodes.push({
        id: createId("node"),
        device_id: deviceId,
        node_role: row.node_role ?? "Worker",
        mgmt_ip: row.internal_ip ?? "",
        cluster_id: row.cluster_name ?? "",
        lifecycle_status: lifecycle,
        cluster_name: row.cluster_name ?? null,
        node_name: row.node_name ?? null,
        expected_service: row.expected_service ?? null,
      })
    }
  })
  return { devices, nodes }
}

export function buildChangeLogsFromChangelogImport(params: {
  batchId: string
  rows: DeviceChangelogParsedRow[]
  devices: SupplierDevice[]
  createId: (prefix: string) => string
}): { logs: SupplierDeviceChangeLog[]; updatedDevices: SupplierDevice[] } {
  const { batchId, rows, devices, createId } = params
  const now = new Date().toISOString()
  const logs: SupplierDeviceChangeLog[] = []
  const updatedDevices: SupplierDevice[] = []
  const deviceUpdates = new Map<string, SupplierDevice>()

  for (const row of rows.filter((r) => r.parse_status !== "error")) {
    const device = findDeviceByImportKeys(devices, row)
    if (!device) continue

    const prevOps = device.ops_status ?? ""
    const prevLife = device.lifecycle_status
    let newOps = prevOps
    let newLife = prevLife
    const content = row.change_content ?? ""
    if (content.includes("设备状态") || row.change_action.includes("状态")) {
      const match = content.match(/[为改为：:]\s*([^\s,，]+)/)
      if (match?.[1] && KNOWN_OPS_FROM_CONTENT(match[1])) {
        newOps = match[1]
        newLife = resolveLifecycleStatus(newOps, device.in_maintenance ?? false)
      }
    }

    logs.push({
      id: createId("dcl"),
      supplier_device_id: device.id,
      onboarding_batch_id: batchId,
      internal_ip: row.internal_ip ?? null,
      occurred_at: row.occurred_at,
      change_action: row.change_action,
      change_content: row.change_content ?? null,
      description: row.description ?? null,
      ticket_no: row.ticket_no ?? null,
      import_row_no: row.row_no,
      previous_ops_status: prevOps || null,
      new_ops_status: newOps !== prevOps ? newOps : null,
      previous_lifecycle_status: prevLife,
      new_lifecycle_status: newLife !== prevLife ? newLife : null,
      created_at: now,
    })

    if (newOps !== prevOps || newLife !== prevLife) {
      deviceUpdates.set(device.id, {
        ...device,
        ops_status: newOps,
        lifecycle_status: newLife,
      })
    }
  }

  updatedDevices.push(...deviceUpdates.values())
  return { logs, updatedDevices }
}

function KNOWN_OPS_FROM_CONTENT(s: string): boolean {
  return s in OPS_STATUS_TO_LIFECYCLE
}

export function buildFaultIncidentsFromRecordsImport(params: {
  batchId: string
  supplierId: string
  rows: FaultRecordsParsedRow[]
  createId: (prefix: string) => string
}): FaultIncident[] {
  const { batchId, supplierId, rows, createId } = params
  return rows
    .filter((r) => r.parse_status !== "error")
    .map((row) => {
      const closed = row.closed_at?.trim()
      return {
        id: createId("fault"),
        supplier_id: supplierId,
        title: row.fault_type,
        device_id: null,
        compute_node_id: null,
        severity: "P3",
        incident_status: closed ? "已关闭" : "处理中",
        resolution_outcome: closed ? (row.postmortem?.slice(0, 80) ?? "已关闭") : "",
        opened_at: row.opened_at,
        closed_at: closed || null,
        supplier_ops_upload_batch_id: batchId,
        fault_type: row.fault_type,
        impact_minutes: row.impact_minutes ?? null,
        impact_scope: row.impact_scope ?? null,
        affected_device_count: row.affected_device_count ?? null,
        postmortem: row.postmortem ?? null,
      }
    })
}

export function createInventoryOnboardingBatch(params: {
  batchKind: "device_inventory" | "device_changelog"
  supplier: { id: string; code: string; name: string; short_name: string }
  dc: { id: string; code: string; name: string; location: string }
  contractId: string
  accessSheetId: string
  fileName: string
  rows: DeviceInventoryParsedRow[] | DeviceChangelogParsedRow[]
  createId: (prefix: string) => string
}): OnboardingBatch {
  const { batchKind, supplier, dc, contractId, accessSheetId, fileName, rows, createId } = params
  const now = new Date().toISOString()
  const okCount = rows.filter((r) => r.parse_status === "ok").length
  const previewRows =
    batchKind === "device_inventory"
      ? maskInventoryRowsForPreview(rows as DeviceInventoryParsedRow[])
      : rows
  return {
    id: createId("batch"),
    batch_kind: batchKind,
    supplier_id: supplier.id,
    supplier_code: supplier.code,
    supplier_name: supplier.name,
    supplier_short_name: supplier.short_name,
    data_center_id: dc.id,
    idc_code: dc.code,
    data_center_name: dc.name,
    idc_region: dc.location,
    contract_id: contractId,
    access_condition_sheet_id: accessSheetId,
    batch_code: generateImportBatchCode(batchKind),
    batch_status: batchKind === "device_changelog" ? "已完成" : "待开始",
    planned_ready_at: null,
    online_reason: null,
    order_no: null,
    remark: null,
    access_method: "on_site",
    import_file_name: fileName,
    import_status: "parsed",
    parsed_row_count: rows.length,
    parsed_success_count: okCount,
    parsed_rows_json: previewRows,
    parsed_at: now,
    committed_device_count: 0,
    committed_at: null,
    created_at: now,
    updated_at: now,
  }
}

export function createFaultRecordsUploadBatch(params: {
  supplierId: string
  idcCode: string
  fileName: string
  rows: FaultRecordsParsedRow[]
  createId: (prefix: string) => string
}): SupplierOpsUploadBatch {
  const { supplierId, idcCode, fileName, rows, createId } = params
  const now = new Date().toISOString()
  return {
    id: createId("opsb"),
    kind: "fault_records",
    supplier_id: supplierId,
    idc_code: idcCode,
    file_name: fileName,
    import_status: "parsed",
    parsed_row_count: rows.length,
    parsed_success_count: rows.filter((r) => r.parse_status === "ok").length,
    rows_json: rows,
    committed_incident_count: 0,
    committed_at: null,
    created_at: now,
  }
}
