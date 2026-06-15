/** 供应商与算力资源域（设计文档 §2.1）— 类型定义 */

export type Supplier = {
  id: string
  code: string
  name: string
  short_name: string
}

export type SupplierDataCenter = {
  id: string
  supplier_id: string
  code: string
  name: string
  location: string
  status: "online" | "offline" | "maintenance"
}

export type SupplierContract = {
  id: string
  supplier_id: string
  contract_no: string
  contract_url: string
  status: string
  effective_from: string
  effective_to: string
}

export type SupplierTermsVersion = {
  id: string
  supplier_id: string | null
  contract_id: string | null
  deal_mode: string
  terms_json: Record<string, unknown>
  effective_from: string
  effective_to: string | null
}

export type SupplierUnitCost = {
  id: string
  supplier_terms_version_id: string
  supplier_id: string
  idc_code: string
  card_type: string
  unit_cost: string | null
  percent: string | null
  tier_json: Record<string, unknown> | null
}

export type AccessConditionSheet = {
  id: string
  contract_id: string
  version_no: number
  is_current: boolean
  gpu_network_cpu_terms: Record<string, unknown>
}

export type OnboardingBatchKind =
  | "online"
  | "order_access"
  | "device_inventory"
  | "device_changelog"
  | "device_retire"
  | "internal_occupancy"

export type OnboardingImportStatus =
  | "draft"
  | "none"
  | "uploaded"
  | "parsing"
  | "parsed"
  | "parse_failed"
  | "committing"
  | "committed"
  | "cancelled"

export type OnboardingParsedRow = {
  row_no: number
  public_ip: string
  private_ip: string
  root_account: string
  root_password: string
  sn?: string
  asset_no?: string
  gpu_count?: number
  card_type_code?: string
  parse_status: "ok" | "warning" | "error"
  parse_message?: string | null
}

/** 设备合作类型：闲时合作 / 整租合作 */
export type DeviceCooperationType = "idle_time" | "whole_rent"

export const DEVICE_COOPERATION_TYPE_LABELS: Record<DeviceCooperationType, string> = {
  idle_time: "闲时合作",
  whole_rent: "整租合作",
}

/** 接入批次计划行：卡型 + 合作类型 + 数量（组合在本批次内唯一） */
export type OnboardingBatchPlanLine = {
  gpu_card_type_id?: string | null
  gpu_card_type_code: string
  cooperation_type: DeviceCooperationType
  planned_quantity: number
}

/** 设备主数据表 Excel 解析行（batch_kind=device_inventory） */
export type DeviceInventoryParsedRow = {
  row_no: number
  external_device_id?: string
  internal_ip?: string
  asset_no?: string
  sn?: string
  gpu_card_type_code?: string
  gpu_count?: number
  ops_status: string
  in_maintenance?: boolean
  bandwidth_group?: string
  rate_limit?: string
  cooperation_type?: DeviceCooperationType
  device_spec?: string
  device_purpose?: string
  received_at?: string
  remark?: string
  login_username?: string
  login_password?: string
  cluster_name?: string
  node_name?: string
  node_role?: string
  expected_service?: string
  parse_status: "ok" | "warning" | "error"
  parse_message?: string | null
  supplier_device_id?: string
  /** preview/commit：自动匹配失败或 CPU 管控节点时由用户手工选择 */
  gpu_card_type_id?: string
}

/** 设备变更表 Excel 解析行（batch_kind=device_changelog） */
export type DeviceChangelogParsedRow = {
  row_no: number
  external_device_id?: string
  internal_ip?: string
  occurred_at: string
  change_action: string
  change_content?: string
  description?: string
  ticket_no?: string
  attachment_names?: string
  parse_status: "ok" | "warning" | "error"
  parse_message?: string | null
}

