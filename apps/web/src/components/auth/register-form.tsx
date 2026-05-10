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
import { authClient } from '@/lib/auth-client'
import { getUrlWithLocaleInCallbackUrl } from '@/lib/utils/urls'
import { Routes } from '@/lib/routes'
import { websiteConfig } from '@/lib/config/website'
import { zodResolver } from '@hookform/resolvers/zod'
import { EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { useId, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import * as z from 'zod'
import { SocialLoginButton } from './social-login-button'

interface RegisterFormProps {
  callbackUrl?: string
}

export const RegisterForm = ({ callbackUrl: propCallbackUrl }: RegisterFormProps) => {
  const t = useTranslations('AuthPage.register')
  const searchParams = useSearchParams()
  const paramCallbackUrl = searchParams.get('callbackUrl')
  // Use prop callback URL or param callback URL if provided, otherwise use the default login redirect
  const locale = useLocale()
    const defaultCallbackUrl = getUrlWithLocaleInCallbackUrl(websiteConfig.routes.defaultLoginRedirect, locale)
  const callbackUrl = propCallbackUrl || paramCallbackUrl || defaultCallbackUrl
  console.log('register form, callbackUrl', callbackUrl)

  const [error, setError] = useState<string | undefined>('')
  const [success, setSuccess] = useState<string | undefined>('')
  const [isPending, setIsPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const formId = useId()

  const registerSchema = useMemo(
    () =>
      z.object({
        email: z.string().email({
          message: t('emailRequired'),
        }),
        password: z.string().min(1, {
          message: t('passwordRequired'),
        }),
        name: z.string().min(1, {
          message: t('nameRequired'),
        }),
        invitationCode: z.string().optional(),
      }),
    [t]
  )

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
      invitationCode: '',
    },
  })

  const onSubmit = async (values: z.infer<typeof registerSchema>) => {
    // 1. if requireEmailVerification is true, callbackURL will be used in the verification email,
    // the user will be redirected to the callbackURL after the email is verified.
    // 2. if requireEmailVerification is false, the user will not be redirected to the callbackURL,
    // we should redirect to the callbackURL manually in the onSuccess callback.
    await authClient.signUp.email(
      {
        email: values.email,
        password: values.password,
        name: values.name,
        callbackURL: callbackUrl,
      },
      {
        onRequest: (ctx) => {
          console.log('register, request:', ctx.url)
          setIsPending(true)
          setError('')
          setSuccess('')
        },
        onResponse: (ctx) => {
          console.log('register, response:', ctx.response)
          setIsPending(false)
        },
        onSuccess: (ctx) => {
          // sign up success, user information stored in ctx.data
          // console.log("register, success:", ctx.data);
          setSuccess(t('checkEmail'))
        },
        onError: (ctx) => {
          // sign up fail, display the error message
          console.error('register, error:', ctx.error)
          setError(`${ctx.error.status}: ${ctx.error.message}`)
        },
        // 通过headers传递邀请码
        fetchOptions: values.invitationCode ? {
          headers: {
            'x-invitation-code': values.invitationCode,
          },
        } : undefined,
      }
    )
  }

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev)
  }

  return (
    <AuthCard headerLabel={t('createAccount')} bottomButtonLabel={t('signInHint')} bottomButtonHref={`${Routes.Login}`}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FieldGroup className='gap-4'>
          <Controller
            name='name'
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-name`}>{t('name')}</FieldLabel>
                <Input
                  {...field}
                  id={`${formId}-name`}
                  disabled={isPending}
                  placeholder='name'
                  aria-invalid={fieldState.invalid}
                  autoComplete='name'
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
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
                <FieldLabel htmlFor={`${formId}-password`}>{t('password')}</FieldLabel>
                <div className='relative'>
                  <Input
                    {...field}
                    id={`${formId}-password`}
                    disabled={isPending}
                    placeholder='******'
                    type={showPassword ? 'text' : 'password'}
                    className='pr-10'
                    aria-invalid={fieldState.invalid}
                    autoComplete='new-password'
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
          <Controller
            name='invitationCode'
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${formId}-invitation`}>邀请码 (可选)</FieldLabel>
                <Input
                  {...field}
                  id={`${formId}-invitation`}
                  disabled={isPending}
                  placeholder='请输入邀请码'
                  aria-invalid={fieldState.invalid}
                  autoComplete='off'
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
        <FormError message={error} />
        <FormSuccess message={success} />
        <Button
          disabled={isPending}
          size='lg'
          type='submit'
          className='flex w-full cursor-pointer items-center justify-center gap-2'
        >
          {isPending && <Loader2Icon className='mr-2 size-4 animate-spin' />}
          <span>{t('signUp')}</span>
        </Button>
      </form>
      <div className='mt-4'>
        <SocialLoginButton callbackUrl={callbackUrl} />
      </div>
    </AuthCard>
  )
}
