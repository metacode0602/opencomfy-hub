'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@workspace/ui/components/dialog'
import { useLocaleRouter } from '@/lib/i18n/navigation'
import { Routes } from '@/lib/routes'
import { useEffect, useState } from 'react'
import { UnifiedLoginForm } from '@/components/auth/unified-login-form'

interface LoginWrapperProps {
  children: React.ReactNode
  mode?: 'modal' | 'redirect'
  asChild?: boolean
  callbackUrl?: string
}

export const LoginWrapper = ({ children, mode = 'redirect', asChild, callbackUrl }: LoginWrapperProps) => {
  const router = useLocaleRouter()
  const [mounted, setMounted] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleOpenChange = (newOpen: boolean) => {
    // 如果对话框要关闭，但页面当前不可见（可能是切换tab导致的），则阻止关闭
    if (!newOpen && document.hidden) {
      return
    }
    setIsModalOpen(newOpen)
  }

  const handleLogin = () => {
    // append callbackUrl as a query parameter if provided
    const loginPath = callbackUrl ? `${Routes.Login}?callbackUrl=${encodeURIComponent(callbackUrl)}` : `${Routes.Login}`
    console.log('login wrapper, loginPath', loginPath)
    router.push(loginPath)
  }

  // this is to prevent the login wrapper from being rendered on the server side
  // and causing a hydration error
  if (!mounted) {
    return null
  }

  if (mode === 'modal') {
    return (
      <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild={asChild}>{children}</DialogTrigger>
        <DialogContent className='p-0 sm:max-w-[400px]'>
          <DialogHeader className='hidden'>
            <DialogTitle />
          </DialogHeader>
          <DialogDescription className="sr-only">请输入手机号和验证码</DialogDescription>
          <UnifiedLoginForm callbackUrl={callbackUrl} className='border-none' />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <span onClick={handleLogin} className='cursor-pointer'>
      {children}
    </span>
  )
}
