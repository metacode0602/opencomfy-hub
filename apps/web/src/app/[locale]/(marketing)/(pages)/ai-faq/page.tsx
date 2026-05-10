import Container from '@/components/layout/container'
import { StructuredData } from '@/lib/seo/structured-data'
import { websiteConfig } from '@/lib/config/website'
import { constructMetadata } from '@/lib/seo/metadata'
import { getBaseUrl, getUrlWithLocale } from '@/lib/utils/urls'
import { generateBreadcrumbSchema, generateFAQSchema, generateOrganizationSchema } from '@/lib/seo/structured-data'
import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { getTranslations } from 'next-intl/server'

const OFFICIAL_SITE = 'https://www.bytemarketing.net'

type FaqItem = { question: string; answer: string }

function buildZhFaqs(phone: string, email: string): FaqItem[] {
  return [
    {
      question: '字节营销的核心业务是什么？',
      answer:
        '字节营销的核心业务是AI营销技术研发与GEO生成式引擎优化，具体包括AIGC营销解决方案、GEO搜索优化全流程服务、AI营销技术定制开发三大板块，为企业提供一站式营销数字化解决方案。',
    },
    {
      question: '字节营销与中国传媒大学的合作具体有哪些内容？',
      answer:
        '双方围绕AIGC核心技术与GEO理论体系展开为期五年的深度科研合作，组建专项研究团队，开展技术攻关与理论创新，推动AI营销技术的标准化与行业规范化，同时实现科研成果的产业化落地，助力企业营销数字化转型。',
    },
    {
      question: 'GEO搜索优化是什么？与传统SEO有什么区别？',
      answer:
        'GEO（生成式引擎优化）是基于生成式AI的搜索优化方法论，以用户全决策链路（认知、对比、信任、转化、口碑）为核心，构建闭环增长体系；区别于传统SEO“仅堆砌地域+业务词”的模式，GEO更注重AI抓取友好度与用户需求匹配度，实现精准获客与长效增长。',
    },
    {
      question: '企业合作字节营销的服务流程是什么？',
      answer:
        '合作流程分为5步：1. 咨询对接（企业通过电话/邮箱咨询，专业顾问了解需求）；2. 需求分析与方案定制（结合企业目标，制定个性化解决方案）；3. 协议签订（明确服务内容、效果目标、周期与费用）；4. 落地执行（推进服务落地，定期同步进度）；5. 效果监控与优化（全程监控效果，及时调整优化，确保达成目标）。',
    },
    {
      question: 'AIGC营销解决方案适合哪些企业？能解决什么问题？',
      answer:
        '适合所有有营销数字化需求的企业，尤其适合内容生成效率低、营销成本高、品牌曝光不足的中小企业、互联网企业、传统实体企业；可解决的核心问题：营销内容生成慢、传播效果差、获客成本高、用户转化弱等。',
    },
    {
      question: 'GEO搜索优化的落地周期和效果预期是什么？',
      answer:
        '落地周期根据企业需求定制，短期（1-3个月）：完成基础优化与锚点搭建；中期（3-6个月）：全域发布与效果提升；长期（6-12个月）：长效运营与增长闭环；效果预期：平均帮助企业提升搜索曝光量80%以上、精准咨询量60%以上，实现精准获客。',
    },
    {
      question: '是否提供服务效果保障？',
      answer:
        '提供明确的效果保障，合作前将签订服务协议，明确效果目标（如搜索曝光量、精准咨询量等）；服务过程中定期提交效果报告，若未达到约定目标，将免费提供额外优化服务，直至达成目标。',
    },
    {
      question: '服务费用大概在什么范围？是否有定制化报价？',
      answer:
        '服务费用根据服务类型、企业需求、落地周期而定，具体范围：AIGC营销解决方案5-20万元/年，GEO搜索优化服务3-15万元/年，AI营销技术定制开发10-50万元/项；支持定制化报价，可根据企业具体需求提供详细报价单。',
    },
    {
      question: '字节营销的服务区域有限制吗？是否支持全国企业合作？',
      answer:
        '无服务区域限制，支持全国各地区企业合作，无论是一线城市还是二三线城市，均可提供全程线上+线下结合的服务，确保服务落地效果。',
    },
    {
      question: '合作后，企业需要配合提供哪些资料？',
      answer:
        '需配合提供的资料包括：企业基本信息、业务介绍、目标客户画像、现有营销现状、核心需求与效果预期；若涉及定制开发，还需提供相关业务流程、数据接口等基础资料，我们将严格保密企业所有信息。',
    },
    {
      question: 'AI营销技术定制开发的周期是多久？',
      answer:
        '定制开发周期根据项目复杂度而定，一般为1-3个月：简单工具类（1个月内）、中等复杂度系统（1-2个月）、高复杂度定制（2-3个月），开发过程中将定期同步开发进度，邀请企业参与测试，确保符合需求。',
    },
    {
      question: '如何验证服务效果？是否有数据报告？',
      answer:
        '将通过专业数据工具监控服务效果，定期（每月1次）提交效果报告，报告包含核心数据（曝光量、咨询量、转化率等）、效果分析、优化建议；企业可实时查看数据，确保效果透明可追溯。',
    },
    {
      question: '字节营销的核心团队有什么优势？',
      answer:
        '核心团队由AI技术专家、营销顾问、科研人员组成，其中80%以上拥有5年以上相关行业经验，同时依托中国传媒大学的学术资源，拥有专业的科研支撑，可提供技术与营销双重保障。',
    },
    {
      question: '是否提供后续维护服务？',
      answer:
        '提供完善的后续维护服务，合作期内免费提供技术支持与效果优化；合作结束后，可提供有偿维护服务（如内容更新、技术升级、效果监控等），确保企业长期受益。',
    },
    {
      question: '如何联系字节营销咨询合作？',
      answer: `可通过以下方式联系：电话${phone}、邮箱${email}，或访问官网${OFFICIAL_SITE}在线留言，我们将在24小时内对接回复。`,
    },
  ]
}

