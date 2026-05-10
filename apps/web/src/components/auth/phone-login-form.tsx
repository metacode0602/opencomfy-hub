'use client'

import { AuthCard } from '@/components/auth/auth-card'
import { SmsSliderCaptcha } from '@/components/auth/sms-slider-captcha'
import { FormError } from '@/components/shared/form-error'
import { FormSuccess } from '@/components/shared/form-success'
import { Button } from '@workspace/ui/components/button'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/ui/components/field'
import { Input } from '@workspace/ui/components/input'
import { authClient } from '@/lib/auth-client'
import { getUrlWithLocaleInCallbackUrl } from '@/lib/utils/urls'
import { cn } from '@workspace/ui/lib/utils'
import { Routes } from '@/lib/routes'
import { websiteConfig } from '@/lib/config/website'
import { useAuthStore } from '@/lib/stores/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon, SmartphoneIcon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useId, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
export interface PhoneLoginFormProps {
  className?: string
  callbackUrl?: string
}

export const PhoneLoginForm = ({ className, callbackUrl: propCallbackUrl }: PhoneLoginFormProps) => {
  const t = useTranslations('AuthPage.phoneLogin')
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const paramCallbackUrl = searchParams.get('callbackUrl')
  const locale = useLocale()
  const defaultCallbackUrl = getUrlWithLocaleInCallbackUrl(websiteConfig.routes.defaultLoginRedirect, locale)
  const callbackUrl = propCallbackUrl || paramCallbackUrl || defaultCallbackUrl
  const router = useRouter()
  const { setAuthMode } = useAuthStore()
  const [error, setError] = useState<string | undefined>('')
  const [success, setSuccess] = useState<string | undefined>('')
  const [isPending, setIsPending] = useState(false)
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [codeSent, setCodeSent] = useState(false)
  const [captchaOpen, setCaptchaOpen] = useState(false)
  const formId = useId()

  const phoneRegex = /^1[3-9]\d{9}$/

  const phoneLoginSchema = useMemo(
    () =>
      z.object({
        phoneNumber: z
          .string()
          .min(1, { message: t('phoneRequired') })
          .regex(phoneRegex, { message: t('invalidPhone') }),
        verificationCode: z.string().min(1, { message: t('codeRequired') }),
        invitationCode: z.string().optional(),
      }),
    [t]
  )

  const form = useForm<z.infer<typeof phoneLoginSchema>>({
    resolver: zodResolver(phoneLoginSchema),
    defaultValues: {
      phoneNumber: '',
      verificationCode: '',
      invitationCode: '',
    },
  })

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const sendVerificationCode = async (captchaToken?: string) => {
    const phoneNumber = form.getValues('phoneNumber')

    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      form.setError('phoneNumber', { message: t('invalidPhone') })
      return
    }

    setIsSendingCode(true)
    setError('')

    try {
      await authClient.phoneNumber.sendOtp(
        { phoneNumber },
        {
          headers:
            captchaToken != null
              ? { 'x-temp-captcha-token': captchaToken }
              : undefined,
          onRequest: () => {
            setIsSendingCode(true)
          },
          onResponse: () => {
            setIsSendingCode(false)
          },
          onSuccess: () => {
            setCodeSent(true)
            setSuccess(t('codeSent'))
            setCountdown(60)
            form.setFocus('verificationCode')
          },
          onError: (ctx) => {
            console.error('send code error:', ctx.error)
            const msg =
              ctx.error?.message ??
              `${ctx.error?.status ?? ''}: ${String(ctx.error?.message ?? '')}`
            setError(msg || t('sendCodeFailed'))
          },
        }
      )
    } catch (error) {
      console.error('send code error:', error)
      setError(t('sendCodeFailed'))
      setIsSendingCode(false)
    }
  }

  const onSubmit = async (values: z.infer<typeof phoneLoginSchema>) => {
    setIsPending(true)
    setError('')
    setSuccess('')
    try {
      const { data: result, error } = await authClient.phoneNumber.verify(
        {
          phoneNumber: values.phoneNumber,
          code: values.verificationCode,
        },
        {
          headers: values.invitationCode ? {
            'x-invitation-code': values.invitationCode
          } : undefined,
        }
      )
      console.warn('[phone-signin] [onVerificationSubmit] result', result, error)
      if (error && error?.code !== 'SUCCESS') {
        toast.error('验证失败', { description: error?.message })
      } else {
        toast.success('验证成功')
        // 验证成功，可以跳转到首页或其他页面
        console.log('验证成功')
        router.push(callbackUrl ?? '/dashboard')
      }
    } catch (error) {
      console.error('验证码验证失败:', error)
    } finally {
      setIsPending(false)
    }
  }

  const canSendCode = countdown === 0 && !isSendingCode
  const phoneNumber = form.watch('phoneNumber')

  return (
    <AuthCard
      headerLabel={t('welcomeBack')}
      bottomButtonLabel={t('signUpHint')}
      bottomButtonHref={`${Routes.Register}`}
      className={cn('', className)}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6 p-6'>
        <FieldGroup className='gap-4'>
          <Controller
            name='phoneNumber'
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-phone`}>{t('phoneNumber')}</FieldLabel>
                <div className='relative'>
                  <Input
                    {...field}
                    id={`${formId}-phone`}
                    disabled={isPending || isSendingCode}
                    placeholder='请输入手机号'
                    type='tel'
                    className='pl-10'
                    aria-invalid={fieldState.invalid}
                    autoComplete='tel-national'
                  />
                  <SmartphoneIcon className='-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-muted-foreground' />
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <div className='flex gap-2'>
            <Controller
              name='verificationCode'
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className='flex-1' data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${formId}-code`}>{t('verificationCode')}</FieldLabel>
                  <Input
                    {...field}
                    id={`${formId}-code`}
                    disabled={isPending || isSendingCode}
                    placeholder='请输入验证码'
                    type='text'
                    maxLength={6}
                    inputMode='numeric'
                    aria-invalid={fieldState.invalid}
                    autoComplete='one-time-code'
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <div className='flex flex-col justify-end'>
              <Button
                type='button'
                variant='outline'
                disabled={!canSendCode || !phoneNumber || !phoneRegex.test(phoneNumber)}
                onClick={() => {
                  if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
                    form.setError('phoneNumber', { message: t('invalidPhone') })
                    return
                  }
                  setCaptchaOpen(true)
                }}
                className='h-10 px-3'
              >
                {isSendingCode && <Loader2Icon className='mr-2 h-4 w-4 animate-spin' />}
                {countdown > 0 ? t('countdown', { seconds: countdown }) : t('sendCode')}
              </Button>
            </div>
          </div>

          <Controller
            name='invitationCode'
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-invite`}>邀请码 (可选)</FieldLabel>
                <Input
                  {...field}
                  id={`${formId}-invite`}
                  disabled={isPending}
                  placeholder='邀请码，仅新用户注册可用'
                  aria-invalid={fieldState.invalid}
                  autoComplete='off'
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>

        <div className='text-center text-muted-foreground text-xs'>
          {t('autoCreateAccount')}
          {/* <br /> */}
          {/* <span className='text-primary text-xs'>{t('invitationCodeHint')}</span> */}
        </div>

        <FormError message={error || urlError || undefined} />
        <FormSuccess message={success} />

        <Button
          disabled={isPending || !codeSent}
          size='lg'
          type='submit'
          className='flex w-full cursor-pointer items-center justify-center gap-2'
        >
          {isPending && <Loader2Icon className='mr-2 size-4 animate-spin' />}
          <span>{t('signIn')}</span>
        </Button>
      </form>

      <SmsSliderCaptcha
        open={captchaOpen}
        onOpenChange={setCaptchaOpen}
        onVerified={(token) => {
          void sendVerificationCode(token)
        }}
      />

      <div className='mt-4 text-center'>
        <Button
          variant='link'
          className='text-muted-foreground text-sm hover:text-primary'
          onClick={() => setAuthMode('email')}
        >
          {t('switchToEmail')}
        </Button>
      </div>
    </AuthCard>
  )
}