export type OnboardingBatch = {
  id: string
  batch_kind: OnboardingBatchKind
  supplier_id: string
  supplier_code: string
  supplier_name: string
  supplier_short_name: string
  data_center_id: string
  idc_code: string
  data_center_name: string
  idc_region: string
  contract_id: string | null
  access_condition_sheet_id: string | null
  batch_code: string
  batch_status: string
  planned_ready_at: string | null
  /** 上架原因（`batch_kind=online` 时填写） */
  online_reason: string | null
  /** 关联订单编号（`batch_kind=order_access` 时填写） */
  order_no: string | null
  /** 批次备注 */
  remark: string | null
  /** 计划上架明细；`planned_device_count` 为其 quantity 之和 */
  planned_lines?: OnboardingBatchPlanLine[] | null
  /** 计划上架总台数（各计划行 quantity 合计） */
  planned_device_count?: number
  /** 关联工单号 */
  work_order_no?: string | null
  access_method: string
  import_file_name: string
  import_status: OnboardingImportStatus
  parse_error?: string | null
  parsed_row_count: number
  parsed_success_count: number
  parsed_rows_json:
    | OnboardingParsedRow[]
    | DeviceInventoryParsedRow[]
    | DeviceChangelogParsedRow[]
    | null
  parsed_at: string | null
  committed_device_count: number
  committed_at: string | null
  created_at: string
  updated_at: string
}

export type SupplierDevice = {
  id: string
  supplier_id: string
  contract_id: string | null
  onboarding_batch_id: string
  data_center_id: string
  asset_no: string
  sn: string
  lifecycle_status: string
  onboarding_substage: string
  idc_region: string
  idc_code: string
  gpu_count: string
  card_type: string
  gpu_card_type_id?: string
  external_ip: string
  internal_ip: string
  platform_resource_id?: string | null
  /** Excel 设备ID */
  external_device_id?: string | null
  /** Excel 设备状态原文 */
  ops_status?: string
  in_maintenance?: boolean
  bandwidth_group?: string | null
  rate_limit?: string | null
  cooperation_type?: DeviceCooperationType
  device_spec?: string | null
  device_purpose?: string | null
  received_at?: string | null
  remark?: string | null
  login_username?: string | null
  login_password?: string | null
}

export type ComputeNode = {
  id: string
  device_id: string
  node_role: string
  mgmt_ip: string
  cluster_id: string
  lifecycle_status: string
  cluster_name?: string | null
  node_name?: string | null
  expected_service?: string | null
}

/** 设备变更审计（device_changelog 批次 commit） */
export type SupplierDeviceChangeLog = {
  id: string
  supplier_device_id: string
  onboarding_batch_id: string
  business_onboarding_batch_id?: string | null
  external_device_id?: string | null
  internal_ip?: string | null
  occurred_at: string
  change_action: string
  change_content?: string | null
  description?: string | null
  ticket_no?: string | null
  attachment_names?: string | null
  import_row_no?: number | null
  previous_ops_status?: string | null
  new_ops_status?: string | null
  previous_lifecycle_status?: string | null
  new_lifecycle_status?: string | null
  created_at: string
}

export type OnboardingTask = {
  id: string
  onboarding_batch_id: string
  device_id: string | null
  task_type: string
  assignee_id: string
  task_status: string
  started_at: string | null
  finished_at: string | null
}

export type FaultIncident = {
  id: string
  supplier_id: string
  title: string
  device_id: string | null
  compute_node_id: string | null
  severity: string
  incident_status: string
  resolution_outcome: string
  opened_at: string
  closed_at: string | null
  /** 故障记录表导入 */
  supplier_ops_upload_batch_id?: string | null
  fault_type?: string
  impact_minutes?: number | null
  impact_scope?: string | null
  affected_device_count?: number | null
  postmortem?: string | null
}

/** 故障记录表导入批次（kind=fault_records） */
export type FaultRecordsImportStatus =
  | "uploaded"
  | "parsed"
  | "committed"
  | "parse_failed"

export type FaultRecordsParsedRow = {
  row_no: number
  opened_at: string
  closed_at?: string
  fault_type: string
  impact_minutes?: number
  impact_scope?: string
  affected_device_count?: number
  postmortem?: string
  parse_status: "ok" | "warning" | "error"
  parse_message?: string | null
  fault_incident_id?: string
}

