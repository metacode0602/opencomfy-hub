import type { Locale, Messages } from 'next-intl'

/** Used by React Email previews only; real sends use app `getMessagesForLocale`. */
export const previewDefaultLocale = 'en' as Locale

export const previewMessages = {
  Metadata: { name: '共绩CRM' },
  Mail: {
    common: {
      team: 'The {name} team',
      copyright: '© {year} All rights reserved.',
    },
    verifyEmail: {
      subject: 'Verify your email',
      title: 'Hello {name}',
      body: 'Click the button below to verify your email address.',
      confirmEmail: 'Verify email',
    },
    forgotPassword: {
      subject: 'Reset your password',
      title: 'Hello {name}',
      body: 'We received a request to reset your password.',
      resetPassword: 'Reset password',
    },
    contactMessage: {
      subject: 'Contact message',
      name: 'Name: {name}',
      email: 'Email: {email}',
      message: 'Message: {message}',
    },
    subscribeNewsletter: {
      subject: 'Newsletter',
      body: 'You are subscribed to our newsletter.',
    },
  },
} as unknown as Messages
