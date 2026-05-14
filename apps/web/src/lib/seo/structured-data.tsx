import { websiteConfig } from '@/lib/config/website'
import { defaultMessages } from '@/lib/i18n/messages'
import { getBaseUrl, getUrlWithLocale } from '@/lib/utils/urls'
import type { Locale } from 'next-intl'

const BRAND_NAME_ZH = websiteConfig.metadata.title
const LEGAL_NAME_ZH = websiteConfig.metadata.authorName

import type { ReactNode } from 'react'

interface StructuredDataProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>
}

/**
 * Component to render JSON-LD structured data
 */
export function StructuredData({ data }: StructuredDataProps): ReactNode {
  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  )
}

/**
 * Generate BreadcrumbList structured data (JSON-LD)
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>, locale: Locale = 'zh') {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${getBaseUrl()}${item.url}`,
    })),
  }
}

/**
 * Generate FAQPage structured data (JSON-LD)
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>, locale: Locale = 'zh') {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
