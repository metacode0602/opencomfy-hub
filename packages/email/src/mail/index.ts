import { render } from '@react-email/render'
import { createElement, type ComponentType, type ReactElement } from 'react'
import type { Locale } from 'next-intl'
import type { CreateMailServiceOptions } from './config'
import { NodemailerProvider } from './provider/nodemailer'
import { ResendProvider } from './provider/resend'
import {
  type EmailTemplate,
  EmailTemplates,
  type GetTemplateFn,
  type MailProvider,
  type SendRawEmailParams,
  type SendTemplateParams,
} from './types'

export type { CreateMailServiceOptions, MailFromConfig, MailProviderId } from './config'
export * from './types'
export { previewDefaultLocale, previewMessages } from './preview-messages'

export interface MailService {
  sendEmail(params: SendTemplateParams | SendRawEmailParams): Promise<boolean>
  getTemplate: GetTemplateFn
  getMailProvider(): MailProvider
  initializeMailProvider(): MailProvider
}

/**
 * Create a mail service bound to app i18n and outbound mail config.
 * Instantiate once per process (e.g. in `apps/web/src/lib/mail.ts`) and export `sendEmail`.
 */
export function createMailService(options: CreateMailServiceOptions): MailService {
  let mailProvider: MailProvider | null = null

  const getTemplate: GetTemplateFn = async ({ template, context, locale = options.defaultLocale }) => {
    const Template = EmailTemplates[template] as unknown as ComponentType<Record<string, unknown>>
    const messages = await options.getMessagesForLocale(locale)

    const email = createElement(Template, {
      ...context,
      locale,
      messages,
    } as Record<string, unknown>) as ReactElement

    let subject = ''
    try {
      const mailMessages = messages.Mail as Record<string, { subject?: string }> | undefined
      const entry = mailMessages?.[template]
      if (entry && 'subject' in entry && typeof entry.subject === 'string') {
        subject = entry.subject
      }
    } catch {
      subject = ''
    }

    if (!subject && 'subject' in context) {
      subject = String(context.subject)
    }

    if (!subject) {
      const getErrorTypeLabel = (errorType?: string) => {
        switch (errorType) {
          case 'parse_error':
            return 'XML 解析错误'
          case 'validation_error':
            return '数据验证错误'
          case 'processing_error':
            return '业务处理错误'
          case 'unknown_error':
            return '未知错误'
          default:
            return '错误'
        }
      }

      const defaultSubjects: Record<string, string> = {
        litellmBudgetUpdateFailed: `[OpenRoute Proxy] 预算更新失败 - 订单 ${String(context.orderId ?? '')}`,
        syncErrorNotification: `[OpenRoute Proxy 同步任务] 同步异常通知 - ${String(context.syncDate ?? '')}`,
        wechatBudgetUpdateFailed: `[微信支付] OpenRoute Proxy 预算更新失败通知 - 订单 ${String(context.orderId ?? '')}`,
        wechatWebhookFailed: `[微信支付 Webhook] ${getErrorTypeLabel(String(context.errorType))} - ${context.orderId ? `订单 ${String(context.orderId)}` : '未知订单'}`,
      }
      subject = defaultSubjects[template] ?? ''
    }

    const html = await render(email)
    const text = await render(email, { plainText: true })

    return { html, text, subject }
  }

  const initializeMailProvider = (): MailProvider => {
    if (!mailProvider) {
      const deps = { fromEmail: options.mail.fromEmail, getTemplate }
      if (options.mail.provider === 'resend') {
        mailProvider = new ResendProvider(deps)
      } else if (options.mail.provider === 'nodemailer') {
        mailProvider = new NodemailerProvider(deps)
      } else {
        throw new Error(`Unsupported mail provider: ${String(options.mail.provider)}`)
      }
    }
    return mailProvider
  }

  const getMailProvider = (): MailProvider => {
    if (!mailProvider) {
      return initializeMailProvider()
    }
    return mailProvider
  }

  const sendEmail = async (params: SendTemplateParams | SendRawEmailParams): Promise<boolean> => {
    const provider = getMailProvider()
    if ('template' in params) {
      const result = await provider.sendTemplate(params)
      return result.success
    }
    const result = await provider.sendRawEmail(params)
    return result.success
  }

  return {
    sendEmail,
    getTemplate,
    getMailProvider,
    initializeMailProvider,
  }
}
