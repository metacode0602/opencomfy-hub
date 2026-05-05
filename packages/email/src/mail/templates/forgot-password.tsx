import EmailButton from '../components/email-button'
import EmailLayout from '../components/email-layout'
import { previewDefaultLocale, previewMessages } from '../preview-messages'
import type { BaseEmailProps } from '../types'
import { Text } from '@react-email/components'
import { createTranslator } from 'use-intl/core'

interface ForgotPasswordProps extends BaseEmailProps {
  url: string
  name: string
}

export function ForgotPassword({ url, name, locale, messages }: ForgotPasswordProps) {
  const t = createTranslator({
    locale,
    messages,
    namespace: 'Mail.forgotPassword',
  })

  return (
    <EmailLayout locale={locale} messages={messages}>
      <Text>{t('title', { name })}</Text>
      <Text>{t('body')}</Text>
      <EmailButton href={url}>{t('resetPassword')}</EmailButton>
    </EmailLayout>
  )
}

ForgotPassword.PreviewProps = {
  locale: previewDefaultLocale,
  messages: previewMessages,
  url: 'https://www.openroute.cn',
  name: 'username',
}

export default ForgotPassword
