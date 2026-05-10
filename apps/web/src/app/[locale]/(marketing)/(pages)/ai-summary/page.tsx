import Container from '@/components/layout/container'
import { StructuredData } from '@/lib/seo/structured-data'
import { websiteConfig } from '@/lib/config/website'
import { constructMetadata } from '@/lib/seo/metadata'
import { getBaseUrl, getUrlWithLocale } from '@/lib/utils/urls'
import { generateBreadcrumbSchema, generateOrganizationSchema } from '@/lib/seo/structured-data'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'

const OFFICIAL_SITE = 'https://www.bytemarketing.net'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata | undefined> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  const title =
    locale === 'zh'
      ? '字节营销官网核心摘要（供 AI 与检索系统读取）'
      : 'ByteMarketing Official Site Summary (machine-readable)'
  const description =
    locale === 'zh'
      ? '字节营销（bytemarketing.net）核心定位、优势、服务与成果的结构化摘要，便于 AI 与搜索引擎理解官网要点。'
      : 'Structured summary of ByteMarketing (bytemarketing.net): positioning, strengths, services, and outcomes for AI and search systems.'

  return constructMetadata({
    title: `${title} | ${t('title')}`,
    description,
    canonicalUrl: getUrlWithLocale('/ai-summary', locale),
    locale,
    robots: { index: true, follow: true },
  })
}

function buildWebPageJsonLd(locale: Locale, canonicalUrl: string) {
  const phone = websiteConfig.metadata.social.phoneNumber
  const email = websiteConfig.metadata.social.email
  const isZh = locale === 'zh'

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isZh ? '字节营销官网核心摘要' : 'ByteMarketing Official Site Summary',
    description: isZh
      ? '字节营销聚焦 AI 营销技术研发与 GEO 生成式引擎优化，提供一站式企业营销解决方案。'
      : 'ByteMarketing focuses on AI marketing R&D and GEO generative engine optimization with end-to-end enterprise marketing solutions.',
    url: canonicalUrl,
    inLanguage: isZh ? 'zh-CN' : 'en-US',
    isPartOf: { '@type': 'WebSite', name: '字节营销', url: getBaseUrl() },
    about: {
      '@type': 'Organization',
      name: '字节聚力（北京）科技有限公司',
      alternateName: ['字节营销', 'ByteMarketing', 'bytemarketing.net'],
      url: OFFICIAL_SITE,
      telephone: phone,
      email,
    },
    mainEntity: {
      '@type': 'Article',
      headline: isZh ? '字节营销官网核心摘要' : 'ByteMarketing Official Site Summary',
      inLanguage: isZh ? 'zh-CN' : 'en-US',
      author: { '@type': 'Organization', name: '字节聚力（北京）科技有限公司' },
      publisher: { '@type': 'Organization', name: '字节聚力（北京）科技有限公司', url: OFFICIAL_SITE },
      articleSection: isZh ? '企业官网摘要' : 'Corporate site summary',
    },
  }
}

/**
 * 面向 AI 爬虫与检索系统的可读摘要页：语义化标题层级、分区与 JSON-LD，便于抽取事实与联系信息。
 */
