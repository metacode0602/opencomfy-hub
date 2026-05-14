import { createMailService } from '@workspace/email/mail'
import { websiteConfig } from '@/lib/config/website'
import { getMessagesForLocale } from '@/lib/i18n/messages'
import { routing } from '@/lib/i18n/routing'

const mail = createMailService({
  defaultLocale: routing.defaultLocale,
  getMessagesForLocale,
  mail: websiteConfig.mail,
})

export const sendEmail = mail.sendEmail
export const getTemplate = mail.getTemplate
export const getMailProvider = mail.getMailProvider
export const initializeMailProvider = mail.initializeMailProvider
