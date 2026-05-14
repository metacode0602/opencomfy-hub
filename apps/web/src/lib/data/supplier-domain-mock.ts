import type {
  AccessConditionSheet,
  ComputeNode,
  EntityStateTransitionLog,
  FaultIncident,
  InternalTestHold,
  LifecycleStateDefinition,
  OnboardingBatch,
  OnboardingTask,
  ResourcePoolBinding,
  Supplier,
  SupplierContract,
  SupplierDevice,
  SupplierTermsVersion,
  SupplierUnitCost,
} from "@/lib/types/supplier-domain"

const supA = "sup-huabei-01"
const supB = "sup-huanan-01"
const conA1 = "con-hb-2025-001"
const conA2 = "con-hb-2025-002"
const conB1 = "con-hn-2026-001"
const tvA1 = "tv-hb-deal-01"
const tvA2 = "tv-con-a1-v1"
const uc1 = "uc-hb-a100-80g"
const acsA1v1 = "acs-hb-001-v1"
const acsA1v2 = "acs-hb-001-v2"
const batch1 = "batch-hb-2026-q1"
const dev1 = "dev-sn-8f2a91"
const dev2 = "dev-sn-7c11aa"
const node1 = "node-dev1-w01"
const node2 = "node-dev2-cp"

export type SupplierDomainSeed = {
  suppliers: Supplier[]
  contracts: SupplierContract[]
  termsVersions: SupplierTermsVersion[]
  unitCosts: SupplierUnitCost[]
  accessSheets: AccessConditionSheet[]
  onboardingBatches: OnboardingBatch[]
  devices: SupplierDevice[]
  computeNodes: ComputeNode[]
  onboardingTasks: OnboardingTask[]
  faultIncidents: FaultIncident[]
  internalTestHolds: InternalTestHold[]
  resourcePoolBindings: ResourcePoolBinding[]
  lifecycleStateDefinitions: LifecycleStateDefinition[]
  entityStateTransitionLogs: EntityStateTransitionLog[]
}