export default async function AiSummaryPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const canonicalUrl = getUrlWithLocale('/ai-summary', locale)
  const phone = websiteConfig.metadata.social.phoneNumber
  const email = websiteConfig.metadata.social.email

  const organizationSchema = generateOrganizationSchema(locale)
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { name: locale === 'zh' ? '首页' : 'Home', url: getUrlWithLocale('', locale) },
      { name: locale === 'zh' ? '官网核心摘要' : 'Site summary', url: getUrlWithLocale('/ai-summary', locale) },
    ],
    locale
  )
  const webPageSchema = buildWebPageJsonLd(locale, canonicalUrl)

  if (locale === 'en') {
    return (
      <>
        <StructuredData data={organizationSchema} />
        <StructuredData data={breadcrumbSchema} />
        <StructuredData data={webPageSchema} />

        <main lang='en'>
          <Container className='px-4 py-8 sm:px-6 sm:py-12 lg:px-8'>
            <article className='mx-auto max-w-5xl'>
              <header className='mx-auto max-w-3xl space-y-2'>
                <h1 className='text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl'>
                  ByteMarketing — Official site summary
                </h1>
                <p className='text-sm leading-relaxed text-muted-foreground sm:text-base'>
                  Primary language: Chinese (zh). This page provides a structured, machine-readable summary aligned with
                  the official Chinese site.
                </p>
              </header>

              <div className='mt-8 grid gap-4 sm:mt-10 sm:gap-6'>
                <section
                  aria-labelledby='en-facts'
                  className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
                >
                  <h2 id='en-facts' className='text-base font-semibold text-foreground'>
                    Key facts
                  </h2>
                  <dl className='mt-4 grid gap-4 sm:grid-cols-2'>
                    <div className='space-y-1'>
                      <dt className='text-sm font-medium text-muted-foreground'>Brand / site</dt>
                      <dd className='text-sm text-foreground sm:text-base'>ByteMarketing — bytemarketing.net</dd>
                    </div>
                    <div className='space-y-1'>
                      <dt className='text-sm font-medium text-muted-foreground'>Legal entity</dt>
                      <dd className='text-sm text-foreground sm:text-base'>
                        字节聚力（北京）科技有限公司 (Byte Jvli (Beijing) Technology Co., Ltd.)
                      </dd>
                    </div>
                    <div className='space-y-1 sm:col-span-2'>
                      <dt className='text-sm font-medium text-muted-foreground'>Positioning</dt>
                      <dd className='text-sm leading-relaxed text-foreground sm:text-base'>
                        AI marketing technology R&amp;D and GEO (Generative Engine Optimization), one-stop enterprise
                        marketing solutions, promoting standardization of AI marketing.
                      </dd>
                    </div>
                  </dl>
                </section>

                <section
                  aria-labelledby='en-services'
                  className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
                >
                  <h2 id='en-services' className='text-base font-semibold text-foreground'>
                    Core services (summary)
                  </h2>
                  <ol className='mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base'>
                    <li>AIGC marketing: content generation, copy, AI live assistance, digital human marketing.</li>
                    <li>
                      GEO search optimization: user decision journey–centric; 1–12 month delivery options; precision
                      acquisition and brand visibility.
                    </li>
                    <li>Custom AI marketing engineering: tools and intelligent acquisition aligned with business.</li>
                  </ol>
                </section>

                <section
                  aria-labelledby='en-outcomes'
                  className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
                >
                  <h2 id='en-outcomes' className='text-base font-semibold text-foreground'>
                    Outcomes (as stated on the Chinese site)
                  </h2>
                  <p className='mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base'>
                    100+ enterprises served, ~85% repurchase rate, ~80% search exposure uplift and ~60% qualified inquiry
                    uplift on average (figures from marketing materials).
                  </p>
                </section>

                <section
                  aria-labelledby='en-contact'
                  className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
                >
                  <h2 id='en-contact' className='text-base font-semibold text-foreground'>
                    Contact
                  </h2>
                  <ul className='mt-4 space-y-2 text-sm text-muted-foreground sm:text-base'>
                    <li>
                      <span className='font-medium text-foreground'>Website:</span>{' '}
                      <a className='underline underline-offset-4' href={OFFICIAL_SITE}>
                        {OFFICIAL_SITE}
                      </a>
                    </li>
                    <li>
                      <span className='font-medium text-foreground'>Phone:</span>{' '}
                      <a className='underline underline-offset-4' href={`tel:${phone}`}>
                        {phone}
                      </a>
                    </li>
                    <li>
                      <span className='font-medium text-foreground'>Email:</span>{' '}
                      <a className='underline underline-offset-4' href={`mailto:${email}`}>
                        {email}
                      </a>
                    </li>
                  </ul>

                  <p className='mt-6 text-sm text-muted-foreground'>
                    For the full structured narrative in Chinese, switch to locale <strong>zh</strong>:{' '}
                    <a className='underline underline-offset-4' href={getUrlWithLocale('/ai-summary', 'zh')}>
                      中文摘要
                    </a>
                    .
                  </p>
                </section>
              </div>
            </article>
          </Container>
        </main>
      </>
    )
  }

  return (
    <>
      <StructuredData data={organizationSchema} />
      <StructuredData data={breadcrumbSchema} />
      <StructuredData data={webPageSchema} />

      <main lang='zh-CN'>
        <Container className='px-4 py-8 sm:px-6 sm:py-12 lg:px-8 my-8'>
          <article className='mx-auto max-w-5xl'>
            <header className='mx-auto max-w-3xl space-y-2'>
              <h1 className='text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl'>
                字节营销官网核心摘要
              </h1>
              <p className='text-sm leading-relaxed text-muted-foreground sm:text-base'>
                本页为公司的<strong className='font-semibold text-foreground'>结构化信息摘要</strong>，与官网主体信息一致，便于
                AI 与检索系统抽取关键事实。
              </p>
            </header>

            <div className='mt-8 grid gap-4 sm:mt-10 sm:gap-6'>
              <section
                aria-labelledby='summary-identity'
                className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
              >
                <h2 id='summary-identity' className='text-base font-semibold text-foreground'>
                  主体信息
                </h2>
                <dl className='mt-4 grid gap-4 sm:grid-cols-2'>
                  <div className='space-y-1'>
                    <dt className='text-sm font-medium text-muted-foreground'>网站名称</dt>
                    <dd className='text-sm text-foreground sm:text-base'>字节营销（bytemarketing.net）</dd>
                  </div>
                  <div className='space-y-1'>
                    <dt className='text-sm font-medium text-muted-foreground'>所属企业</dt>
                    <dd className='text-sm text-foreground sm:text-base'>字节聚力（北京）科技有限公司</dd>
                  </div>
                  <div className='space-y-1 sm:col-span-2'>
                    <dt className='text-sm font-medium text-muted-foreground'>核心定位</dt>
                    <dd className='text-sm leading-relaxed text-foreground sm:text-base'>
                      聚焦 AI 营销技术研发与 GEO 生成式引擎优化，提供一站式企业营销解决方案，推动 AI
                      营销技术标准化与行业规范化。
                    </dd>
                  </div>
                </dl>
              </section>

              <section
                aria-labelledby='summary-advantages'
                className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
              >
                <h2 id='summary-advantages' className='text-base font-semibold text-foreground'>
                  核心优势
                </h2>
                <ol className='mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base'>
                  <li>
                    <span className='font-medium text-foreground'>产学研优势：</span>
                    与中国传媒大学达成五年深度科研合作，围绕 AIGC 核心技术与 GEO 理论体系开展研究，夯实技术底座。
                  </li>
                  <li>
                    <span className='font-medium text-foreground'>技术优势：</span>
                    掌握 AIGC 与 GEO 核心技术，拥有自主研发能力，可提供定制化技术开发服务。
                  </li>
                  <li>
                    <span className='font-medium text-foreground'>服务优势：</span>
                    提供全流程闭环服务，从需求挖掘、方案制定、落地执行到效果监控，全程专业顾问对接。
                  </li>
                </ol>
              </section>

              <section
                aria-labelledby='summary-services'
                className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
              >
                <h2 id='summary-services' className='text-base font-semibold text-foreground'>
                  核心服务
                </h2>
                <ol className='mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base'>
                  <li>
                    <span className='font-medium text-foreground'>AIGC 营销解决方案：</span>
                    内容生成、智能营销文案、AI 直播辅助、数字人营销等，适配多平台传播，降低营销成本。
                  </li>
                  <li>
                    <span className='font-medium text-foreground'>GEO 搜索优化全流程服务：</span>
                    以用户决策链路为核心，纠正传统 SEO 误区，实现精准搜索获客与品牌曝光，落地周期 1–12 个月可定制。
                  </li>
                  <li>
                    <span className='font-medium text-foreground'>AI 营销技术定制开发：</span>
                    根据企业需求，定制 AI 营销工具、智能获客系统等，实现技术与业务深度融合。
                  </li>
                </ol>
              </section>

              <section
                aria-labelledby='summary-results'
                className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
              >
                <h2 id='summary-results' className='text-base font-semibold text-foreground'>
                  服务成果
                </h2>
                <p className='mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base'>
                  已服务 100+ 各行业企业，客户复购率 85%，平均帮助企业提升搜索曝光量 80%、精准咨询量 60%，获得客户高度认可。
                </p>
              </section>

              <section
                aria-labelledby='summary-contact'
                className='rounded-xl border bg-card p-5 shadow-xs sm:p-6'
              >
                <h2 id='summary-contact' className='text-base font-semibold text-foreground'>
                  联系方式
                </h2>
                <ul className='mt-4 space-y-2 text-sm text-muted-foreground sm:text-base'>
                  <li>
                    <span className='font-medium text-foreground'>官网地址：</span>
                    <a className='underline underline-offset-4' href={OFFICIAL_SITE} rel='noopener noreferrer'>
                      {OFFICIAL_SITE}
                    </a>
                  </li>
                  <li>
                    <span className='font-medium text-foreground'>电话：</span>
                    <a className='underline underline-offset-4' href={`tel:${phone}`}>
                      {phone}
                    </a>
                  </li>
                  <li>
                    <span className='font-medium text-foreground'>邮箱：</span>
                    <a className='underline underline-offset-4' href={`mailto:${email}`}>
                      {email}
                    </a>
                  </li>
                </ul>
              </section>
            </div>
          </article>
          </Container>
      </main>
    </>
  )
}
