'use client'

import { usePathname } from 'next/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex-1 flex flex-col min-w-0 mx-4 my-4 pb-4">
      {/* Content */}
      {children}
    </div>
  )
}
