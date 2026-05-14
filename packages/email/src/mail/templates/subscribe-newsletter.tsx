import EmailLayout from '../components/email-layout'
import { previewDefaultLocale, previewMessages } from '../preview-messages'
import type { BaseEmailProps } from '../types'
import { Heading, Text } from '@react-email/components'
import { createTranslator } from 'use-intl/core'

interface SubscribeNewsletterProps extends BaseEmailProps {}

export function SubscribeNewsletter({ locale, messages }: SubscribeNewsletterProps) {
  const t = createTranslator({
    locale,
    messages,
    namespace: 'Mail.subscribeNewsletter',
  })

  return (
    <EmailLayout locale={locale} messages={messages}>
      <Heading className='text-xl'>{t('subject')}</Heading>
      <Text>{t('body')}</Text>
    </EmailLayout>
  )
}

SubscribeNewsletter.PreviewProps = {
  locale: previewDefaultLocale,
  messages: previewMessages,
}

export default SubscribeNewsletter