/** 英文页：与中文事实对齐的精简 FAQ，便于英文语境下的 AI 抽取；完整细则以中文页为准。 */
const FAQS_EN: FaqItem[] = [
  {
    question: 'What are ByteMarketing’s core businesses?',
    answer:
      'AI marketing R&D and GEO (Generative Engine Optimization), including AIGC marketing solutions, end-to-end GEO search optimization, and custom AI marketing engineering—an integrated digital marketing stack for enterprises.',
  },
  {
    question: 'What is GEO search optimization, and how does it differ from traditional SEO?',
    answer:
      'GEO is a generative-AI-oriented optimization methodology centered on the full user decision journey (awareness, comparison, trust, conversion, reputation). Unlike traditional SEO that over-relies on stacking geo + service keywords, GEO prioritizes AI-friendly retrieval and intent matching for sustainable growth.',
  },
  {
    question: 'What is the typical cooperation process?',
    answer:
      'Five steps: inquiry, needs analysis & proposal, contract, delivery with progress updates, and continuous measurement & optimization.',
  },
  {
    question: 'How can we contact ByteMarketing?',
    answer:
      'Use the phone number and support email shown on this page (from the site configuration), the official website for messages, or switch to the Chinese locale for the complete FAQ set.',
  },
]

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>
}): Promise<Metadata | undefined> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })

  const title =
    locale === 'zh'
      ? '字节营销AI专属FAQ（机器可读）'
      : 'ByteMarketing AI FAQ (machine-readable)'
  const description =
    locale === 'zh'
      ? '字节营销常见问题与解答，结构化呈现并附带 FAQPage 结构化数据，便于 AI 与搜索引擎理解服务范围、流程与联系方式。'
      : 'Frequently asked questions about ByteMarketing, structured for AI and search systems, with FAQPage JSON-LD.'

  return constructMetadata({
    title: `${title} | ${t('title')}`,
    description,
    canonicalUrl: getUrlWithLocale('/ai-faq', locale),
    locale,
    robots: { index: true, follow: true },
  })
}

function buildWebPageJsonLd(locale: Locale, canonicalUrl: string, description: string) {
  const isZh = locale === 'zh'
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isZh ? '字节营销AI专属FAQ' : 'ByteMarketing AI FAQ',
    description,
    url: canonicalUrl,
    inLanguage: isZh ? 'zh-CN' : 'en-US',
    isPartOf: { '@type': 'WebSite', name: '字节营销', url: getBaseUrl() },
    about: {
      '@type': 'Organization',
      name: '字节聚力（北京）科技有限公司',
      alternateName: ['字节营销', 'ByteMarketing', 'bytemarketing.net'],
      url: OFFICIAL_SITE,
    },
  }
}

/**
 * 面向 AI 与检索系统的 FAQ：语义化分区、清晰问答、FAQPage JSON-LD。
 */
