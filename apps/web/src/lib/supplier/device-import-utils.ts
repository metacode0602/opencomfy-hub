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
import { isOtherDeptOpsStatus } from "@/lib/server/aggregation/overview-aggregation"
import {
  endpointMatches,
  looksLikeIpAddress,
  parseEndpointHost,
} from "@/lib/supplier/ip-endpoint-utils"
import {
  CHANGE_ACTION_DEFAULT_OPS_FROM_SEEDS,
  DEVICE_CHANGE_ACTION_SEEDS,
  OPS_STATUS_TO_LIFECYCLE_FROM_SEEDS,
} from "@workspace/db/schema"

const KNOWN_CHANGE_ACTIONS = new Set(DEVICE_CHANGE_ACTION_SEEDS.map((s) => s.stateCode))

export const DEVICE_CHANGE_ACTION_OPTIONS = DEVICE_CHANGE_ACTION_SEEDS.map((s) => s.stateCode)

/** 校验设备变更表单行（Excel 解析与预览页手工修正共用） */
export function validateDeviceChangelogRowFields(input: {
  change_action: string
  /** Excel 原文；手工修正时传与 change_action 相同以跳过归一化警告 */
  raw_change_action?: string
  external_device_id?: string
  internal_ip?: string
}): Pick<DeviceChangelogParsedRow, "parse_status" | "parse_message"> {
  const change_action = normalizeDeviceChangeAction(input.change_action)
  const raw = (input.raw_change_action ?? input.change_action).trim()

  let parse_status: "ok" | "warning" | "error" = "ok"
  let parse_message: string | null = null

  if (raw !== change_action) {
    parse_status = "warning"
    parse_message = `变更动作「${raw}」已归一化为「${change_action}」`
  }
  if (!KNOWN_CHANGE_ACTIONS.has(change_action)) {
    parse_status = "warning"
    parse_message = parse_message
      ? `${parse_message}；未知变更动作，入库时将仍记录原文`
      : `未知变更动作「${change_action}」，入库时将仍记录原文`
  }
  if (!input.external_device_id?.trim() && !input.internal_ip?.trim()) {
    parse_status = "warning"
    parse_message = "缺少设备ID与内网IP，commit 时可能无法匹配设备"
  }

  return { parse_status, parse_message }
}

/** 变更表行：设备ID 为 IP 时提升到内网IP；两列 IP 不一致时附加 warning */
export function normalizeChangelogRowIpFields(input: {
  external_device_id?: string
  internal_ip?: string
}): {
  external_device_id?: string
  internal_ip?: string
  ip_mismatch_warning?: string
} {
  const ext = input.external_device_id?.trim() || undefined
  let ip = input.internal_ip?.trim() || undefined

  if (!ip && ext && looksLikeIpAddress(ext)) {
    ip = ext
  }

  if (
    ext &&
    ip &&
    looksLikeIpAddress(ext) &&
    looksLikeIpAddress(ip) &&
    !endpointMatches(ext, ip)
  ) {
    return {
      external_device_id: ext,
      internal_ip: ip,
      ip_mismatch_warning: `设备ID（${ext}）与内网IP（${ip}）不一致，将优先按内网IP匹配`,
    }
  }

  return { external_device_id: ext, internal_ip: ip }
}

