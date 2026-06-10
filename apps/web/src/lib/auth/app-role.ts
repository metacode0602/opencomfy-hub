export const APP_ROLES = ['admin', 'user', 'member'] as const

export type AppRole = (typeof APP_ROLES)[number]

export function normalizeAppRole(role: string | null | undefined): AppRole | null {
  if (role === 'admin' || role === 'user' || role === 'member') return role
  return null
}

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value)
}
