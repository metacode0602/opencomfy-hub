'use client'

import { cn } from '@workspace/ui/lib/utils'
import { useAuthStore } from '@/lib/stores/auth-store'
import { EmailLoginForm } from '@/components/auth/email-login-form'
import { PhoneLoginForm } from '@/components/auth/phone-login-form'

export interface UnifiedLoginFormProps {
  className?: string
  callbackUrl?: string
  defaultMode?: 'phone' | 'email'
}

export const UnifiedLoginForm = ({ className, callbackUrl }: UnifiedLoginFormProps) => {
  const { authMode } = useAuthStore()
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {authMode === 'phone' && <PhoneLoginForm callbackUrl={callbackUrl} />}
      {authMode === 'email' && <EmailLoginForm callbackUrl={callbackUrl} />}
    </div>
  )
}
