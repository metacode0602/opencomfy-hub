import type { ReactNode } from 'react'

/**
 * website config, without translations
 */
export type WebsiteConfig = {
  metadata: MetadataConfig
  features: FeaturesConfig
  routes: RoutesConfig
  analytics: AnalyticsConfig
  auth: AuthConfig
  i18n: I18nConfig
  blog: BlogConfig
  mail: MailConfig
  newsletter: NewsletterConfig
  storage: StorageConfig
  payment: PaymentConfig
  price: PriceConfig
}

/**
 * Website metadata
 */
export interface MetadataConfig {
  mode?: ModeConfig
  theme?: ThemeConfig
  images?: ImagesConfig
  social?: SocialConfig
}

export interface ModeConfig {
  defaultMode?: 'light' | 'dark' | 'system' // The default mode of the website
  enableSwitch?: boolean // Whether to enable the mode switch
}

export interface ThemeConfig {
  defaultTheme?: 'default' | 'blue' | 'green' | 'amber' | 'neutral' // The default theme of the website
  enableSwitch?: boolean // Whether to enable the theme switch
}

export interface ImagesConfig {
  ogImage?: string // The image as Open Graph image
  logoLight?: string // The light logo image
  logoDark?: string // The dark logo image
}

/**
 * Social media configuration
 */
export interface SocialConfig {
  twitter?: string
  github?: string
  discord?: string
  blueSky?: string
  mastodon?: string
  youtube?: string
  linkedin?: string
  facebook?: string
  instagram?: string
  tiktok?: string
  telegram?: string
}

/**
 * Website features
 */
export interface FeaturesConfig {
  enableDiscordWidget?: boolean // Whether to enable the discord widget
  enableUpgradeCard?: boolean // Whether to enable the upgrade card in the sidebar
  enableAffonsoAffiliate?: boolean // Whether to enable affonso affiliate
}

/**
 * Routes configuration
 */
export interface RoutesConfig {
  defaultLoginRedirect?: string // The default login redirect route
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  enableVercelAnalytics?: boolean // Whether to enable vercel analytics
  enableSpeedInsights?: boolean // Whether to enable speed insights
}

export interface AuthConfig {
  enableGoogleLogin?: boolean // Whether to enable google login
  enableGithubLogin?: boolean // Whether to enable github login
  smsProvider?: 'tencent' | 'aliyun' // SMS provider: tencent or aliyun
  emailSuffix?: string // Email suffix for temporary email generation
  cookieDomain?: string // Cookie domain for authentication
  trustedOrigins?: string[] // Trusted origins for authentication
  requireEmailVerification?: boolean // Whether to require email verification
  autoSignInAfterVerification?: boolean // Whether to auto sign in after verification
}

/**
 * I18n configuration
 */
export interface I18nConfig {
  defaultLocale: string // The default locale of the website
  locales: Record<string, { flag?: string; name: string }> // The locales of the website
}

/**
 * Blog configuration
 */
export interface BlogConfig {
  paginationSize: number // Number of posts per page
  relatedPostsSize: number // Number of related posts to show
}

/**
 * Mail configuration
 */
export interface MailConfig {
  provider: 'resend' | 'nodemailer' // The email provider, only resend is supported for now
  fromEmail?: string // The email address to send from
  supportEmail?: string // The email address to send support emails to
}

/**
 * Newsletter configuration
 */
export interface NewsletterConfig {
  provider: 'resend' | 'Nodemailer' // The newsletter provider, only resend is supported for now
  autoSubscribeAfterSignUp?: boolean // Whether to automatically subscribe users to the newsletter after sign up
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  provider: 's3' | 'oss' // The storage provider, supports s3 and oss
}

/**
 * Payment configuration
 */
export interface PaymentConfig {
  provider: 'stripe' // The payment provider, only stripe is supported for now
}

/**
 * Price configuration
 */
export interface PriceConfig {
  plans: Record<string, PricePlan> // Plans indexed by ID
}

/**
 * menu item, used for navbar links, sidebar links, footer links
 */
export type MenuItem = {
  title: string // The text to display
  description?: string // The description of the item
  icon?: ReactNode // The icon to display
  href?: string // The url to link to
  external?: boolean // Whether the link is external
  authorizeOnly?: string[] // The roles that are authorized to see the item
}

/**
 * nested menu item, used for navbar links, sidebar links, footer links
 */
export type NestedMenuItem = MenuItem & {
  items?: MenuItem[] // The items to display in the nested menu
}

// Shared types for Composio integration

export type ConnectorType =
  | 'gmail'
  | 'googlecalendar'
  | 'notion'
  | 'googledrive'
  | 'googledocs'
  | 'googlesheets'
  | 'slack'
  | 'linear'
  | 'github'
  | 'twitter'
