/** 供应商与算力资源域（设计文档 §2.1）— 前端 mock 类型 */

export type Supplier = {
  id: string
  code: string
  name: string
  short_name: string
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

export type OnboardingBatch = {
  id: string
  contract_id: string
  access_condition_sheet_id: string
  batch_code: string
  batch_status: string
  planned_ready_at: string | null
}

export type SupplierDevice = {
  id: string
  supplier_id: string
  contract_id: string | null
  onboarding_batch_id: string
  asset_no: string
  sn: string
  lifecycle_status: string
  onboarding_substage: string
  idc_region: string
  idc_code: string
  gpu_count: string
  card_type: string
  external_ip: string
  internal_ip: string
}

export type ComputeNode = {
  id: string
  device_id: string
  node_role: string
  mgmt_ip: string
  cluster_id: string
  lifecycle_status: string
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
  device_id: string | null
  compute_node_id: string | null
  severity: string
  incident_status: string
  resolution_outcome: string
  opened_at: string
  closed_at: string | null
}

export type InternalTestHold = {
  id: string
  device_id: string | null
  compute_node_id: string | null
  scope: string
  hold_from: string
  hold_until: string
}

export type ResourcePoolBinding = {
  id: string
  device_id: string
  resource_pool_id: string | null
  pool_code: string | null
  workload_profile: string
  is_exclusive_pool: boolean
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
  "devices",
  "compute-nodes",
  "onboarding-tasks",
  "fault-incidents",
  "test-holds",
  "pool-bindings",
  "state-definitions",
  "transition-logs",
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
  devices: "物理设备",
  "compute-nodes": "计算节点",
  "onboarding-tasks": "接入施工任务",
  "fault-incidents": "故障事件",
  "test-holds": "内部测试占用",
  "pool-bindings": "资源池绑定",
  "state-definitions": "生命周期状态字典",
  "transition-logs": "状态变更审计",
}
