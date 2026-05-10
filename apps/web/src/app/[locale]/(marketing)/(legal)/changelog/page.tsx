import { ReleaseCard } from '@/components/shared/release-card'
import { constructMetadata } from '@/lib/seo/metadata'
import { getReleases } from '@/lib/utils/get-page'
import { getUrlWithLocale } from '@/lib/utils/urls'
import type { NextPageProps } from '@/lib/types/next-page-props'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import Container from '@/components/layout/container'
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata | undefined> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  const pt = await getTranslations({ locale, namespace: 'ChangelogPage' })

  return constructMetadata({
    title: `${pt('title')} | ${t('title')}`,
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/changelog', locale),
  })
}

export default async function ChangelogPage(props: NextPageProps) {
  const params = await props.params
  if (!params) {
    notFound()
  }

  const locale = params.locale as Locale
  const releases = await getReleases(locale)

  if (!releases || releases.length === 0) {
    notFound()
  }

  const t = await getTranslations('ChangelogPage')

  return (
    <Container className='px-4 py-16'>
      <div className='mx-auto max-w-4xl space-y-8'>
        {/* Header */}
        <div className='space-y-4'>
          <h1 className='text-center font-bold text-3xl tracking-tight'>{t('title')}</h1>
          <p className='text-center text-lg text-muted-foreground'>{t('subtitle')}</p>
        </div>

        {/* Releases */}
        <div className='mt-8'>
          {releases.map((release, index) => (
            <ReleaseCard
              key={`${index}-${release?.version}`}
              title={release.title}
              description={release.description}
              date={release.date}
              version={release.version}
              content={release.body}
            />
          ))}
        </div>
      </div>
    </Container>
  )
}
