'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card'
import { FormInputPassword } from '@/components/features/form/form-input'
import { authClient } from '@/lib/auth-client'
import { trpc } from '@/lib/trpc/client'
import {
  createPasswordPolicySchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordPolicyMessage,
} from '@workspace/auth'

const schema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码'),
    newPassword: createPasswordPolicySchema(),
    confirmPassword: z.string().min(1, '请确认新密码'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function ChangePasswordForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const completePasswordChange = trpc.firstLogin.completePasswordChange.useMutation()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(values: FormValues) {
    if (values.newPassword === values.currentPassword) {
      form.setError('newPassword', { message: passwordPolicyMessage('sameAsCurrent') })
      return
    }

    setPending(true)
    try {
      await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
        fetchOptions: {
          onError(context) {
            throw new Error(context.error.message ?? '修改密码失败')
          },
        },
      })
      await completePasswordChange.mutateAsync()
      toast.success('密码已更新，请继续使用系统')
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '修改密码失败')
    } finally {
      setPending(false)
    }
  }

  const loading = pending || form.formState.isSubmitting

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>首次登录，请修改密码</CardTitle>
        <CardDescription>
          管理员为您创建的账号使用了系统默认密码，请先设置个人密码后再进入系统。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormInputPassword
            control={form.control}
            name="currentPassword"
            label="当前密码"
            disabled={loading}
          />
          <FormInputPassword
            control={form.control}
            name="newPassword"
            label="新密码"
            disabled={loading}
          />
          <FormInputPassword
            control={form.control}
            name="confirmPassword"
            label="确认新密码"
            disabled={loading}
          />
          <p className="text-muted-foreground text-xs leading-relaxed">
            密码须为 {PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH} 位，并包含大写字母、小写字母、数字和特殊字符。
          </p>
          <Button type="submit" className="w-full" disabled={loading}>
            确认修改
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
