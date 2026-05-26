/** B 端客户经营与 CRM 域 — 前端 mock 模型（v3.0 Customer / Project / PlatformTenant） */

export type JsonObject = Record<string, unknown>

export type Customer = {
  id: string
  customer_code: string
  name: string
  account_name: string
  status: string
  type: string
  lifecycle_phase: string
  expected_scale: JsonObject | null
  observed_scale_summary: JsonObject | null
  test_started_on: string | null
  test_completed_on: string | null
  conversion_date: string | null
  conversion_trigger: string | null
  created_at: string
  updated_at: string
}

/** 业务线主数据 */
export type BusinessLine = {
  id: string
  code: string
  name: string
  description: string | null
  sort_order: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

/** 项目关联的平台计费租户 */
export type ProjectTenant = {
  id: string
  project_id: string
  tenant_id: string
  binding_label: string
  binding_role: string | null
  sort_order: number
  created_at: string
}

export type UserStaff = {
  id: string
  employee_no: string | null
  display_name: string
  mobile: string
  email: string | null
  status: string
  department: string | null
  position: string | null
  roles: string[]
  is_default_pre_sales: boolean
  is_default_account_manager: boolean
  is_default_delivery_manager: boolean
  is_default_project_manager: boolean
  auth_user_id?: string | null
}

export type AccountManagerAssignment = {
  id: string
  customer_id: string
  user_staff_id: string
  role_type: string
  effective_from: string
  effective_to: string | null
  created_at: string
}

export type TestVoucherIssue = {
  id: string
  customer_id: string
  operator_id: string | null
  issued_at: string
  issue_status: string
  coupon_id: string | null
  coupon_config: JsonObject | null
  remark: string | null
}

export type LifecycleMilestone = {
  id: string
  customer_id: string
  milestone_type: string
  milestone_date: string
  filled_by: string | null
  filled_at: string
  notes: string | null
}

export type MilestoneEvidence = {
  id: string
  lifecycle_milestone_id: string
  file_name: string
  storage_uri: string
  file_hash: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export type ContractSnapshot = {
  id: string
  customer_id: string
  contract_no: string | null
  contract_url: string | null
  signed_on: string | null
  amount_summary: string | null
  external_crm_id: string | null
}

export type RechargeOrder = {
  id: string
  tenant_id: string
  amount: string
  currency: string
  status: string
  type: string
  paid_at: string | null
  external_trade_no: string | null
}

export type ConsumptionUsageDaily = {
  id: string
  tenant_id: string
  usage_date: string
  product_line: string | null
  unit: string | null
  amount: string | null
  gpu_seconds: string | null
}

export type ConversionRecord = {
  id: string
  customer_id: string
  conversion_date: string
  trigger_type: string
  candidate_signed_on: string | null
  candidate_scale_met_on: string | null
  candidate_recharge_ge_threshold_at: string | null
  computed_at: string
}

export type CalendarWorkday = {
  id: string
  calendar_date: string
  is_workday: boolean
  region_code: string
}

export type ActivityTypeDefinition = {
  id: string
  type_code: string
  display_name: string
  category: string | null
  is_platform_projection: boolean
  sort_order: number | null
}

export type AccountActivity = {
  id: string
  customer_id: string
  tenant_id: string | null
  activity_type_id: string | null
  occurred_at: string
  ref_domain: string | null
  ref_id: string | null
  idempotency_key: string | null
  actor_user_id: string | null
  title_snapshot: string | null
  summary_snapshot: string | null
  payload: JsonObject | null
  visibility: string | null
}

export type EngagementDocument = {
  id: string
  customer_id: string
  uploaded_by: string
  title: string
  version_no: number
  storage_uri: string
  visibility: string
  created_at: string
}

export type FollowUpTask = {
  id: string
  customer_id: string
  project_id: string | null
  assignee_id: string | null
  source_account_activity_id: string | null
  title: string
  status: string
  due_on: string | null
  completed_at: string | null
  completion_note: string | null
}

export type EngagementComment = {
  id: string
  customer_id: string
  account_activity_id: string
  author_id: string
  parent_comment_id: string | null
  body: string
  created_at: string
}

export const customerRelationKeys = [
  "bindings",
  "assignments",
  "vouchers",
  "milestones",
  "evidences",
  "contracts",
  "recharges",
  "usage-daily",
  "conversion",
  "activities",
  "documents",
  "tasks",
  "comments",
] as const

export type CustomerRelationKey = (typeof customerRelationKeys)[number]

export function isCustomerRelationKey(v: string): v is CustomerRelationKey {
  return (customerRelationKeys as readonly string[]).includes(v)
}

export function calendarWorkdayRecordId(w: Pick<CalendarWorkday, "region_code" | "calendar_date">) {
  return `${w.region_code}__${w.calendar_date}`
}

export function parseCalendarWorkdayRecordId(id: string): {
  region_code: string
  calendar_date: string
} | null {
  const i = id.indexOf("__")
  if (i <= 0) return null
  return { region_code: id.slice(0, i), calendar_date: id.slice(i + 2) }
}
