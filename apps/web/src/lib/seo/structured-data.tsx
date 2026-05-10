import { websiteConfig } from '@/lib/config/website'
import { defaultMessages } from '@/lib/i18n/messages'
import { getBaseUrl, getUrlWithLocale } from '@/lib/utils/urls'
import type { Locale } from 'next-intl'

const BRAND_NAME_ZH = '字节聚力'
const LEGAL_NAME_ZH = '字节聚力（北京）科技有限公司'

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
 * Generate Organization structured data (JSON-LD)
 */
export function generateWebSiteSchema(locale: Locale = 'zh') {
  const isZh = locale === 'zh'
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND_NAME_ZH,
    url: getBaseUrl(),
    inLanguage: isZh ? 'zh-CN' : 'en-US',
    description: websiteConfig.metadata.description,
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME_ZH,
      url: getBaseUrl(),
    },
  }
}

export function generateOrganizationSchema(locale: Locale = 'zh') {
  const isZh = locale === 'zh'
  const email =
    websiteConfig.mail.supportEmail?.replace(/^[^<]*<([^>]+)>.*$/, '$1') ||
    websiteConfig.metadata.social?.email ||
    'service@bytemarketing.net'

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME_ZH,
    legalName: LEGAL_NAME_ZH,
    url: getBaseUrl(),
    logo: `${getBaseUrl()}${websiteConfig.metadata.images?.logoLight || '/logo.png'}`,
    description: isZh ? 'AI搜索时代的数字营销专家，专注GEO生成式搜索引擎优化' : 'Digital Marketing Expert in AI Search Era, Specialized in GEO Generative Engine Optimization',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email,
      telephone: websiteConfig.metadata.social?.phoneNumber,
    },
    email,
    telephone: websiteConfig.metadata.social?.phoneNumber,
    address: websiteConfig.metadata.social?.address
      ? {
          '@type': 'PostalAddress',
          addressCountry: 'CN',
          streetAddress: websiteConfig.metadata.social.address,
        }
      : undefined,
    sameAs: [
      websiteConfig.metadata.social?.twitter,
      websiteConfig.metadata.social?.github,
      websiteConfig.metadata.social?.linkedin,
    ].filter(Boolean) as string[],
  }
}

export function generateHomeWebPageSchema(locale: Locale = 'zh') {
  const isZh = locale === 'zh'
  const url = getUrlWithLocale('', locale)

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isZh ? `${BRAND_NAME_ZH} | GEO生成式搜索引擎优化` : defaultMessages.Metadata.name,
    description: websiteConfig.metadata.description,
    url,
    inLanguage: isZh ? 'zh-CN' : 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      name: BRAND_NAME_ZH,
      url: getBaseUrl(),
    },
    about: {
      '@type': 'Organization',
      name: BRAND_NAME_ZH,
      url: getBaseUrl(),
    },
    primaryImageOfPage: {
      '@type': 'ImageObject',
      url: `${getBaseUrl()}${websiteConfig.metadata.images?.ogImage || '/images/opengraph.png'}`,
    },
  }
}

export function generateGeoServiceSchema(locale: Locale = 'zh') {
  const isZh = locale === 'zh'
  const url = getUrlWithLocale('#geo', locale)

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: isZh ? 'GEO生成式搜索引擎优化' : 'GEO Generative Engine Optimization',
    description: isZh
      ? '面向生成式AI搜索的营销体系，通过优化内容语义与知识结构，让品牌信息适配AI识别与推荐逻辑，抢占AI搜索入口。'
      : 'A marketing system designed for generative AI search: optimize semantic content and knowledge structure so your brand matches AI recognition and recommendation logic.',
    url,
    provider: {
      '@type': 'Organization',
      name: BRAND_NAME_ZH,
      url: getBaseUrl(),
    },
    brand: {
      '@type': 'Brand',
      name: BRAND_NAME_ZH,
    },
    areaServed: {
      '@type': 'Country',
      name: 'China',
    },
    serviceType: isZh ? 'GEO优化,AI搜索营销,数字营销服务' : 'GEO Optimization, AI Search Marketing, Digital Marketing Services',
    category: isZh ? '生成式搜索引擎优化' : 'Generative Engine Optimization',
  }
}

export function generateGeoOfferCatalogSchema(locale: Locale = 'zh') {
  const isZh = locale === 'zh'
  const url = getUrlWithLocale('#services', locale)

  const items = [
    {
      name: isZh ? '策略洞察' : 'Strategy Insights',
      description: isZh ? '基于语义分析构建用户意图地图与关键词体系，精准定位目标受众' : 'Build intent maps and keyword systems with semantic analysis to reach your target audience.',
    },
    {
      name: isZh ? '内容构建' : 'Content Building',
      description: isZh ? '建立覆盖用户全决策路径的AI友好内容库，提升品牌权威性' : 'Create AI-friendly content across the full decision journey to strengthen authority.',
    },
    {
      name: isZh ? '权威分发' : 'Authority Distribution',
      description: isZh ? '在AI平台与高可信度媒体进行内容部署，扩大品牌影响力' : 'Deploy content on AI platforms and trusted media to expand brand influence.',
    },
    {
      name: isZh ? '转化优化' : 'Conversion Optimization',
      description: isZh ? '提升官网AI识别度，布设高效留资路径，提高转化率' : 'Improve AI readability of your website and optimize lead-capture flows.',
    },
    {
      name: isZh ? '动态攻防与精细化运营' : 'Competitive Ops & Optimization',
      description: isZh ? '实时监控竞品动态与行业趋势，实施策略调优与排名维护' : 'Monitor competitors and trends, iterate strategy, and maintain rankings.',
    },
    {
      name: isZh ? '效果追踪与迭代' : 'Tracking & Iteration',
      description: isZh ? '全程数据监测，结合实时反馈优化策略，确保动作可衡量、可优化' : 'Measure end-to-end performance and iterate with feedback for continuous improvement.',
    },
  ]

  return {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: isZh ? 'GEO服务体系' : 'GEO Services',
    url,
    provider: {
      '@type': 'Organization',
      name: BRAND_NAME_ZH,
      url: getBaseUrl(),
    },
    itemListElement: items.map((item) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: item.name,
        description: item.description,
      },
    })),
  }
}

