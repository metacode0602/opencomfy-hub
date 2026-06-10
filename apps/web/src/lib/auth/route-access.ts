import type { AppRole } from '@/lib/auth/app-role'

export const ROUTE_ACCESS = {
  shared: ['/dashboard/flow', '/dashboard/global', '/crm/tenant-blacklist'],
  supply: ['/supplier'],
  crm: ['/crm'],
  crmAdminOnly: ['/crm/staff'],
  finance: [
    '/finance',
    '/merchant',
    '/supplier/gpu-card-types',
    '/supplier/platform-pricing',
    '/supplier/unit-costs',
  ],
  common: ['/dashboard', '/dashboard/history', '/settings', '/help', '/change-password'],
} as const

const FINANCE_SUPPLY_PATHS = new Set([
  '/supplier/gpu-card-types',
  '/supplier/platform-pricing',
  '/supplier/unit-costs',
])

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

function isSharedPath(path: string): boolean {
  return ROUTE_ACCESS.shared.some((prefix) => matchesPrefix(path, prefix))
}

function isCommonPath(path: string): boolean {
  return ROUTE_ACCESS.common.some((prefix) => matchesPrefix(path, prefix))
}

function isFinancePath(path: string): boolean {
  return ROUTE_ACCESS.finance.some((prefix) => matchesPrefix(path, prefix))
}

function isCrmAdminOnlyPath(path: string): boolean {
  return ROUTE_ACCESS.crmAdminOnly.some((prefix) => matchesPrefix(path, prefix))
}

function isCrmPath(path: string): boolean {
  return ROUTE_ACCESS.crm.some((prefix) => matchesPrefix(path, prefix))
}

function isSupplyPath(path: string): boolean {
  if (FINANCE_SUPPLY_PATHS.has(path) || [...FINANCE_SUPPLY_PATHS].some((p) => matchesPrefix(path, p))) {
    return false
  }
  return ROUTE_ACCESS.supply.some((prefix) => matchesPrefix(path, prefix))
}

export function defaultHomeForRole(role: AppRole): string {
  switch (role) {
    case 'admin':
      return '/dashboard'
    case 'member':
      return '/dashboard/global'
    case 'user':
      return '/crm/workbench'
  }
}

export function canAccessPath(role: AppRole, path: string): boolean {
  const normalized = path || '/'

  if (isSharedPath(normalized) || isCommonPath(normalized)) {
    return true
  }

  if (isFinancePath(normalized) || isCrmAdminOnlyPath(normalized)) {
    return role === 'admin'
  }

  if (isSupplyPath(normalized)) {
    return role === 'admin' || role === 'member'
  }

  if (isCrmPath(normalized)) {
    return role === 'admin' || role === 'user'
  }

  return true
}
