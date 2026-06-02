'use client'

import { BottomLink } from '@/components/auth/bottom-link'
import { Logo } from '@/components/layout/logo'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { LocaleLink } from '@/lib/i18n/navigation'
import { cn } from '@workspace/ui/lib/utils'

interface AuthCardProps {
  children: React.ReactNode
  headerLabel: string
  description?: string
  bottomButtonLabel?: string
  bottomButtonHref?: string
  className?: string
}

export const AuthCard = ({
  children,
  headerLabel,
  description,
  bottomButtonLabel,
  bottomButtonHref,
  className,
}: AuthCardProps) => {
  return (
    <Card className={cn('w-full border border-border shadow-xs', className)}>
      <CardHeader className='flex flex-col items-center gap-2 pb-2 text-center'>
        <LocaleLink href='/' prefetch={false}>
          <Logo className='size-10' />
        </LocaleLink>
        <div className='space-y-1'>
          <CardTitle className='text-xl font-semibold tracking-tight'>{headerLabel}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </CardHeader>
      <CardContent className='pt-0'>{children}</CardContent>
      {bottomButtonLabel && bottomButtonHref ? (
        <CardFooter>
          <BottomLink label={bottomButtonLabel} href={bottomButtonHref} />
        </CardFooter>
      ) : null}
    </Card>
  )
}