/**
 * Generate WebApplication structured data (JSON-LD)
 */
export function generateWebApplicationSchema(locale: Locale = 'zh') {
  const isZh = locale === 'zh'

  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: defaultMessages.Metadata.name,
    url: getBaseUrl(),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: isZh
      ? '字节聚力专注GEO生成式搜索引擎优化，为企业提供AI搜索时代的数字营销解决方案，帮助品牌抢占AI搜索入口，实现持续增长。'
      : 'ByteMarketing specializes in GEO generative engine optimization, providing digital marketing solutions for the AI search era, helping brands capture AI search entry and achieve sustainable growth.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
    featureList: isZh
      ? ['GEO优化', 'AI搜索营销', '品牌增长', '全链路服务', '数据驱动优化']
      : ['GEO Optimization', 'AI Search Marketing', 'Brand Growth', 'Full-Chain Services', 'Data-Driven Optimization'],
    screenshot: `${getBaseUrl()}${websiteConfig.metadata.images?.ogImage || '/images/opengraph.png'}`,
  }
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

/**
 * Generate SoftwareApplication structured data (JSON-LD)
 */
export function generateSoftwareApplicationSchema(locale: Locale = 'zh') {
  const isZh = locale === 'zh'

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: defaultMessages.Metadata.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CNY',
    },
    description: isZh
      ? 'AI搜索时代的数字营销专家，专注GEO生成式搜索引擎优化，提供全链路品牌增长解决方案'
      : 'Digital Marketing Expert in AI Search Era, Specialized in GEO Generative Engine Optimization, Providing Full-Chain Brand Growth Solutions',
  }
}

/**
 * Generate LocalBusiness structured data (JSON-LD) for GEO optimization
 */
export function generateLocalBusinessSchema(
  locale: Locale = 'zh',
  city?: 'beijing' | 'shanghai' | 'guangzhou'
) {
  const isZh = locale === 'zh'

  // 地域性配置
  const cityConfig = {
    beijing: {
      name: isZh ? '北京' : 'Beijing',
      addressLocality: isZh ? '北京市' : 'Beijing',
      addressRegion: isZh ? '北京' : 'Beijing',
    },
    shanghai: {
      name: isZh ? '上海' : 'Shanghai',
      addressLocality: isZh ? '上海市' : 'Shanghai',
      addressRegion: isZh ? '上海' : 'Shanghai',
    },
    guangzhou: {
      name: isZh ? '广州' : 'Guangzhou',
      addressLocality: isZh ? '广州市' : 'Guangzhou',
      addressRegion: isZh ? '广东' : 'Guangdong',
    },
  }

  const selectedCity = city ? cityConfig[city] : null

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: defaultMessages.Metadata.name,
    url: getBaseUrl(),
    description: isZh
      ? 'AI搜索时代的数字营销专家，专注GEO生成式搜索引擎优化，帮助企业抢占AI搜索入口，实现品牌增长'
      : 'Digital Marketing Expert in AI Search Era, Specialized in GEO Generative Engine Optimization, Helping Enterprises Capture AI Search Entry and Achieve Brand Growth',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CN',
      addressLocality: selectedCity?.addressLocality || (isZh ? '中国' : 'China'),
      addressRegion: selectedCity?.addressRegion || (isZh ? '中国' : 'China'),
    },
    areaServed: selectedCity
      ? [
        {
          '@type': 'City',
          name: selectedCity.name,
        },
        {
          '@type': 'Country',
          name: 'China',
        },
      ]
      : [
        {
          '@type': 'City',
          name: isZh ? '北京' : 'Beijing',
        },
        {
          '@type': 'City',
          name: isZh ? '上海' : 'Shanghai',
        },
        {
          '@type': 'City',
          name: isZh ? '广州' : 'Guangzhou',
        },
        {
          '@type': 'Country',
          name: 'China',
        },
      ],
    serviceType: isZh ? '数字营销服务,GEO优化,AI搜索营销,品牌增长' : 'Digital Marketing Services, GEO Optimization, AI Search Marketing, Brand Growth',
    keywords: isZh
      ? 'GEO生成式搜索引擎优化,AI搜索营销,生成式AI搜索优化,AI搜索入口,数字营销服务,品牌增长,北京GEO优化服务,上海AI搜索营销,广州生成式搜索引擎优化'
      : 'GEO generative engine optimization, AI search marketing, generative AI search optimization, AI search entry, digital marketing services, brand growth, Beijing GEO optimization services, Shanghai AI search marketing, Guangzhou generative engine optimization',
  }
}

/**
 * Generate multiple LocalBusiness schemas for different cities (for GEO SEO)
 */
export function generateMultiCityLocalBusinessSchemas(locale: Locale = 'zh') {
  const cities: Array<'beijing' | 'shanghai' | 'guangzhou'> = ['beijing', 'shanghai', 'guangzhou']
  return cities.map((city) => generateLocalBusinessSchema(locale, city))
}
