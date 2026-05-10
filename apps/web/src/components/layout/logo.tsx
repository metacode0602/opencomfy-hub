'use client'

import { LogoIcon } from '@workspace/ui/components/icons/logo'
import { Sparkles } from 'lucide-react'

export function Logo({ className }: { className?: string }) {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
      <Sparkles className="h-5 w-5 text-primary-foreground" />
    </div>
    // <LogoIcon className={className} />
    // <Image
    //   src={logo}
    //   alt="Logo"
    //   title="Logo"
    //   width={96}
    //   height={96}
    //   className={cn('size-8 rounded-md', className)}
    // />
  )
}