/** 解析变更表操作时间（yyyy/MM/dd HH:mm 等本地字面量） */
export function parseChangelogOccurredAt(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  const slashOrDash = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(
    raw,
  )
  if (slashOrDash) {
    const year = Number(slashOrDash[1])
    const month = Number(slashOrDash[2]) - 1
    const day = Number(slashOrDash[3])
    const hour = Number(slashOrDash[4] ?? 0)
    const minute = Number(slashOrDash[5] ?? 0)
    const second = Number(slashOrDash[6] ?? 0)
    const d = new Date(year, month, day, hour, minute, second)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export type ChangelogDeviceIpIndex = {
  byHost: Map<string, SupplierDevice>
  duplicateHosts: Set<string>
}

export function buildChangelogDeviceIpIndex(devices: SupplierDevice[]): ChangelogDeviceIpIndex {
  const byHost = new Map<string, SupplierDevice>()
  const duplicateHosts = new Set<string>()
  for (const device of devices) {
    const host = parseEndpointHost(device.internal_ip)
    if (!host) continue
    if (byHost.has(host)) {
      duplicateHosts.add(host)
    } else {
      byHost.set(host, device)
    }
  }
  return { byHost, duplicateHosts }
}

export function findDeviceByChangelogRow(
  devices: SupplierDevice[],
  ipIndex: ChangelogDeviceIpIndex,
  row: {
    external_device_id?: string | null
    internal_ip?: string
    sn?: string
    asset_no?: string
  },
): { device?: SupplierDevice; matchWarning?: string } {
  const ipCandidates = [
    row.internal_ip,
    looksLikeIpAddress(row.external_device_id) ? row.external_device_id : null,
  ].filter((v): v is string => Boolean(v?.trim()))

  for (const candidate of ipCandidates) {
    const host = parseEndpointHost(candidate)
    if (!host) continue
    if (ipIndex.duplicateHosts.has(host)) {
      return {
        matchWarning: `内网 IP ${host} 在本机房存在多台设备，无法自动匹配`,
      }
    }
    const indexed = ipIndex.byHost.get(host)
    if (indexed) return { device: indexed }
    const fuzzy = devices.find((d) => endpointMatches(d.internal_ip, candidate))
    if (fuzzy) return { device: fuzzy }
  }

  const extId = row.external_device_id?.trim()
  if (extId && !looksLikeIpAddress(extId)) {
    const hit = devices.find((d) => d.external_device_id?.trim() === extId)
    if (hit) return { device: hit }
  }

  const sn = row.sn?.trim()
  if (sn) {
    const hit = devices.find((d) => d.sn === sn)
    if (hit) return { device: hit }
  }

  const asset = row.asset_no?.trim()
  if (asset) {
    const hit = devices.find((d) => d.asset_no === asset)
    if (hit) return { device: hit }
  }

  return {}
}

/** 合并必填项与字段校验（Excel 解析与预览页手工修正共用） */
export function resolveDeviceChangelogRowValidation(input: {
  occurred_at: string
  change_action: string
  raw_change_action?: string
  external_device_id?: string
  internal_ip?: string
}): Pick<DeviceChangelogParsedRow, "parse_status" | "parse_message"> {
  let parse_status: "ok" | "warning" | "error" = "ok"
  let parse_message: string | null = null

  if (!input.occurred_at?.trim()) {
    parse_status = "error"
    parse_message = "缺少操作时间"
  }
  if (!input.change_action?.trim() && !input.raw_change_action?.trim()) {
    parse_status = "error"
    parse_message = parse_message ? `${parse_message}；缺少变更动作` : "缺少变更动作"
  }

  const fieldValidation = validateDeviceChangelogRowFields({
    change_action: input.change_action || input.raw_change_action || "",
    raw_change_action: input.raw_change_action,
    external_device_id: input.external_device_id,
    internal_ip: input.internal_ip,
  })

  if (parse_status === "error") {
    if (fieldValidation.parse_message) {
      parse_message = parse_message
        ? `${parse_message}；${fieldValidation.parse_message}`
        : fieldValidation.parse_message
    }
    return { parse_status, parse_message }
  }

  return fieldValidation
}

export function applyDeviceChangelogRowValidation(
  row: DeviceChangelogParsedRow,
  changeAction: string,
  options?: { fromManualEdit?: boolean },
): DeviceChangelogParsedRow {
  const normalized = normalizeDeviceChangeAction(changeAction)
  const validation = resolveDeviceChangelogRowValidation({
    occurred_at: row.occurred_at,
    change_action: normalized,
    raw_change_action: options?.fromManualEdit ? normalized : changeAction,
    external_device_id: row.external_device_id,
    internal_ip: row.internal_ip,
  })
  return {
    ...row,
    change_action: normalized,
    ...validation,
  }
}

/** Excel 设备状态 → CRM lifecycle_status（与 DB 种子一致） */
export const OPS_STATUS_TO_LIFECYCLE: Record<string, string> = {
  ...OPS_STATUS_TO_LIFECYCLE_FROM_SEEDS,
}

/** 变更动作 → 默认 ops_status（变更内容无状态时） */
export const CHANGE_ACTION_DEFAULT_OPS: Record<string, string> = {
  ...CHANGE_ACTION_DEFAULT_OPS_FROM_SEEDS,
}

/**
 * 设备字典文案归一化：Excel 常见「其它」与标准「其他」对齐。
 * 应用于设备状态、变更动作及变更内容中的状态片段。
 */
export function normalizeDeviceDictionaryText(raw: string): string {
  return raw.trim().replace(/其它/g, "其他")
}

export function normalizeDeviceOpsStatus(raw: string): string {
  return normalizeDeviceDictionaryText(raw)
}

export function normalizeDeviceChangeAction(raw: string): string {
  const normalized = normalizeDeviceDictionaryText(raw)
  if (normalized === "退出集群") return "退出集群"
  return normalized
}

export const BATCH_KIND_LABELS: Record<OnboardingBatchKind, string> = {
  online: "设备上架",
  order_access: "订单接入",
  device_inventory: "设备主数据",
  device_changelog: "设备变更",
  device_retire: "设备下架",
  internal_occupancy: "内部占用计划",
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
  return OPS_STATUS_TO_LIFECYCLE[normalizeDeviceOpsStatus(opsStatus)] ?? "待接入"
}

/** 与 supply-schema compute_node 列宽一致 */
export const COMPUTE_NODE_FIELD_LIMITS = {
  nodeRole: 32,
  mgmtIp: 45,
  clusterName: 128,
  nodeName: 128,
  expectedService: 255,
  clusterId: 64,
  lifecycleStatus: 32,
} as const

export function assertComputeNodeFieldLengths(params: {
  rowNo: number
  node: Pick<
    ComputeNode,
    | "node_role"
    | "mgmt_ip"
    | "cluster_name"
    | "node_name"
    | "expected_service"
    | "cluster_id"
    | "lifecycle_status"
  >
}): void {
  const { rowNo, node } = params
  const checks: Array<[label: string, value: string | null | undefined, max: number]> = [
    ["集群角色（node_role）", node.node_role, COMPUTE_NODE_FIELD_LIMITS.nodeRole],
    ["管理 IP（mgmt_ip）", node.mgmt_ip, COMPUTE_NODE_FIELD_LIMITS.mgmtIp],
    ["K8s 集群（cluster_name）", node.cluster_name, COMPUTE_NODE_FIELD_LIMITS.clusterName],
    ["集群中节点名称（node_name）", node.node_name, COMPUTE_NODE_FIELD_LIMITS.nodeName],
    [
      "预期集群提供服务（expected_service）",
      node.expected_service,
      COMPUTE_NODE_FIELD_LIMITS.expectedService,
    ],
    ["集群 ID（cluster_id）", node.cluster_id, COMPUTE_NODE_FIELD_LIMITS.clusterId],
    ["生命周期（lifecycle_status）", node.lifecycle_status, COMPUTE_NODE_FIELD_LIMITS.lifecycleStatus],
  ]
  for (const [label, value, max] of checks) {
    if (value != null && value.length > max) {
      throw new Error(
        `第 ${rowNo} 行 ${label} 超过 ${max} 个字符（当前 ${value.length} 个字符），请缩短后重试`,
      )
    }
  }
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
          : batchKind === "internal_occupancy"
            ? "IO"
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
    rows,
    createId,
  } = params
  const okRows = rows.filter((r) => r.parse_status !== "error")
  const devices: SupplierDevice[] = []
  const nodes: ComputeNode[] = []

  okRows.forEach((row, idx) => {
    const inMaint = row.in_maintenance ?? false
    const opsStatus = normalizeDeviceOpsStatus(row.ops_status)
    const lifecycle = resolveLifecycleStatus(opsStatus, inMaint)
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
      card_type: row.gpu_card_type_code ?? '',
      external_ip: "",
      internal_ip: row.internal_ip ?? "",
      platform_resource_id: null,
      external_device_id: row.external_device_id ?? null,
      ops_status: opsStatus,
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
      const node: ComputeNode = {
        id: createId("node"),
        device_id: deviceId,
        node_role: row.node_role?.trim() || "Worker",
        mgmt_ip: row.internal_ip ?? "",
        cluster_id: row.cluster_name ?? "",
        lifecycle_status: lifecycle,
        cluster_name: row.cluster_name ?? null,
        node_name: row.node_name ?? null,
        expected_service: row.expected_service ?? null,
      }
      assertComputeNodeFieldLengths({ rowNo: row.row_no, node })
      nodes.push(node)
    }
  })
  return { devices, nodes }
}

