import { Analytics } from '@workspace/shared-next/analytics'
import { fontBricolageGrotesque, fontNotoSans, fontNotoSansMono, fontNotoSerif } from '@workspace/shared-next/assets/fonts'
import { AffonsoScript } from '@workspace/shared-next/affiliate/affonso'
import { TailwindIndicator } from '@workspace/ui/components/layout/tailwind-indicator'
import { routing } from '@/lib/i18n/routing'
import { getBaseUrl } from '@/lib/utils/urls'
import { cn } from '@workspace/ui/lib/utils'
import { type Locale, NextIntlClientProvider, hasLocale } from 'next-intl'
import type { ReactNode } from 'react'
import { Toaster } from 'sonner'
import { Providers } from './providers'
import '@workspace/ui/globals.css'
import '@/app/style.css'
import { Viewport, type Metadata } from 'next'
import { SmoothScroll } from '@/components/smooth-scroll'
import { websiteConfig } from '@/lib/config/website'

interface LocaleLayoutProps {
  children: ReactNode
  params: Promise<{ locale: Locale }>
}

export const viewport: Viewport = {
  initialScale: 1,
  viewportFit: 'cover',
  width: 'device-width',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'oklch(1 0 0)' },
    { media: '(prefers-color-scheme: dark)', color: 'oklch(0.145 0 0)' },
  ],
}

/**
 * Global metadata configuration
 * Sets metadataBase to resolve relative URLs for Open Graph and Twitter images
 */
export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
}
/**
 * 1. Locale Layout
 * https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing#layout
 *
 * 2. NextIntlClientProvider
 * https://next-intl.dev/docs/usage/configuration#nextintlclientprovider
 */
export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  let { locale } = await params

  // Ensure that the incoming `locale` is valid
  if (!hasLocale(routing.locales, locale)) {
    // notFound();
    locale = routing.defaultLocale
  }

  const baseUrl = getBaseUrl()

  // Structured data for SEO
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'OpenRoute AI',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description:
      locale === 'zh'
        ? 'OpenRoute AI 是最好的 AI 统一访问接口，提供 400+ AI 模型的统一访问，支持追踪、评估、提示管理和指标功能。'
        : 'OpenRoute AI is the best AI Unified Gateway for LLMs, providing unified access to 400+ AI models with traces, evals, prompt management and metrics.',
    sameAs: [
      // Add social media links if available
    ],
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'OpenRoute AI',
    url: baseUrl,
    description:
      locale === 'zh'
        ? 'OpenRoute AI - 最好的 AI 统一访问接口，400+ 模型，追踪评估'
        : 'OpenRoute AI - The Best AI Unified Gateway for LLMs, 400+ Models, Traces & Evals',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    inLanguage: locale === 'zh' ? 'zh-CN' : 'en-US',
  }

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'OpenRoute AI',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    description:
      locale === 'zh'
        ? 'OpenRoute AI 提供统一的 API 接口访问 400+ AI 模型，支持追踪、评估、提示管理和指标功能，帮助开发者调试和改进 LLM 应用。兼容 OpenAI SDK，按需付费。'
        : 'OpenRoute AI provides unified API access to 400+ AI models with traces, evals, prompt management and metrics to debug and improve LLM applications. OpenAI SDK compatible, pay-as-you-go pricing.',
    featureList: [
      locale === 'zh' ? '统一访问 400+ AI 模型' : 'Unified access to 400+ AI models',
      locale === 'zh' ? '追踪和评估功能' : 'Traces and evals',
      locale === 'zh' ? '提示管理' : 'Prompt management',
      locale === 'zh' ? '性能指标监控' : 'Performance metrics',
      locale === 'zh' ? 'OpenAI SDK 兼容' : 'OpenAI SDK compatible',
      locale === 'zh' ? '按需付费' : 'Pay-as-you-go pricing',
    ],
    url: baseUrl,
  }

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'AI API Gateway',
    provider: {
      '@type': 'Organization',
      name: 'OpenRoute AI',
    },
    areaServed: 'Worldwide',
    description:
      locale === 'zh'
        ? '提供统一的 AI 模型访问接口，支持 400+ AI 模型，包含追踪、评估、提示管理和指标功能，帮助开发者构建和优化 LLM 应用。'
        : 'Unified AI model access gateway supporting 400+ AI models with traces, evals, prompt management and metrics to help developers build and optimize LLM applications.',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  }

  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <AffonsoScript enableAffonsoAffiliate={websiteConfig.features.enableAffonsoAffiliate || false}  />
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
        />
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          'size-full antialiased',
          fontBricolageGrotesque.className,
          fontNotoSerif.variable,
          fontNotoSansMono.variable,
          fontBricolageGrotesque.variable
        )}
      >
        <NextIntlClientProvider>
          <Providers>
            <SmoothScroll>
            {children}
            </SmoothScroll>
            <Toaster richColors position='top-right' offset={64} />
            <TailwindIndicator />
            <Analytics />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
