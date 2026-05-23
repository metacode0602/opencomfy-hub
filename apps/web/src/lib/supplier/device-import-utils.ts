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
import type { RetireActionType } from "@/lib/types/datacenter-device-retire"
import {
  expectedRetireActionLabel,
  isRetireActionCompatible,
  resolveLifecycleFromChangelog,
  resolveRetireLinkKind,
} from "@/lib/supplier/retire-changelog-utils"
import {
  CHANGE_ACTION_DEFAULT_OPS_FROM_SEEDS,
  OPS_STATUS_TO_LIFECYCLE_FROM_SEEDS,
} from "@workspace/db/schema"

/** Excel 设备状态 → CRM lifecycle_status（与 DB 种子一致） */
export const OPS_STATUS_TO_LIFECYCLE: Record<string, string> = {
  ...OPS_STATUS_TO_LIFECYCLE_FROM_SEEDS,
}

/** 变更动作 → 默认 ops_status（变更内容无状态时） */
export const CHANGE_ACTION_DEFAULT_OPS: Record<string, string> = {
  ...CHANGE_ACTION_DEFAULT_OPS_FROM_SEEDS,
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
  const sn = row.sn?.trim()
  const asset = row.asset_no?.trim()
  const extId = row.external_device_id?.trim()
  const ip = row.internal_ip?.trim()

  if (extId) {
    const hit = devices.find((d) => d.external_device_id?.trim() === extId)
    if (hit) return hit
  }
  if (ip) {
    const hit = devices.find((d) => d.internal_ip?.trim() === ip)
    if (hit) return hit
  }
  if (sn) {
    const hit = devices.find((d) => d.sn === sn)
    if (hit) return hit
  }
  if (asset) {
    const hit = devices.find((d) => d.asset_no === asset)
    if (hit) return hit
  }
  return undefined
}

