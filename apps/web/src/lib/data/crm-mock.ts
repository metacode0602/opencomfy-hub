import { calendarWorkdayRecordId } from "@/lib/types/crm"
import type {
  AccountActivity,
  AccountManagerAssignment,
  ActivityTypeDefinition,
  BusinessLine,
  CalendarWorkday,
  ConsumptionUsageDaily,
  ContractSnapshot,
  ConversionRecord,
  EngagementComment,
  EngagementDocument,
  FollowUpTask,
  LifecycleMilestone,
  MilestoneEvidence,
  RechargeOrder,
  Customer,
  ProjectTenant,
  TestVoucherIssue,
  UserStaff,
} from "@/lib/types/crm"

export const crmMockCustomers: Customer[] = [
  {
    id: "t-001",
    customer_code: "ACME-BJ",
    name: "北京某某科技有限公司",
    account_name: "ACME 算力（华北）",
    status: "active",
    type: "B端",
    lifecycle_phase: "已转正",
    expected_scale: { target_gpu: "A100-80G", card_count: 32, note: "推理+训练混合" },
    observed_scale_summary: { last_sync: "2026-05-01", gpu_hours_mtd: 12040 },
    test_started_on: "2026-01-10",
    test_completed_on: "2026-02-28",
    conversion_date: "2026-03-15",
    conversion_trigger: "签约",
    created_at: "2026-01-05T08:00:00.000Z",
    updated_at: "2026-05-10T10:00:00.000Z",
  },
  {
    id: "t-002",
    customer_code: "START-SH",
    name: "上海初创智能有限公司",
    account_name: "星拓 AI 实验室",
    status: "trial",
    type: "B端",
    lifecycle_phase: "测试中",
    expected_scale: { target_gpu: "H100", card_count: 8 },
    observed_scale_summary: null,
    test_started_on: "2026-04-01",
    test_completed_on: null,
    conversion_date: null,
    conversion_trigger: "",
    created_at: "2026-03-28T09:30:00.000Z",
    updated_at: "2026-05-12T06:00:00.000Z",
  },
  {
    id: "t-003",
    customer_code: "ORIGINFLOW",
    name: "Originflow",
    account_name: "Originflow",
    status: "active",
    type: "B端",
    lifecycle_phase: "试用完成",
    expected_scale: null,
    observed_scale_summary: null,
    test_started_on: "2026-02-01",
    test_completed_on: "2026-04-15",
    conversion_date: null,
    conversion_trigger: "",
    created_at: "2026-02-01T08:00:00.000Z",
    updated_at: "2026-05-15T10:00:00.000Z",
  },
]

export const crmMockProjectTenants: ProjectTenant[] = [
  {
    id: "tb-001",
    project_id: "p-crm-originflow",
    tenant_id: "12724",
    binding_label: "兰天游账号",
    binding_role: "子商户",
    sort_order: 1,
    created_at: "2026-03-01T09:00:00.000Z",
  },
  {
    id: "tb-002",
    project_id: "p-crm-originflow",
    tenant_id: "15052",
    binding_label: "originflow独立商户",
    binding_role: "子商户",
    sort_order: 2,
    created_at: "2026-03-15T09:00:00.000Z",
  },
]

const now = "2026-05-18T00:00:00.000Z"

export const crmMockBusinessLines: BusinessLine[] = [
  {
    id: "bl-1",
    code: "short_rent",
    name: "短租业务",
    description: null,
    sort_order: 1,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: "bl-2",
    code: "full_rent",
    name: "整租业务",
    description: null,
    sort_order: 2,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: "bl-3",
    code: "delivery_project",
    name: "交付型项目",
    description: null,
    sort_order: 3,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: "bl-4",
    code: "merchant_project",
    name: "商户类项目",
    description: null,
    sort_order: 4,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: "bl-5",
    code: "compute_derivative",
    name: "算力衍生业务",
    description: null,
    sort_order: 5,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: "bl-6",
    code: "consumer_compute",
    name: "C端算力业务",
    description: null,
    sort_order: 6,
    status: "active",
    created_at: now,
    updated_at: now,
  },
  {
    id: "bl-7",
    code: "little_boy_plan",
    name: "小男孩计划",
    description: null,
    sort_order: 7,
    status: "active",
    created_at: now,
    updated_at: now,
  },
]

export const crmMockUserStaff: UserStaff[] = [
  {
    id: "s-001",
    employee_no: "E10001",
    display_name: "张敏",
    mobile: "13800001001",
    email: "zhangmin@example.com",
    status: "active",
  },
  {
    id: "s-002",
    employee_no: "E10002",
    display_name: "李航",
    mobile: "13800001002",
    email: "lihang@example.com",
    status: "active",
  },
  {
    id: "s-003",
    employee_no: "E10003",
    display_name: "王悦",
    mobile: "13800001003",
    email: null,
    status: "active",
  },
]

