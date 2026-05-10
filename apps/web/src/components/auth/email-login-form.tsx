'use client'

import { AuthCard } from '@/components/auth/auth-card'
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
import { LocaleLink } from '@/lib/i18n/navigation'
import { authClient } from '@/lib/auth-client'
import { getUrlWithLocaleInCallbackUrl } from '@/lib/utils/urls'
import { cn } from '@workspace/ui/lib/utils'
import { Routes } from '@/lib/routes'
import { websiteConfig } from '@/lib/config/website'
import { useAuthStore } from '@/lib/stores/auth-store'
import { zodResolver } from '@hookform/resolvers/zod'
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useId, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'
import { SocialLoginButton } from './social-login-button'

export interface EmailLoginFormProps {
  className?: string
  callbackUrl?: string
}

export const EmailLoginForm = ({ className, callbackUrl: propCallbackUrl }: EmailLoginFormProps) => {
  const t = useTranslations('AuthPage.login')
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const paramCallbackUrl = searchParams.get('callbackUrl')
  // Use prop callback URL or param callback URL if provided, otherwise use the default login redirect
  const locale = useLocale()
  const defaultCallbackUrl = getUrlWithLocaleInCallbackUrl(websiteConfig.routes.defaultLoginRedirect, locale)
  const callbackUrl = propCallbackUrl || paramCallbackUrl || defaultCallbackUrl
  console.log('login form, callbackUrl', callbackUrl)

  const [error, setError] = useState<string | undefined>('')
  const [success, setSuccess] = useState<string | undefined>('')
  const [isPending, setIsPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { setAuthMode } = useAuthStore()
  const formId = useId()

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email({
          message: t('emailRequired'),
        }),
        password: z.string().min(1, {
          message: t('passwordRequired'),
        }),
      }),
    [t]
  )

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    // 1. if callbackUrl is provided, user will be redirected to the callbackURL after login successfully.
    // if user email is not verified, a new verification email will be sent to the user with the callbackURL.
    // 2. if callbackUrl is not provided, we should redirect manually in the onSuccess callback.
    await authClient.signIn.email(
      {
        email: values.email,
        password: values.password,
        callbackURL: callbackUrl,
      },
      {
        onRequest: (ctx) => {
          // console.log("login, request:", ctx.url);
          setIsPending(true)
          setError('')
          setSuccess('')
        },
        onResponse: (ctx) => {
          // console.log("login, response:", ctx.response);
          setIsPending(false)
        },
        onSuccess: (ctx) => {
          // console.log("login, success:", ctx.data);
          // setSuccess("Login successful");
          // router.push(callbackUrl || "/dashboard");
        },
        onError: (ctx) => {
          console.error('login, error:', ctx.error)
          setError(`${ctx.error.status}: ${ctx.error.message}`)
        },
      }
    )
  }

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev)
  }

  return (
    <AuthCard
      headerLabel={t('welcomeBack')}
      bottomButtonLabel={t('signUpHint')}
      bottomButtonHref={`${Routes.Register}`}
      className={cn('', className)}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
        <FieldGroup className='gap-4'>
          <Controller
            name='email'
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-email`}>{t('email')}</FieldLabel>
                <Input
                  {...field}
                  id={`${formId}-email`}
                  disabled={isPending}
                  placeholder='name@example.com'
                  type='email'
                  aria-invalid={fieldState.invalid}
                  autoComplete='email'
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name='password'
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className='flex items-center justify-between gap-2'>
                  <FieldLabel htmlFor={`${formId}-password`}>{t('password')}</FieldLabel>
                  <Button size='sm' variant='link' asChild className='shrink-0 px-0 font-normal text-muted-foreground'>
                    <LocaleLink
                      href={`${Routes.ForgotPassword}`}
                      className='text-xs hover:text-primary hover:underline hover:underline-offset-4'
                    >
                      {t('forgotPassword')}
                    </LocaleLink>
                  </Button>
                </div>
                <div className='relative'>
                  <Input
                    {...field}
                    id={`${formId}-password`}
                    disabled={isPending}
                    placeholder='******'
                    type={showPassword ? 'text' : 'password'}
                    className='pr-10'
                    aria-invalid={fieldState.invalid}
                    autoComplete='current-password'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent'
                    onClick={togglePasswordVisibility}
                    disabled={isPending}
                  >
                    {showPassword ? (
                      <EyeOffIcon className='size-4 text-muted-foreground' />
                    ) : (
                      <EyeIcon className='size-4 text-muted-foreground' />
                    )}
                    <span className='sr-only'>{showPassword ? t('hidePassword') : t('showPassword')}</span>
                  </Button>
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
        <FormError message={error || urlError || undefined} />
        <FormSuccess message={success} />
        <Button
          disabled={isPending}
          size='lg'
          type='submit'
          className='flex w-full cursor-pointer items-center justify-center gap-2'
        >
          {isPending && <Loader2Icon className='mr-2 size-4 animate-spin' />}
          <span>{t('signIn')}</span>
        </Button>
      </form>
      <div className='mt-4'>
        <SocialLoginButton callbackUrl={callbackUrl} />
      </div>
      <div className='mt-4 text-center'>
        <Button
          variant='link'
          onClick={() => setAuthMode('phone')}
          className='text-muted-foreground text-sm hover:text-primary'
        >
          {t('switchToPhone')}
        </Button>
      </div>
    </AuthCard>
  )
}
