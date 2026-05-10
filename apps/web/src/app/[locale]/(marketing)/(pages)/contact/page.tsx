import { WeChatQRDialog } from '@/components/shared/wechat-qr-dialog'
import Container from '@/components/layout/container'
import { websiteConfig } from '@/lib/config/website'
import { constructMetadata } from '@/lib/seo/metadata'
import { getUrlWithLocale } from '@/lib/utils/urls'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getCoreKeywords } from '@/lib/seo/keywords'
import { StructuredData } from '@/lib/seo/structured-data'
import { generateOrganizationSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata | undefined> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  const pt = await getTranslations({ locale, namespace: 'ContactPage' })

  const seoKeywords = getCoreKeywords(locale as 'zh' | 'en')
  const pageKeywords = locale === 'zh'
    ? ['联系我们', '字节聚力客服', '作业辅导咨询', '拍照解题咨询', '家长辅导帮助']
    : ['contact us', 'customer service', 'homework tutoring consultation', 'photo homework help']

  return constructMetadata({
    title: `${pt('title')} | ${t('title')}`,
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/contact', locale),
    locale,
    keywords: [...seoKeywords, ...pageKeywords],
  })
}

/**
 * inspired by https://nsui.irung.me/contact
 */
export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = await getTranslations('ContactPage')

  // Generate structured data for SEO
  const organizationSchema = generateOrganizationSchema(locale)
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { name: locale === 'zh' ? '首页' : 'Home', url: getUrlWithLocale('', locale) },
      { name: t('title'), url: getUrlWithLocale('/contact', locale) },
    ],
    locale
  )

  return (
    <>
      {/* Structured Data for SEO */}
      <StructuredData data={organizationSchema} />
      <StructuredData data={breadcrumbSchema} />

      <Container className='px-4 py-8'>
        <div className='mx-auto max-w-4xl space-y-8 pb-4'>
          {/* Header */}
          <div className='space-y-4'>
            <h1 className='text-center font-bold text-3xl tracking-tight'>{t('title')}</h1>
            <p className='text-center text-lg text-muted-foreground'>{t('subtitle')}</p>
          </div>

          {/* Form */}
          {/* <ContactFormCard /> */}
          {/* WeChat Contact Section */}
          <div className='flex flex-col items-center space-y-4 pt-8 border-t border-border'>
            <div className='text-center space-y-2'>
              <h3 className='text-lg font-semibold'>{t('wechat.title')}</h3>
              <p className='text-sm text-muted-foreground'>{t('wechat.description')}</p>
            </div>
            <WeChatQRDialog
              qrCodeUrl='/images/pm.jpg'
              wechatId={websiteConfig.metadata.social.wechatId}
              buttonText={t('wechat.contactWeChat')}
              buttonVariant='default'
              showIcon={true}
              className='w-full sm:w-auto'
            />
          </div>

        </div>
      </Container>
    </>
  )
}