export const crmMockAssignments: AccountManagerAssignment[] = [
  {
    id: "am-001",
    customer_id: "t-001",
    user_staff_id: "s-001",
    role_type: "客户经理",
    effective_from: "2026-01-05T08:00:00.000Z",
    effective_to: null,
    created_at: "2026-01-05T08:05:00.000Z",
  },
  {
    id: "am-002",
    customer_id: "t-002",
    user_staff_id: "s-002",
    role_type: "客户经理",
    effective_from: "2026-03-28T09:30:00.000Z",
    effective_to: null,
    created_at: "2026-03-28T09:35:00.000Z",
  },
]

export const crmMockVouchers: TestVoucherIssue[] = [
  {
    id: "tv-001",
    customer_id: "t-001",
    operator_id: "s-001",
    issued_at: "2026-01-10T11:00:00.000Z",
    issue_status: "success",
    coupon_id: "cpn-ulid-001",
    coupon_config: { amount_cents: 500000, currency: "CNY" },
    remark: "首批测试券",
  },
  {
    id: "tv-002",
    customer_id: "t-002",
    operator_id: "s-002",
    issued_at: "2026-04-01T10:00:00.000Z",
    issue_status: "success",
    coupon_id: null,
    coupon_config: null,
    remark: null,
  },
]

export const crmMockMilestones: LifecycleMilestone[] = [
  {
    id: "lm-001",
    customer_id: "t-001",
    milestone_type: "TEST_COMPLETE",
    milestone_date: "2026-02-28",
    filled_by: "s-001",
    filled_at: "2026-02-28T18:00:00.000Z",
    notes: "测试阶段完成",
  },
  {
    id: "lm-002",
    customer_id: "t-002",
    milestone_type: "SCALE_MET",
    milestone_date: "2026-05-01",
    filled_by: "s-002",
    filled_at: "2026-05-01T12:00:00.000Z",
    notes: "达到小规模试用门槛",
  },
]

export const crmMockMilestoneEvidence: MilestoneEvidence[] = [
  {
    id: "me-001",
    lifecycle_milestone_id: "lm-001",
    file_name: "测试报告-202602.pdf",
    storage_uri: "s3://crm-evidence/t-001/lm-001/report.pdf",
    file_hash: "sha256:abcd",
    uploaded_by: "s-001",
    uploaded_at: "2026-02-28T18:10:00.000Z",
  },
]

export const crmMockContractSnapshots: ContractSnapshot[] = [
  {
    id: "cs-001",
    customer_id: "t-001",
    contract_no: "HT-2026-001",
    contract_url: "https://example.com/contracts/HT-2026-001",
    signed_on: "2026-03-10",
    amount_summary: "1200000.0000",
    external_crm_id: "SF-88921",
  },
  {
    id: "cs-002",
    customer_id: "t-002",
    contract_no: null,
    contract_url: null,
    signed_on: null,
    amount_summary: null,
    external_crm_id: null,
  },
]

export const crmMockRecharges: RechargeOrder[] = [
  {
    id: "ro-001",
    tenant_id: "t-001",
    amount: "50000.0000",
    currency: "CNY",
    status: "paid",
    type: "对公转账",
    paid_at: "2026-03-12T09:00:00.000Z",
    external_trade_no: "BANK-20260312-001",
  },
]

export const crmMockUsageDaily: ConsumptionUsageDaily[] = [
  {
    id: "cud-001",
    tenant_id: "t-001",
    usage_date: "2026-05-11",
    product_line: "gpu-inference",
    unit: "卡时",
    amount: "3200.5000",
    gpu_seconds: "11520000",
  },
]

export const crmMockConversion: ConversionRecord[] = [
  {
    id: "cr-001",
    customer_id: "t-001",
    conversion_date: "2026-03-15",
    trigger_type: "签约",
    candidate_signed_on: "2026-03-10",
    candidate_scale_met_on: "2026-03-01",
    candidate_recharge_ge_threshold_at: "2026-03-12T09:00:00.000Z",
    computed_at: "2026-03-15T00:30:00.000Z",
  },
]

const cw1: CalendarWorkday = {
  id: calendarWorkdayRecordId({ region_code: "CN", calendar_date: "2026-05-13" }),
  calendar_date: "2026-05-13",
  is_workday: true,
  region_code: "CN",
}
const cw2: CalendarWorkday = {
  id: calendarWorkdayRecordId({ region_code: "CN", calendar_date: "2026-05-01" }),
  calendar_date: "2026-05-01",
  is_workday: false,
  region_code: "CN",
}

export const crmMockCalendar: CalendarWorkday[] = [cw1, cw2]

export const crmMockActivityTypes: ActivityTypeDefinition[] = [
  {
    id: "atd-001",
    type_code: "WALLET_RECHARGE",
    display_name: "钱包充值",
    category: "PLATFORM",
    is_platform_projection: true,
    sort_order: 10,
  },
  {
    id: "atd-002",
    type_code: "FOLLOW_UP_NOTE",
    display_name: "内部跟进备注",
    category: "INTERNAL",
    is_platform_projection: false,
    sort_order: 90,
  },
]

