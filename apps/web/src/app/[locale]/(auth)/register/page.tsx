import { RegisterForm } from '@/components/auth/register-form'
import { LocaleLink } from '@/lib/i18n/navigation'
import { constructMetadata } from '@/lib/seo/metadata'
import { getUrlWithLocale } from '@/lib/utils/urls'
import { Routes } from '@/lib/routes'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata | undefined> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  const pt = await getTranslations({ locale, namespace: 'AuthPage.register' })

  return constructMetadata({
    title: `${pt('title')} | ${t('title')}`,
    description: t('description'),
    canonicalUrl: getUrlWithLocale('/auth/register', locale),
  })
}

export default async function RegisterPage() {
  const t = await getTranslations('AuthPage.common')

  return (
    <div className='flex flex-col items-center justify-center gap-6'>
      <div className='flex w-full max-w-lg flex-col gap-4'>
        <RegisterForm />
        <div className='text-balance text-center text-muted-foreground text-xs'>
          {t('byClickingContinue')}
          <LocaleLink href={Routes.TermsOfService} className='underline underline-offset-4 hover:text-primary'>
            {t('termsOfService')}
          </LocaleLink>{' '}
          {t('and')}{' '}
          <LocaleLink href={Routes.PrivacyPolicy} className='underline underline-offset-4 hover:text-primary'>
            {t('privacyPolicy')}
          </LocaleLink>
        </div>
      </div>
    </div>
  )
}
