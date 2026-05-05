import EmailLayout from '../components/email-layout'
import { previewDefaultLocale, previewMessages } from '../preview-messages'
import type { BaseEmailProps } from '../types'
import { Text } from '@react-email/components'
import { createTranslator } from 'use-intl/core'

interface ContactMessageProps extends BaseEmailProps {
  name: string
  email: string
  message: string
}

export function ContactMessage({ name, email, message, locale, messages }: ContactMessageProps) {
  const t = createTranslator({
    locale,
    messages,
    namespace: 'Mail.contactMessage',
  })

  return (
    <EmailLayout locale={locale} messages={messages}>
      <Text>{t('name', { name })}</Text>
      <Text>{t('email', { email })}</Text>
      <Text>{t('message', { message })}</Text>
    </EmailLayout>
  )
}

ContactMessage.PreviewProps = {
  locale: previewDefaultLocale,
  messages: previewMessages,
  name: 'username',
  email: 'username@example.com',
  message: 'This is a test message',
}

export default ContactMessage