export const supplierDomainSeed: SupplierDomainSeed = {
  suppliers: [
    {
      id: supA,
      code: "HB-GPU-01",
      name: "华北智算科技有限公司",
      short_name: "华北智算",
    },
    {
      id: supB,
      code: "HN-DC-02",
      name: "华南云联数据中心有限公司",
      short_name: "华南云联",
    },
  ],

  contracts: [
    {
      id: conA1,
      supplier_id: supA,
      contract_no: "HB-ACC-2025-001",
      contract_url: "https://example.com/contracts/hb-001",
      status: "生效",
      effective_from: "2025-06-01",
      effective_to: "2028-05-31",
    },
    {
      id: conA2,
      supplier_id: supA,
      contract_no: "HB-ACC-2025-002",
      contract_url: "https://example.com/contracts/hb-002",
      status: "草稿",
      effective_from: "2026-01-01",
      effective_to: "2026-12-31",
    },
    {
      id: conB1,
      supplier_id: supB,
      contract_no: "HN-ACC-2026-001",
      contract_url: "https://example.com/contracts/hn-001",
      status: "生效",
      effective_from: "2026-02-01",
      effective_to: "2029-01-31",
    },
  ],

  termsVersions: [
    {
      id: tvA1,
      supplier_id: supA,
      contract_id: null,
      deal_mode: "卡时计价",
      terms_json: { currency: "CNY", min_commit_hours: 100 },
      effective_from: "2025-06-01T00:00:00.000Z",
      effective_to: null,
    },
    {
      id: tvA2,
      supplier_id: null,
      contract_id: conA1,
      deal_mode: "阶梯分成",
      terms_json: { tiers: [0.72, 0.75, 0.78], breakpoint_gpu_hours: [1000, 5000] },
      effective_from: "2025-06-01T00:00:00.000Z",
      effective_to: null,
    },
  ],

  unitCosts: [
    {
      id: uc1,
      supplier_terms_version_id: tvA1,
      supplier_id: supA,
      idc_code: "HB-BJ-DC1",
      card_type: "A100-80G",
      unit_cost: "18.5000",
      percent: null,
      tier_json: null,
    },
  ],

  accessSheets: [
    {
      id: acsA1v1,
      contract_id: conA1,
      version_no: 1,
      is_current: false,
      gpu_network_cpu_terms: {
        gpu: "NVLink 全互联",
        network: "200G RoCE",
        cpu: "双路 64C",
      },
    },
    {
      id: acsA1v2,
      contract_id: conA1,
      version_no: 2,
      is_current: true,
      gpu_network_cpu_terms: {
        gpu: "同 v1 + 液冷机柜",
        network: "同 v1",
        cpu: "同 v1",
      },
    },
  ],

  onboardingBatches: [
    {
      id: batch1,
      contract_id: conA1,
      access_condition_sheet_id: acsA1v2,
      batch_code: "ONB-2026-Q1-HB",
      batch_status: "接入中",
      planned_ready_at: "2026-06-01T10:00:00.000Z",
    },
  ],

  devices: [
    {
      id: dev1,
      supplier_id: supA,
      contract_id: conA1,
      onboarding_batch_id: batch1,
      asset_no: "AST-HB-00091",
      sn: "8F2A91C2",
      lifecycle_status: "接入中",
      onboarding_substage: "上架布线",
      idc_region: "华北-北京",
      idc_code: "HB-BJ-DC1",
      gpu_count: "8",
      card_type: "A100-80G",
      external_ip: "203.0.113.10",
      internal_ip: "10.20.30.40",
    },
    {
      id: dev2,
      supplier_id: supA,
      contract_id: conA1,
      onboarding_batch_id: batch1,
      asset_no: "AST-HB-00092",
      sn: "7C11AA01",
      lifecycle_status: "在线",
      onboarding_substage: "已完成",
      idc_region: "华北-北京",
      idc_code: "HB-BJ-DC1",
      gpu_count: "8",
      card_type: "A100-80G",
      external_ip: "203.0.113.11",
      internal_ip: "10.20.30.41",
    },
  ],

  computeNodes: [
    {
      id: node1,
      device_id: dev1,
      node_role: "Worker",
      mgmt_ip: "10.20.30.50",
      cluster_id: "cls-hb-prod-01",
      lifecycle_status: "接入中",
    },
    {
      id: node2,
      device_id: dev2,
      node_role: "Worker",
      mgmt_ip: "10.20.30.51",
      cluster_id: "cls-hb-prod-01",
      lifecycle_status: "在线",
    },
  ],

  onboardingTasks: [
    {
      id: "task-rack-01",
      onboarding_batch_id: batch1,
      device_id: dev1,
      task_type: "上架验收",
      assignee_id: "staff-mock-01",
      task_status: "进行中",
      started_at: "2026-05-01T08:00:00.000Z",
      finished_at: null,
    },
    {
      id: "task-batch-01",
      onboarding_batch_id: batch1,
      device_id: null,
      task_type: "批次联调",
      assignee_id: "staff-mock-02",
      task_status: "待开始",
      started_at: null,
      finished_at: null,
    },
  ],

  faultIncidents: [
    {
      id: "fault-001",
      device_id: dev2,
      compute_node_id: null,
      severity: "P2",
      incident_status: "已关闭",
      resolution_outcome: "更换光模块后恢复",
      opened_at: "2026-04-12T09:00:00.000Z",
      closed_at: "2026-04-12T14:30:00.000Z",
    },
    {
      id: "fault-002",
      device_id: null,
      compute_node_id: node1,
      severity: "P3",
      incident_status: "处理中",
      resolution_outcome: "",
      opened_at: "2026-05-10T11:00:00.000Z",
      closed_at: null,
    },
  ],

  internalTestHolds: [
    {
      id: "hold-001",
      device_id: dev1,
      compute_node_id: null,
      scope: "GPU0-GPU3",
      hold_from: "2026-05-02T00:00:00.000Z",
      hold_until: "2026-05-09T23:59:59.000Z",
    },
  ],

  resourcePoolBindings: [
    {
      id: "rpb-001",
      device_id: dev2,
      resource_pool_id: "pool-hb-gpu-a",
      pool_code: null,
      workload_profile: "JOB",
      is_exclusive_pool: false,
    },
  ],

  lifecycleStateDefinitions: [
    {
      id: "lsd-dev-online",
      domain: "device",
      state_code: "online",
      display_name: "在线",
      sort_order: 40,
    },
    {
      id: "lsd-dev-onb",
      domain: "device",
      state_code: "onboarding",
      display_name: "接入中",
      sort_order: 20,
    },
    {
      id: "lsd-node-online",
      domain: "compute_node",
      state_code: "online",
      display_name: "在线",
      sort_order: 30,
    },
  ],

  entityStateTransitionLogs: [
    {
      id: "esl-001",
      entity_type: "device",
      entity_id: dev2,
      from_state: "接入中",
      to_state: "在线",
      operator_id: "staff-mock-01",
      reason_code: "ONBOARDING_DONE",
      occurred_at: "2026-04-20T16:00:00.000Z",
    },
    {
      id: "esl-002",
      entity_type: "compute_node",
      entity_id: node1,
      from_state: "待接入",
      to_state: "接入中",
      operator_id: "staff-mock-02",
      reason_code: "AGENT_REGISTERED",
      occurred_at: "2026-05-03T10:12:00.000Z",
    },
  ],
}
