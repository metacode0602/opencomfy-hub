'use client'

import { LocaleLink, useLocalePathname } from '@/lib/i18n/navigation'
import { cn } from '@workspace/ui/lib/utils'
import type { Merchant } from '@/lib/types/merchant'

const tabs = [
  { href: (id: string) => `/merchant/${id}`, label: '概览', exact: true },
  // { href: (id: string) => `/merchant/${id}/tenants`, label: '关联租户', exact: false },
  { href: (id: string) => `/merchant/${id}/regions`, label: '机房区域', exact: false },
  { href: (id: string) => `/merchant/${id}/pricing`, label: '进货价', exact: false },
  { href: (id: string) => `/merchant/${id}/recharge`, label: '充值记录', exact: false },
  // { href: (id: string) => `/merchant/${id}/consumption`, label: '消耗', exact: false },
] as const

export function MerchantDetailNav({ merchant }: { merchant: Merchant }) {
  const pathname = useLocalePathname()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <LocaleLink
            href="/merchant"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 商户列表
          </LocaleLink>
          <h1 className="text-2xl font-semibold">{merchant.name}</h1>
          <p className="text-sm text-muted-foreground">{merchant.companyFullName}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => {
          const href = tab.href(merchant.id)
          const active = tab.exact ? pathname === href : pathname.startsWith(href)
          return (
            <LocaleLink
              key={href}
              href={href}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </LocaleLink>
          )
        })}
      </nav>
    </div>
  )
}