export type SupplierOpsUploadBatch = {
  id: string
  kind: "fault_records"
  supplier_id: string
  idc_code: string
  file_name: string
  import_status: FaultRecordsImportStatus
  parse_error?: string | null
  parsed_row_count: number
  parsed_success_count: number
  rows_json: FaultRecordsParsedRow[]
  committed_incident_count: number
  committed_at: string | null
  created_at: string
}

export type InternalTestHoldDepartment = "product" | "rd" | "test"

export type InternalTestHoldSettlement = "whole_rent" | "idle_time"

export const INTERNAL_TEST_HOLD_DEPARTMENT_LABELS: Record<InternalTestHoldDepartment, string> = {
  product: "产品",
  rd: "研发",
  test: "测试",
}

export const INTERNAL_TEST_HOLD_SETTLEMENT_LABELS: Record<InternalTestHoldSettlement, string> = {
  whole_rent: "整租",
  idle_time: "闲时",
}

export type InternalTestHoldDevice = {
  id: string
  device_id: string
  internal_ip: string
  external_ip: string
  port: string
  root_account: string
  root_password: string
  sn?: string
}

export type InternalTestHold = {
  id: string
  supplier_id: string
  data_center_id: string
  /** 飞书审批工单号 */
  work_order_no: string
  user_name: string
  department: InternalTestHoldDepartment
  card_type: string
  unit_count: number
  settlement_mode: InternalTestHoldSettlement
  hold_from: string
  hold_until: string | null
  remark?: string
  devices?: InternalTestHoldDevice[]
}

export type ResourcePoolBinding = {
  id: string
  device_id: string
  resource_pool_id: string | null
  pool_code: string | null
  workload_profile: string
  is_exclusive_pool: boolean
}

export type SupplierActivityAttachment = {
  id: string
  name: string
  size: number
  type: string
  url: string
}

export type SupplierActivity = {
  id: string
  supplier_id: string
  type: string
  title: string
  description: string | null
  author_name: string
  author_staff_id?: string | null
  author_role: "business" | "ops" | "system"
  ref_domain: string | null
  ref_id: string | null
  occurred_at: string
  attachments?: SupplierActivityAttachment[]
}

export type LifecycleStateDefinition = {
  id: string
  domain: string
  state_code: string
  display_name: string
  sort_order: number
}

export type EntityStateTransitionLog = {
  id: string
  entity_type: string
  entity_id: string
  from_state: string
  to_state: string
  operator_id: string
  reason_code: string
  occurred_at: string
}

export const SUPPLIER_RELATION_KEYS = [
  "contracts",
  "terms-versions",
  "unit-costs",
  "access-sheets",
  "onboarding-batches",
  "device-change-logs",
  "ops-upload-batches",
  "devices",
  "compute-nodes",
  "onboarding-tasks",
  "fault-incidents",
  "test-holds",
  "pool-bindings",
  "state-definitions",
  "transition-logs",
  "activities",
] as const

export type SupplierRelationKey = (typeof SUPPLIER_RELATION_KEYS)[number]

export function isSupplierRelationKey(v: string): v is SupplierRelationKey {
  return (SUPPLIER_RELATION_KEYS as readonly string[]).includes(v)
}

export const SUPPLIER_RELATION_TITLES: Record<SupplierRelationKey, string> = {
  contracts: "商务合同",
  "terms-versions": "合作条款版本",
  "unit-costs": "条款单价/分成档",
  "access-sheets": "接入条件单",
  "onboarding-batches": "接入批次",
  "device-change-logs": "设备变更审计",
  "ops-upload-batches": "运维上传批次",
  devices: "物理设备",
  "compute-nodes": "计算节点",
  "onboarding-tasks": "接入施工任务",
  "fault-incidents": "故障事件",
  "test-holds": "内部测试占用",
  "pool-bindings": "资源池绑定",
  "state-definitions": "生命周期状态字典",
  "transition-logs": "状态变更审计",
  activities: "活动时间线",
}
