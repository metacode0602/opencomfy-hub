'use client'

import { buttonVariants } from '@workspace/ui/components/button'
import { LocaleLink } from '@/lib/i18n/navigation'
import { cn } from '@workspace/ui/lib/utils'

interface BottomLinkProps {
  href: string
  label: string
}

export const BottomLink = ({ href, label }: BottomLinkProps) => {
  return (
    <LocaleLink
      href={href}
      className={cn(
        buttonVariants({ variant: 'link', size: 'sm' }),
        'w-full font-normal text-muted-foreground underline-offset-4 hover:text-primary hover:underline'
      )}
    >
      {label}
    </LocaleLink>
  )
}