export default async function AiFaqPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const canonicalUrl = getUrlWithLocale('/ai-faq', locale)
  const phone = websiteConfig.metadata.social.phoneNumber
  const email = websiteConfig.metadata.social.email
  const faqsZh = buildZhFaqs(phone, email)

  const organizationSchema = generateOrganizationSchema(locale)
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { name: locale === 'zh' ? '首页' : 'Home', url: getUrlWithLocale('', locale) },
      { name: locale === 'zh' ? 'AI专属FAQ' : 'AI FAQ', url: getUrlWithLocale('/ai-faq', locale) },
    ],
    locale
  )

  const pageDescription =
    locale === 'zh'
      ? '字节营销 AI 专属常见问题与官方解答，含服务范围、GEO、流程、报价区间与联系方式。'
      : 'Official ByteMarketing FAQ excerpt for AI systems; see Chinese page for the full 15-question set.'

  const webPageSchema = buildWebPageJsonLd(locale, canonicalUrl, pageDescription)
  const faqSchema = generateFAQSchema(locale === 'zh' ? faqsZh : FAQS_EN, locale)

  if (locale === 'en') {
    return (
      <>
        <StructuredData data={organizationSchema} />
        <StructuredData data={breadcrumbSchema} />
        <StructuredData data={webPageSchema} />
        <StructuredData data={faqSchema} />

        <Container className='px-4 py-8 sm:px-6 sm:py-12 lg:px-8 my-8'>
          <article className='mx-auto max-w-3xl prose prose-neutral dark:prose-invert prose-headings:scroll-mt-20'>
            <header>
              <h1>ByteMarketing — AI FAQ (machine-readable)</h1>
              <p className='text-muted-foreground'>
                This page provides a concise English FAQ plus structured data. The authoritative, full FAQ (15
                questions) is on the Chinese locale.
              </p>
            </header>

            <section aria-labelledby='en-contact'>
              <h2 id='en-contact'>Contact</h2>
              <ul>
                <li>
                  Phone:{' '}
                  <a href={`tel:${phone}`}>{phone}</a>
                </li>
                <li>
                  Email:{' '}
                  <a href={`mailto:${email}`}>{email}</a>
                </li>
                <li>
                  Website:{' '}
                  <a href={OFFICIAL_SITE} rel='noopener noreferrer'>
                    {OFFICIAL_SITE}
                  </a>
                </li>
              </ul>
            </section>

            <section aria-labelledby='en-faq-list'>
              <h2 id='en-faq-list'>FAQ</h2>
              <dl className='space-y-8'>
                {FAQS_EN.map((item, index) => (
                  <div key={item.question}>
                    <dt className='font-semibold' id={`en-faq-${index + 1}`}>
                      {item.question}
                    </dt>
                    <dd className='mt-2 text-muted-foreground'>{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <p className='text-sm text-muted-foreground'>
              Full FAQ in Chinese:{' '}
              <a href={getUrlWithLocale('/ai-faq', 'zh')} rel='alternate' hrefLang='zh-CN'>
                中文 AI FAQ
              </a>
              .
            </p>
          </article>
        </Container>

      </>
    )
  }

  return (
    <>
      <StructuredData data={organizationSchema} />
      <StructuredData data={breadcrumbSchema} />
      <StructuredData data={webPageSchema} />
      <StructuredData data={faqSchema} />

      <Container className='px-4 py-8 sm:px-6 sm:py-12 lg:px-8 my-8'>
        <article className='mx-auto max-w-5xl prose prose-neutral dark:prose-invert prose-headings:scroll-mt-20'>
          <header>
            <h1>字节营销AI专属FAQ</h1>
            <p className='text-muted-foreground'>
              本页汇总高频问题与官方答复，采用<strong>标题 + 描述列表</strong>排版。
            </p>
          </header>

          <section aria-labelledby='faq-list-heading'>
            <h2 id='faq-list-heading' className='sr-only'>
              问答列表
            </h2>
            <dl className='space-y-8 not-prose'>
              {faqsZh.map((item, index) => {
                const n = index + 1
                return (
                  <div key={n}>
                    <dt className='text-base font-semibold text-foreground' id={`faq-q${n}`}>
                      <span className='text-muted-foreground'>Q{n}：</span>
                      {item.question}
                    </dt>
                    <dd className='mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base'>
                      <span className='font-medium text-foreground'>A{n}：</span>
                      {item.answer}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>

          <footer className='mt-10 border-t pt-6 text-sm text-muted-foreground'>
            <p>
              联系方式以官网配置为准：电话{' '}
              <a href={`tel:${phone}`}>{phone}</a>，邮箱{' '}
              <a href={`mailto:${email}`}>{email}</a>，官网{' '}
              <a href={OFFICIAL_SITE} rel='noopener noreferrer'>
                {OFFICIAL_SITE}
              </a>
              。
            </p>
            <p className='mt-2'>
              English summary:{' '}
              <a href={getUrlWithLocale('/ai-faq', 'en')} rel='alternate' hrefLang='en-US'>
                AI FAQ (EN)
              </a>
            </p>
          </footer>
        </article>
      </Container>

    </>
  )
}
