/** 员工部门枚举 */
export const STAFF_DEPARTMENTS = [
  '中台',
  '运营中心',
  '产品',
  '研发',
  '运维',
  '销售',
] as const

export type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number]

/** 应用角色（可多选，用于员工主数据） */
export const STAFF_APP_ROLES = [
  { value: 'admin', label: '管理员' },
  { value: 'user', label: '用户' },
  { value: 'member', label: '成员' },
] as const

export type StaffAppRole = (typeof STAFF_APP_ROLES)[number]['value']

/** 项目四人组默认标记 */
export const STAFF_DEFAULT_MANAGER_FIELDS = [
  { key: 'is_default_pre_sales', label: '默认售前经理', role: 'pre_sales' },
  { key: 'is_default_account_manager', label: '默认客户经理', role: 'account_manager' },
  { key: 'is_default_delivery_manager', label: '默认交付经理', role: 'delivery_manager' },
  { key: 'is_default_project_manager', label: '默认项目经理', role: 'project_manager' },
] as const

export type StaffDefaultManagerKey = (typeof STAFF_DEFAULT_MANAGER_FIELDS)[number]['key']

export type StaffDefaultManagerRole =
  (typeof STAFF_DEFAULT_MANAGER_FIELDS)[number]['role']

export function staffAppRoleLabel(role: string): string {
  return STAFF_APP_ROLES.find((r) => r.value === role)?.label ?? role
}

/** 员工勾选了应用角色即需要开通登录 */
export function staffRolesRequireLogin(roles?: string[] | null): boolean {
  return (roles?.length ?? 0) > 0
}

/** 员工应用角色 → Better Auth users.role */
export function resolveUserRoleFromStaffRoles(roles: string[]): 'admin' | 'user' {
  if (roles.includes('admin')) return 'admin'
  return 'user'
}

export function resolveDefaultStaffId(
  staff: readonly {
    id: string
    is_default_pre_sales?: boolean
    is_default_account_manager?: boolean
    is_default_delivery_manager?: boolean
    is_default_project_manager?: boolean
  }[],
  role: StaffDefaultManagerRole,
): string | undefined {
  const keyMap: Record<StaffDefaultManagerRole, StaffDefaultManagerKey> = {
    pre_sales: 'is_default_pre_sales',
    account_manager: 'is_default_account_manager',
    delivery_manager: 'is_default_delivery_manager',
    project_manager: 'is_default_project_manager',
  }
  const key = keyMap[role]
  return staff.find((s) => s[key])?.id
}
