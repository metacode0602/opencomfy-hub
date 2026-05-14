import type { Metadata } from 'next'
import type { Locale } from 'next-intl'
import { defaultMessages } from '@/lib/i18n/messages'
import { routing } from '@/lib/i18n/routing'
import { websiteConfig } from '@/lib/config/website'
import { getBaseUrl, getUrlWithLocale } from '@/lib/utils/urls'
import { getAllSEOKeywords, getCoreKeywords } from './keywords'

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

    ]
  }
  return [

  ]
}

/**
 * Construct the metadata object for the current page with enhanced SEO support
 */
export function constructPageMetadata({
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

/** 将页面封面图解析为绝对 URL（支持 https 绝对地址与站内相对路径） */
function resolveOgImageUrl(image: string | undefined): URL {
  const baseUrl = getBaseUrl()
  const fallback = websiteConfig.metadata.images?.ogImage ?? '/images/opengraph.png'
  const imageSrc = image?.trim() || fallback
  try {
    return new URL(imageSrc, baseUrl)
  } catch {
    return new URL(fallback, baseUrl)
  }
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
  author,
  openGraphTitle,
  openGraphDescription,
  twitterTitle,
  twitterDescription,
  twitterImage,
  /** 与 noIndex 并存时优先使用本字段（可单独控制 index / follow） */
  robots: robotsOverride,
}: {
  title?: string
  description?: string
  canonicalUrl?: string
  image?: string
  noIndex?: boolean
  keywords?: string | string[]
  locale?: Locale
  author?: string
  openGraphTitle?: string
  openGraphDescription?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
  robots?: { index: boolean; follow: boolean }
} = {}): Metadata {
  title = title || defaultMessages.Metadata.title
  description = description || defaultMessages.Metadata.description
  const ogImageUrl = resolveOgImageUrl(image)
  const twitterImg = twitterImage?.trim() ? resolveOgImageUrl(twitterImage) : ogImageUrl
  const ogLocale = getOpenGraphLocale(locale)
  const ogTitle = openGraphTitle ?? title
  const ogDesc = openGraphDescription ?? description
  const twTitle = twitterTitle ?? title
  const twDesc = twitterDescription ?? description

  // Build keywords string
  const keywordsArray = Array.isArray(keywords) ? keywords : keywords ? [keywords] : []
  // 使用 SEO 关键词配置
  const seoKeywords = getAllSEOKeywords(locale as 'zh' | 'en')
  const coreKeywordsList = getCoreKeywords(locale as 'zh' | 'en')
  // 默认仅合并 GEO / AI 搜索营销相关词库与页面传入词，避免与业务无关的模板关键词污染主题信号
  const allKeywordsSet = new Set([...coreKeywordsList, ...seoKeywords, ...keywordsArray])
  const allKeywords = Array.from(allKeywordsSet).join(', ')

  // Get alternate language URLs
  const alternateLanguages = canonicalUrl ? getAlternateLanguages(canonicalUrl, locale) : {}

  return {
    title,
    description,
    keywords: allKeywords,
    authors: author ? [{ name: author }] : undefined,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'x-default': canonicalUrl || getBaseUrl(),
        ...alternateLanguages,
      },
    },
    openGraph: {
      type: 'website',
      locale: ogLocale,
      url: canonicalUrl,
      title: ogTitle,
      description: ogDesc,
      siteName: defaultMessages.Metadata.name,
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: ogTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: twTitle,
      description: twDesc,
      images: [twitterImg.toString()],
      site: getBaseUrl(),
    },
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon-32x32.png',
      apple: '/apple-touch-icon.png',
    },
    metadataBase: new URL(getBaseUrl()),
    manifest: `${getBaseUrl()}/manifest.webmanifest`,
    ...(robotsOverride
      ? { robots: { index: robotsOverride.index, follow: robotsOverride.follow } }
      : noIndex
        ? { robots: { index: false, follow: false } }
        : {}),
  }
}