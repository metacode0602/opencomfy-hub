import Container from '@/components/layout/container'
import { WaitlistFormCard } from '@/components/shared/waitlist-form-card'
import { constructMetadata } from '@/lib/seo/metadata'
import { getUrlWithLocale } from '@/lib/utils/urls'
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
  const pt = await getTranslations({ locale, namespace: 'WaitlistPage' })
  return constructMetadata({
    title: `${pt('title')} | ${t('title')}`,
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/waitlist', locale),
  })
}

export default async function WaitlistPage() {
  const t = await getTranslations('WaitlistPage')

  return (
    <Container className='px-4 py-16 my-8'>
      <div className='mx-auto max-w-7xl space-y-8 pb-16'>
        {/* Header */}
        <div className='space-y-4'>
          <h1 className='text-center font-bold text-3xl tracking-tight'>{t('title')}</h1>
          <h2 className='text-center text-lg text-muted-foreground'>{t('subtitle')}</h2>
        </div>

        {/* Form */}
        <WaitlistFormCard />
      </div>
    </Container>
  )
}
