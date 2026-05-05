import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { defaultMessages } from '@/lib/i18n/messages'
import { routing } from '@/lib/i18n/routing'
import { websiteConfig } from '@/lib/config/website'
import { getBaseUrl, getUrlWithLocale } from '@/lib/utils/urls'

/**
 * Get Open Graph locale from Next.js locale
 */
function getOpenGraphLocale(locale: Locale): string {
  const localeMap: Record<Locale, string> = {
    en: 'en_US',
    zh: 'zh_CN',
  }
  return localeMap[locale] || 'en_US'
}

/**
 * Get alternate language URLs for hreflang tags
 */
function getAlternateLanguages(canonicalUrl: string, currentLocale: Locale): Record<string, string> {
  const alternates: Record<string, string> = {}
  const basePath = canonicalUrl.replace(getBaseUrl(), '')

  for (const locale of routing.locales) {
    if (locale !== currentLocale) {
      const localeUrl = getUrlWithLocale(basePath, locale)
      alternates[locale] = localeUrl
    }
  }

  return alternates
}

/**
 * Get default keywords based on locale (SEO / structured data)
 */
export function getDefaultKeywords(locale: Locale): string[] {
  if (locale === 'zh') {
    return [
      '大语言模型网关',
      'AI统一网关',
      'LLM网关',
      'AI接口平台',
      '模型管理',
      '提示管理',
      'LLM追踪',
      'AI可观测性',
      '模型评估',
      'LLM调试',
      'OpenAI替代',
      '统一访问400+ AI模型',
      'LLM应用调试工具',
      '提示工程管理',
    ]
  }
  return [
    'LLM Gateway',
    'AI Unified Gateway',
    'OpenAI Alternative',
    'LLM API Gateway',
    'Model Management',
    'Prompt Management',
    'LLM Traces',
    'AI Observability',
    'Model Evaluation',
    'LLM Debugging',
    'AI API',
    'Unified access to 400+ AI models',
    'LLM application debugging',
    'Prompt engineering tools',
  ]
}

/**
 * Construct the metadata object for the current page with enhanced SEO support
 */
export function constructMetadata({
  title,
  description,
  canonicalUrl,
  image,
  noIndex = false,
  keywords,
  locale = 'zh',
  alternateLanguages,
}: {
  title?: string
  description?: string
  canonicalUrl?: string
  image?: string
  noIndex?: boolean
  keywords?: string | string[]
  locale?: Locale
  alternateLanguages?: Record<string, string>
} = {}): Metadata {
  title = title || defaultMessages.Metadata.title
  description = description || defaultMessages.Metadata.description
  image = image || websiteConfig.metadata.images?.ogImage
  console.warn('[metadata.ts] [constructMetadata] image', image, getBaseUrl())
  const ogImageUrl = image.startsWith('http') ? new URL(image) : new URL(`${getBaseUrl()}${image}`)
  const ogLocale = getOpenGraphLocale(locale)

  // Build keywords string
  const keywordsArray = Array.isArray(keywords) ? keywords : keywords ? [keywords] : []
  const defaultKeywords = getDefaultKeywords(locale)
  const allKeywords = [...defaultKeywords, ...keywordsArray].join(', ')

  // Get alternate language URLs
  const alternates = alternateLanguages || (canonicalUrl ? getAlternateLanguages(canonicalUrl, locale) : {})

  return {
    title,
    description,
    keywords: allKeywords,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'x-default': canonicalUrl || getBaseUrl(),
        ...alternates,
      },
    },
    openGraph: {
      type: 'website',
      locale: ogLocale,
      url: canonicalUrl,
      title,
      description,
      siteName: defaultMessages.Metadata.name,
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl.toString()],
      site: getBaseUrl(),
    },
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon-180x180.png',
      apple: '/apple-touch-icon.png',
    },
    metadataBase: new URL(getBaseUrl()),
    manifest: `${getBaseUrl()}/manifest.webmanifest`,
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  }
}
