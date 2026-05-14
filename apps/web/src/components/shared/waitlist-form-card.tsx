'use client'

import { FormError } from '@/components/shared/form-error'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/ui/components/field'
import { Input } from '@workspace/ui/components/input'
import { trpc } from '@/lib/trpc/client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

/**
 * Waitlist form card component
 * This is a client component that handles the waitlist form submission
 */
export function WaitlistFormCard() {
  const t = useTranslations('WaitlistPage.form')
  const locale = useLocale()
  const [error, setError] = useState<string | undefined>(undefined)
  const formId = useId()

  const formSchema = useMemo(
    () =>
      z.object({
        email: z.string().email({ message: t('emailValidation') }),
      }),
    [t]
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  })

  const subscribeWaitlistMutation = trpc.newsletters.subscribeNewsletterAction.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(t('success'))
        form.reset()
        setError(undefined)
      } else {
        const errorMessage = 'Failed to subscribe'
        setError(errorMessage)
        toast.error(errorMessage)
      }
    },
    onError: (err: unknown) => {
      console.error('Form submission error:', err)
      const errorMessage = t('fail')
      setError(errorMessage)
      toast.error(errorMessage)
    },
  })

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    setError(undefined)
    subscribeWaitlistMutation.mutate({ email: values.email, locale })
  }

  return (
    <Card className='mx-auto max-w-3xl overflow-hidden pt-6 pb-0'>
      <CardHeader>
        <CardTitle className='font-semibold text-lg'>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className='space-y-6'>
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
                    type='email'
                    autoComplete='email'
                    placeholder={t('email')}
                    disabled={subscribeWaitlistMutation.isPending}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>

          <FormError message={error} />
        </CardContent>
        <CardFooter className='mt-6 flex items-center justify-between rounded-none bg-muted px-6 py-4'>
          <Button type='submit' disabled={subscribeWaitlistMutation.isPending} className='cursor-pointer'>
            {subscribeWaitlistMutation.isPending ? t('subscribing') : t('subscribe')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