export type ChangelogBusinessBatchLinkInput = {
  businessBatchId: string
  businessBatchCode: string
  businessDataCenterId: string
  batchKind: "online" | "order_access" | "device_retire" | "internal_occupancy"
  retireActionType: RetireActionType | null
}

export type ChangelogDeviceLinkUpsert = {
  businessBatchId: string
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

  const changeAction = normalizeDeviceChangeAction(row.change_action)

  if (content.includes("设备状态") || changeAction.includes("状态")) {
    const match = content.match(/[为改为：:]\s*([^\s,，]+)/)
    if (match?.[1] && KNOWN_OPS_FROM_CONTENT(match[1])) {
      const newOps = normalizeDeviceOpsStatus(match[1])
      const newLife = resolveLifecycleStatus(newOps, inMaint)
      return {
        newOps,
        newLife,
        statusChanged: newOps !== prevOps || newLife !== prevLife,
      }
    }
  }

  const defaultOps = CHANGE_ACTION_DEFAULT_OPS[changeAction]
  if (defaultOps) {
    const newOps = normalizeDeviceOpsStatus(defaultOps)
    const newLife = resolveLifecycleFromChangelog({
      changeAction,
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
  /** 工单号 → 业务批次（各行独立挂接） */
  businessBatchByTicket?: Map<string, ChangelogBusinessBatchLinkInput>
}): {
  logs: SupplierDeviceChangeLog[]
  updatedDevices: SupplierDevice[]
  deviceLinks: ChangelogDeviceLinkUpsert[]
  bindWarnings: string[]
} {
  const { batchId, rows, devices, createId, businessBatchByTicket } = params
  const now = new Date().toISOString()
  const logs: SupplierDeviceChangeLog[] = []
  const updatedDevices: SupplierDevice[] = []
  const deviceUpdates = new Map<string, SupplierDevice>()
  const deviceLinks: ChangelogDeviceLinkUpsert[] = []
  const linkedDeviceBatchKeys = new Set<string>()
  const bindWarnings: string[] = []
  const ipIndex = buildChangelogDeviceIpIndex(devices)

  for (const row of rows.filter((r) => r.parse_status !== "error")) {
    const { device, matchWarning } = findDeviceByChangelogRow(devices, ipIndex, row)
    if (matchWarning) {
      bindWarnings.push(`第 ${row.row_no} 行：${matchWarning}`)
    }
    if (!device) {
      const ipLabel = row.internal_ip ?? row.external_device_id ?? "—"
      bindWarnings.push(`第 ${row.row_no} 行：内网 IP / 设备ID ${ipLabel} 未匹配到本机房已有设备，已跳过`)
      continue
    }

    const logId = createId("dcl")
    const prevOps = device.ops_status ?? ""
    const prevLife = device.lifecycle_status
    const { newOps, newLife, statusChanged } = resolveOpsStatusFromChangelogRow(row, device)

    const ticketNo = row.ticket_no?.trim()
    const rowBatch = ticketNo ? businessBatchByTicket?.get(ticketNo) : undefined

    if (rowBatch) {
      const deviceDc = device.data_center_id?.trim()
      if (deviceDc && deviceDc !== rowBatch.businessDataCenterId) {
        bindWarnings.push(
          `第 ${row.row_no} 行：设备 ${device.sn || device.internal_ip} 所属机房与业务批次 ${rowBatch.businessBatchCode} 机房不一致，未写入批次关联`,
        )
      } else if (!device.gpu_card_type_id) {
        bindWarnings.push(
          `第 ${row.row_no} 行：设备 ${device.sn || device.internal_ip} 缺少卡型信息，未写入批次关联`,
        )
      } else {
        const linkKey = `${rowBatch.businessBatchId}:${device.id}`
        if (!linkedDeviceBatchKeys.has(linkKey)) {
          if (
            rowBatch.batchKind === "device_retire" &&
            rowBatch.retireActionType &&
            !isRetireActionCompatible(rowBatch.retireActionType, row.change_action)
          ) {
            bindWarnings.push(
              `第 ${row.row_no} 行：变更动作「${row.change_action}」与下架计划 ${rowBatch.businessBatchCode} 类型「${expectedRetireActionLabel(rowBatch.retireActionType)}」不一致；已挂接批次，请复核`,
            )
          }
          if (rowBatch.batchKind === "internal_occupancy") {
            const changeAction = normalizeDeviceChangeAction(row.change_action)
            if (
              changeAction !== "交给其他部门使用" &&
              !isOtherDeptOpsStatus(newOps) &&
              !(row.change_content ?? "").includes("其他部门使用中")
            ) {
              bindWarnings.push(
                `第 ${row.row_no} 行：变更动作/内容与内部占用计划 ${rowBatch.businessBatchCode} 不一致，已挂接批次，请复核`,
              )
            }
          }
          linkedDeviceBatchKeys.add(linkKey)
          const linkKind =
            rowBatch.batchKind === "device_retire"
              ? resolveRetireLinkKind(row.change_action)
              : rowBatch.batchKind === "internal_occupancy"
                ? "internal_occupancy"
                : newLife === "在线"
                  ? "online"
                  : "touched"
          deviceLinks.push({
            businessBatchId: rowBatch.businessBatchId,
            supplierDeviceId: device.id,
            gpuCardTypeId: device.gpu_card_type_id,
            cooperationType: device.cooperation_type ?? "idle_time",
            sourceChangeLogId: logId,
            linkKind,
          })
        }
      }
    }

    logs.push({
      id: logId,
      supplier_device_id: device.id,
      onboarding_batch_id: batchId,
      business_onboarding_batch_id: rowBatch?.businessBatchId ?? null,
      external_device_id: row.external_device_id ?? null,
      internal_ip: row.internal_ip ?? device.internal_ip ?? null,
      occurred_at: row.occurred_at,
      change_action: row.change_action,
      change_content: row.change_content ?? null,
      description: row.description ?? null,
      ticket_no: row.ticket_no ?? null,
      attachment_names: row.attachment_names ?? null,
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

function KNOWN_OPS_FROM_CONTENT(s: string): boolean {
  return normalizeDeviceOpsStatus(s) in OPS_STATUS_TO_LIFECYCLE
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
