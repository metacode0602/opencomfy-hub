import Container from '@/components/layout/container'
import { CustomMDXContent } from '@/components/shared/custom-mdx-content'
// import { BlurFadeDemo } from "@/components/magicui/example/blur-fade-example";
import { Avatar, AvatarFallback, AvatarImage } from '@workspace/ui/components/avatar'
import { Button, buttonVariants } from '@workspace/ui/components/button'
import { WeChatQRDialog } from '@/components/shared/wechat-qr-dialog'
import { websiteConfig } from '@/lib/config/website'
import { constructMetadata } from '@/lib/seo/metadata'
import { getUrlWithLocale } from '@/lib/utils/urls'
import { cn } from '@workspace/ui/lib/utils'
import { MailIcon } from 'lucide-react'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { getCoreKeywords } from '@/lib/seo/keywords'
import { generateOrganizationSchema, generateBreadcrumbSchema } from '@/lib/seo/structured-data'
import Image from 'next/image'
import { TwitterIcon } from '@workspace/ui/components/icons/twitter'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata | undefined> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  const pt = await getTranslations({ locale, namespace: 'AboutPage' })

  const seoKeywords = getCoreKeywords(locale as 'zh' | 'en')
  const pageKeywords = locale === 'zh'
    ? ['关于字节聚力', 'GEO生成式搜索引擎优化', 'AI搜索营销', '数字营销服务商', '生成式AI营销']
    : ['about 字节聚力', 'GEO Generative Search Engine Optimization', 'AI search marketing', 'digital marketing service provider', 'generative AI marketing']

  return constructMetadata({
    title: `${pt('title')} | ${t('title')}`,
    description: pt('description'),
    canonicalUrl: getUrlWithLocale('/about', locale),
    locale,
    keywords: [...seoKeywords, ...pageKeywords],
  })
}

/**
 * inspired by https://astro-nomy.vercel.app/about
 */
export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const t = await getTranslations('AboutPage')

  // Generate structured data for SEO
  const organizationSchema = generateOrganizationSchema(locale)
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { name: locale === 'zh' ? '首页' : 'Home', url: getUrlWithLocale('', locale) },
      { name: t('title'), url: getUrlWithLocale('/about', locale) },
    ],
    locale
  )

  return (
    <>
      <Container className='px-4 py-8 sm:px-6 sm:py-12 lg:px-8 bg-background'>
        <div className='mx-auto max-w-5xl space-y-8'>
          {/* about section */}
          <div className='relative mx-auto mt-4 mb-8 sm:mt-8 sm:mb-12 md:mt-12 md:mb-16'>
            <div className='mx-auto flex flex-col gap-6 sm:gap-8'>
              {/* logo and name */}
              <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6 md:gap-8'>
                <Avatar className='size-16 shrink-0 p-0.5 sm:size-20 md:size-24'>
                  <AvatarFallback>
                    <Image src="/logo.png" alt="logo" width={48} height={48} />
                  </AvatarFallback>
                </Avatar>
                <div className='text-center sm:text-left'>
                  <h1 className='text-2xl font-bold text-foreground sm:text-3xl md:text-4xl'>{t('authorName')}</h1>
                  <p className='mt-2 text-sm text-muted-foreground sm:text-base'>{t('authorBio')}</p>
                </div>
              </div>

              {/* introduction */}
              <div className='space-y-6'>
                <div className='prose prose-sm prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-img:rounded-lg sm:prose-base'>
                  <CustomMDXContent code={t('introduction')} />
                </div>
                <div className='flex flex-wrap items-center gap-3 sm:gap-4'>
                  {websiteConfig.metadata.social?.twitter && (
                    <a
                      href={websiteConfig.metadata.social.twitter}
                      target='_blank'
                      rel='noopener noreferrer'
                      className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer rounded-lg text-sm sm:text-base')}
                    >
                      <TwitterIcon className='mr-1 size-4' />
                      {t('followMe')}
                    </a>
                  )}
                  {websiteConfig.mail.supportEmail && (
                    <Button className='cursor-pointer rounded-lg text-sm sm:text-base' variant='outline'>
                      <MailIcon className='mr-1 size-4' />
                      <a href={`mailto:${websiteConfig.mail.supportEmail}`}>{t('talkWithMe')}</a>
                    </Button>
                  )}
                  <WeChatQRDialog
                    qrCodeUrl='/images/pm.jpg'
                    wechatId={websiteConfig.metadata.social.wechatId}
                    buttonText='微信联系'
                    buttonVariant='default'
                    showIcon={true}
                    className='w-full text-sm sm:w-auto sm:text-base'
                  />
                </div>
              </div>
            </div>
          </div>

          {/* image section */}
          {/* <BlurFadeDemo /> */}
        </div>
      </Container>
    </>
  )
}
