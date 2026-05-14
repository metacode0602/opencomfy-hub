import type { GetTemplateFn, MailProvider, SendEmailResult, SendRawEmailParams, SendTemplateParams } from '../types'
import { Resend } from 'resend'

export interface ResendProviderDeps {
  fromEmail: string
  getTemplate: GetTemplateFn
}

/**
 * Resend mail provider implementation
 */
export class ResendProvider implements MailProvider {
  private resend: Resend
  private from: string
  private getTemplate: GetTemplateFn

  constructor(deps: ResendProviderDeps) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set.')
    }
    if (!deps.fromEmail) {
      throw new Error('Default from email address is not set (mail.fromEmail).')
    }
    this.resend = new Resend(process.env.RESEND_API_KEY)
    this.from = deps.fromEmail
    this.getTemplate = deps.getTemplate
  }

  public getProviderName(): string {
    return 'resend'
  }

  public async sendTemplate(params: SendTemplateParams): Promise<SendEmailResult> {
    const { to, template, context, locale } = params
    try {
      const mailTemplate = await this.getTemplate({
        template,
        context,
        locale,
      })
      return this.sendRawEmail({
        to,
        subject: mailTemplate.subject,
        html: mailTemplate.html,
        text: mailTemplate.text,
      })
    } catch (error) {
      console.error('Error sending template email:', error)
      return { success: false, error }
    }
  }

  public async sendRawEmail(params: SendRawEmailParams): Promise<SendEmailResult> {
    const { to, subject, html, text } = params
    if (!this.from || !to || !subject || !html) {
      console.warn('Missing required fields for email send', { from: this.from, to, subject, html })
      return { success: false, error: 'Missing required fields' }
    }
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
        text,
      })
      if (error) {
        console.error('Error sending email', error)
        return { success: false, error }
      }
      return { success: true, messageId: data?.id }
    } catch (error) {
      console.error('Error sending email:', error)
      return { success: false, error }
    }
  }
}
