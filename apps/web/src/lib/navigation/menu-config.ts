import type { AppRole } from '@/lib/auth/app-role'
import type { ReactNode } from 'react'

export type MenuItem = {
  title: string
  url: string
  icon: ReactNode
  roles: AppRole[]
}

export type MenuSection = {
  key: string
  label?: string
  items: MenuItem[]
}

export function filterMenuItems(items: MenuItem[], role: AppRole | null): MenuItem[] {
  if (!role) return []
  return items.filter((item) => item.roles.includes(role))
}

export function filterMenuSections(sections: MenuSection[], role: AppRole | null): MenuSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: filterMenuItems(section.items, role),
    }))
    .filter((section) => section.items.length > 0)
}
