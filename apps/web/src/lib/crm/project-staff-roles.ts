export const PROJECT_STAFF_ROLE_TYPES = [
  'pre_sales',
  'account_manager',
  'delivery_manager',
  'project_manager',
] as const

export type ProjectStaffRoleType = (typeof PROJECT_STAFF_ROLE_TYPES)[number]

export const PROJECT_STAFF_ROLE_LABELS: Record<ProjectStaffRoleType, string> = {
  pre_sales: '售前经理',
  account_manager: '客户经理',
  delivery_manager: '交付经理',
  project_manager: '项目经理',
}
