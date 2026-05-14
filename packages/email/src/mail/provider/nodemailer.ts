import type { GetTemplateFn, MailProvider, SendEmailResult, SendRawEmailParams, SendTemplateParams } from '../types'
import nodemailer from 'nodemailer'

export interface NodemailerProviderDeps {
  fromEmail: string
  getTemplate: GetTemplateFn
}

/**
 * Nodemailer mail provider implementation
 */
export class NodemailerProvider implements MailProvider {
  private transporter: nodemailer.Transporter
  private from: string
  private getTemplate: GetTemplateFn

  constructor(deps: NodemailerProviderDeps) {
    if (!deps.fromEmail) {
      throw new Error('Default from email address is not set (mail.fromEmail).')
    }

    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }

    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      console.warn('SMTP credentials not found, using default configuration for development')
      this.transporter = nodemailer.createTransport({
        host: 'localhost',
        port: 1025,
        secure: false,
        ignoreTLS: true,
      })
    } else {
      this.transporter = nodemailer.createTransport(smtpConfig)
    }

    this.from = process.env.SMTP_FROM ?? deps.fromEmail
    this.getTemplate = deps.getTemplate
  }

  public getProviderName(): string {
    return 'nodemailer'
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
      const info = await this.transporter.sendMail({ from: this.from, to, subject, html, text })
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('Error sending email:', error)
      return { success: false, error }
    }
  }

  public async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      return true
    } catch (error) {
      console.error('SMTP connection verification failed:', error)
      return false
    }
  }
}
