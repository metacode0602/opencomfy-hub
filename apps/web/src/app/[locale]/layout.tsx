import { Analytics } from '@workspace/shared-next/analytics'
import { fontBricolageGrotesque, fontNotoSansMono, fontNotoSerif } from '@workspace/shared-next/assets/fonts'
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
  icons: { icon: "/favicon.ico" },
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
  return (
    <html suppressHydrationWarning lang={locale}>
      <head>
        <AffonsoScript enableAffonsoAffiliate={websiteConfig.features.enableAffonsoAffiliate || false}  />
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
