import type { Locale, Messages } from 'next-intl'

export type MailProviderId = 'resend' | 'nodemailer'

export interface MailFromConfig {
  provider: MailProviderId
  fromEmail: string
}

export interface CreateMailServiceOptions {
  defaultLocale: Locale
  getMessagesForLocale: (locale: Locale) => Promise<Messages>
  mail: MailFromConfig
}
