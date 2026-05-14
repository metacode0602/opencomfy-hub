import type { Locale } from 'next-intl'
import { websiteConfig } from '@/lib/config/website'
import { getDefaultKeywords } from '@/lib/seo/metadata'
import { Routes } from '@/lib/routes'
import { getBaseUrl } from '@/lib/utils/urls'

/** */
const ORGANIZATION_LEGAL_NAME = ''
const BRAND_NAME = websiteConfig.metadata.title
const PRODUCT_NAME = websiteConfig.metadata.title

function extractEmail(supportDisplay: string): string {
  const m = supportDisplay.match(/<([^>]+)>/)
  return m?.[1] ?? supportDisplay
}

function absoluteFromPath(path: string): string {
  const base = getBaseUrl().replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

function sameAsFromSocial(): string[] {
  const s = websiteConfig.metadata.social
  if (!s) return []
  return (
    [
      s.twitter,
      s.github,
      s.linkedin,
      s.youtube,
      s.discord,
      s.mastodon,
      s.blueSky,
      s.telegram,
      s.facebook,
      s.instagram,
      s.tiktok,
    ] as string[]
  ).filter((u) => typeof u === 'string' && u.length > 0)
}

function webSiteInLanguage(locale: Locale): string {
  return locale === 'zh' ? 'zh-CN' : 'en'
}

export function buildHomeJsonLd(input: {
  locale: Locale
  canonicalUrl: string
  siteTitle: string
  siteDescription: string
}): Record<string, unknown> {
  const { locale, canonicalUrl, siteTitle, siteDescription } = input
  const base = getBaseUrl().replace(/\/$/, '')
  const orgId = `${base}/#organization`
  const websiteId = `${canonicalUrl.replace(/\/$/, '')}#website`
  const softwareId = `${canonicalUrl.replace(/\/$/, '')}#software`

  const logoUrl = absoluteFromPath(websiteConfig.metadata.images.logoLight)
  const imageUrl = absoluteFromPath(websiteConfig.metadata.images.ogImage)
  const supportEmail = extractEmail(websiteConfig.mail.supportEmail)
  const sameAs = sameAsFromSocial()

  const organization: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': orgId,
    name: BRAND_NAME,
    legalName: ORGANIZATION_LEGAL_NAME,
    url: base,
    logo: { '@type': 'ImageObject', url: logoUrl },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: supportEmail,
    },
  }
  if (sameAs.length > 0) {
    organization.sameAs = sameAs
  }

  const website: Record<string, unknown> = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: canonicalUrl,
    name: siteTitle,
    description: siteDescription,
    inLanguage: webSiteInLanguage(locale),
    publisher: { '@id': orgId },
  }

  const featureList = getDefaultKeywords(locale)

  const softwareApplication: Record<string, unknown> = {
    '@type': 'SoftwareApplication',
    '@id': softwareId,
    name: PRODUCT_NAME,
    description: siteDescription,
    url: canonicalUrl,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    image: imageUrl,
    brand: { '@type': 'Brand', name: BRAND_NAME },
    publisher: { '@id': orgId },
    offers: {
      '@type': 'Offer',
      url: `${base}${Routes.Pricing}`,
      description:
        locale === 'zh'
          ? '计费方式与价格以官网定价页为准。'
          : 'Billing and prices are defined on the official pricing page.',
    },
    featureList,
    softwareHelp: `${base}${Routes.Docs}`,
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [organization, website, softwareApplication],
  }
}