/** 生成全局唯一的 sn/asset（表级 UK，需带机房前缀；优先设备 ID > IP > 标识） */
export function resolveImportDeviceIdentity(
  row: Pick<
    DeviceInventoryParsedRow,
    "sn" | "asset_no" | "external_device_id" | "internal_ip"
  >,
  idcCode: string,
  rowIndex: number,
): { sn: string; assetNo: string } {
  const ext = row.external_device_id?.trim()
  const ip = row.internal_ip?.trim()
  const asset = row.asset_no?.trim() || row.sn?.trim()
  const seq = String(rowIndex + 1).padStart(4, "0")

  if (ext) {
    const sn = `${idcCode}-DEV-${ext}`.slice(0, 64)
    const assetNo = (asset && asset !== ext ? `${idcCode}-${asset}` : sn).slice(0, 64)
    return { sn, assetNo }
  }
  if (ip) {
    const sn = `${idcCode}-IP-${ip}`.slice(0, 64)
    const assetNo = (asset && asset !== ip ? `${idcCode}-${asset}` : sn).slice(0, 64)
    return { sn, assetNo }
  }
  if (asset) {
    const sn = asset.length <= 64 && asset.includes(idcCode) ? asset : `${idcCode}-${asset}`.slice(0, 64)
    return { sn, assetNo: sn }
  }
  return {
    sn: `SN-${idcCode}-${seq}`,
    assetNo: `AST-${idcCode}-${seq}`,
  }
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
    const { sn, assetNo: asset } = resolveImportDeviceIdentity(row, idcCode, idx)
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

export type ChangelogBusinessBatchLinkInput = {
  businessBatchId: string
  businessDataCenterId: string
  ticketRefs: Set<string>
  batchKind?: "online" | "order_access" | "device_retire"
  retireActionType?: RetireActionType | null
}

export type ChangelogDeviceLinkUpsert = {
  supplierDeviceId: string
  gpuCardTypeId: string
  cooperationType: string
  sourceChangeLogId: string
  linkKind: string
}

function resolveOpsStatusFromChangelogRow(
  row: DeviceChangelogParsedRow,
  device: SupplierDevice,
): { newOps: string; newLife: string; statusChanged: boolean } {
  const prevOps = device.ops_status ?? ""
  const prevLife = device.lifecycle_status
  const inMaint = device.in_maintenance ?? false
  const content = row.change_content ?? ""

  if (content.includes("设备状态") || row.change_action.includes("状态")) {
    const match = content.match(/[为改为：:]\s*([^\s,，]+)/)
    if (match?.[1] && KNOWN_OPS_FROM_CONTENT(match[1])) {
      const newOps = match[1]
      const newLife = resolveLifecycleStatus(newOps, inMaint)
      return {
        newOps,
        newLife,
        statusChanged: newOps !== prevOps || newLife !== prevLife,
      }
    }
  }

  const defaultOps = CHANGE_ACTION_DEFAULT_OPS[row.change_action]
  if (defaultOps) {
    const newOps = defaultOps
    const newLife = resolveLifecycleFromChangelog({
      changeAction: row.change_action,
      newOps,
      inMaintenance: inMaint,
    })
    return {
      newOps,
      newLife,
      statusChanged: newOps !== prevOps || newLife !== prevLife,
    }
  }

  return { newOps: prevOps, newLife: prevLife, statusChanged: false }
}

export function buildChangeLogsFromChangelogImport(params: {
  batchId: string
  rows: DeviceChangelogParsedRow[]
  devices: SupplierDevice[]
  createId: (prefix: string) => string
  businessBatchLink?: ChangelogBusinessBatchLinkInput
}): {
  logs: SupplierDeviceChangeLog[]
  updatedDevices: SupplierDevice[]
  deviceLinks: ChangelogDeviceLinkUpsert[]
  bindWarnings: string[]
} {
  const { batchId, rows, devices, createId, businessBatchLink } = params
  const now = new Date().toISOString()
  const logs: SupplierDeviceChangeLog[] = []
  const updatedDevices: SupplierDevice[] = []
  const deviceUpdates = new Map<string, SupplierDevice>()
  const deviceLinks: ChangelogDeviceLinkUpsert[] = []
  const linkedDeviceIds = new Set<string>()
  const bindWarnings: string[] = []

  const ticketRefs = businessBatchLink?.ticketRefs
  const businessDataCenterId = businessBatchLink?.businessDataCenterId
  const businessBatchId = businessBatchLink?.businessBatchId
  const businessBatchKind = businessBatchLink?.batchKind
  const retireActionType = businessBatchLink?.retireActionType

  for (const row of rows.filter((r) => r.parse_status !== "error")) {
    const device = findDeviceByImportKeys(devices, row)
    if (!device) continue

    const logId = createId("dcl")
    const prevOps = device.ops_status ?? ""
    const prevLife = device.lifecycle_status
    const { newOps, newLife, statusChanged } = resolveOpsStatusFromChangelogRow(row, device)

    const matchedTicket =
      businessBatchLink &&
      ticketRefs &&
      rowTicketMatchesBatch(row.ticket_no, ticketRefs)

    if (matchedTicket) {
      const deviceDc = device.data_center_id?.trim()
      if (deviceDc && deviceDc !== businessDataCenterId) {
        bindWarnings.push(
          `第 ${row.row_no} 行：设备 ${device.sn || device.internal_ip} 所属机房与业务批次机房不一致，未写入批次关联`,
        )
      } else if (!device.gpu_card_type_id) {
        bindWarnings.push(
          `第 ${row.row_no} 行：设备 ${device.sn || device.internal_ip} 缺少卡型信息，未写入批次关联`,
        )
      } else if (!linkedDeviceIds.has(device.id)) {
        if (
          businessBatchKind === "device_retire" &&
          retireActionType &&
          !isRetireActionCompatible(retireActionType, row.change_action)
        ) {
          bindWarnings.push(
            `第 ${row.row_no} 行：变更动作「${row.change_action}」与下架计划类型「${expectedRetireActionLabel(retireActionType)}」不一致；已挂接批次，请复核`,
          )
        }
        linkedDeviceIds.add(device.id)
        const linkKind =
          businessBatchKind === "device_retire"
            ? resolveRetireLinkKind(row.change_action)
            : newLife === "在线"
              ? "online"
              : "touched"
        deviceLinks.push({
          supplierDeviceId: device.id,
          gpuCardTypeId: device.gpu_card_type_id,
          cooperationType: device.cooperation_type ?? "idle_time",
          sourceChangeLogId: logId,
          linkKind,
        })
      }
    }

    logs.push({
      id: logId,
      supplier_device_id: device.id,
      onboarding_batch_id: batchId,
      business_onboarding_batch_id: matchedTicket ? businessBatchId ?? null : null,
      internal_ip: row.internal_ip ?? null,
      occurred_at: row.occurred_at,
      change_action: row.change_action,
      change_content: row.change_content ?? null,
      description: row.description ?? null,
      ticket_no: row.ticket_no ?? null,
      import_row_no: row.row_no,
      previous_ops_status: prevOps || null,
      new_ops_status: statusChanged && newOps !== prevOps ? newOps : null,
      previous_lifecycle_status: prevLife,
      new_lifecycle_status: statusChanged && newLife !== prevLife ? newLife : null,
      created_at: now,
    })

    if (statusChanged) {
      deviceUpdates.set(device.id, {
        ...device,
        ops_status: newOps,
        lifecycle_status: newLife,
      })
    }
  }

  updatedDevices.push(...deviceUpdates.values())
  return {
    logs,
    updatedDevices,
    deviceLinks,
    bindWarnings,
  }
}

function rowTicketMatchesBatch(ticketNo: string | undefined | null, refs: Set<string>): boolean {
  const t = ticketNo?.trim()
  return Boolean(t && refs.has(t))
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