export const crmMockActivities: AccountActivity[] = [
  {
    id: "aa-001",
    customer_id: "t-001",
    tenant_id: null,
    activity_type_id: "atd-001",
    occurred_at: "2026-03-12T09:05:00.000Z",
    ref_domain: "recharge_order",
    ref_id: "ro-001",
    idempotency_key: "ro-001:paid",
    actor_user_id: null,
    title_snapshot: "充值到账",
    summary_snapshot: "对公转账 5 万元已入账",
    payload: { order_id: "ro-001" },
    visibility: "internal",
  },
  {
    id: "aa-002",
    customer_id: "t-002",
    tenant_id: null,
    activity_type_id: "atd-002",
    occurred_at: "2026-05-02T15:00:00.000Z",
    ref_domain: null,
    ref_id: null,
    idempotency_key: null,
    actor_user_id: "s-002",
    title_snapshot: "客户沟通纪要",
    summary_snapshot: "确认下周扩容 8 卡",
    payload: {},
    visibility: "internal",
  },
  {
    id: "aa-003",
    customer_id: "t-001",
    tenant_id: null,
    activity_type_id: "atd-002",
    occurred_at: "2026-05-10T10:30:00.000Z",
    ref_domain: null,
    ref_id: null,
    idempotency_key: null,
    actor_user_id: "s-001",
    title_snapshot: "季度复盘会议",
    summary_snapshot: "对齐 Q2 算力用量与续费节奏",
    payload: { attendees: 4 },
    visibility: "internal",
  },
  {
    id: "aa-004",
    customer_id: "t-002",
    tenant_id: null,
    activity_type_id: "atd-001",
    occurred_at: "2026-05-17T08:00:00.000Z",
    ref_domain: "recharge_order",
    ref_id: "ro-002",
    idempotency_key: "ro-002:paid",
    actor_user_id: null,
    title_snapshot: "预充值到账",
    summary_snapshot: "线上支付 2 万元已入账",
    payload: { order_id: "ro-002" },
    visibility: "internal",
  },
  {
    id: "aa-005",
    customer_id: "t-001",
    tenant_id: null,
    activity_type_id: "atd-002",
    occurred_at: "2026-05-17T14:20:00.000Z",
    ref_domain: null,
    ref_id: null,
    idempotency_key: null,
    actor_user_id: "s-001",
    title_snapshot: "上线方案确认",
    summary_snapshot: "客户确认 v2 方案，下周一开始迁移",
    payload: {},
    visibility: "internal",
  },
  {
    id: "aa-006",
    customer_id: "t-002",
    tenant_id: null,
    activity_type_id: "atd-002",
    occurred_at: "2026-05-20T16:00:00.000Z",
    ref_domain: null,
    ref_id: null,
    idempotency_key: null,
    actor_user_id: "s-002",
    title_snapshot: "扩容报价跟进",
    summary_snapshot: "已发送 8 卡扩容报价，待客户签字",
    payload: {},
    visibility: "internal",
  },
]

export const crmMockDocuments: EngagementDocument[] = [
  {
    id: "ed-001",
    customer_id: "t-001",
    uploaded_by: "s-001",
    title: "上线方案 v2",
    version_no: 2,
    storage_uri: "s3://crm-docs/t-001/plan-v2.docx",
    visibility: "internal",
    created_at: "2026-04-01T08:00:00.000Z",
  },
]

export const crmMockTasks: FollowUpTask[] = [
  {
    id: "fut-001",
    customer_id: "t-002",
    project_id: null,
    assignee_id: "s-002",
    source_account_activity_id: "aa-002",
    title: "发送扩容报价单",
    status: "open",
    due_on: "2026-05-20",
    completed_at: null,
    completion_note: null,
  },
]

export const crmMockComments: EngagementComment[] = [
  {
    id: "ec-001",
    customer_id: "t-002",
    account_activity_id: "aa-002",
    author_id: "s-003",
    parent_comment_id: null,
    body: "已同步售前评估排期。",
    created_at: "2026-05-02T16:00:00.000Z",
  },
]

/** zustand 初始快照（与 store 字段一致） */
export const crmSeedState = {
  customers: crmMockCustomers,
  businessLines: crmMockBusinessLines,
  projectTenants: crmMockProjectTenants,
  userStaff: crmMockUserStaff,
  accountManagerAssignments: crmMockAssignments,
  testVoucherIssues: crmMockVouchers,
  lifecycleMilestones: crmMockMilestones,
  milestoneEvidence: crmMockMilestoneEvidence,
  contractSnapshots: crmMockContractSnapshots,
  rechargeOrders: crmMockRecharges,
  consumptionUsageDaily: crmMockUsageDaily,
  conversionRecords: crmMockConversion,
  calendarWorkdays: crmMockCalendar,
  activityTypeDefinitions: crmMockActivityTypes,
  accountActivities: crmMockActivities,
  engagementDocuments: crmMockDocuments,
  followUpTasks: crmMockTasks,
  engagementComments: crmMockComments,
}

export type CrmSeedState = typeof crmSeedState
