
import { websiteConfig } from '@/lib/config/website'
import { sendInquiryNotifySms } from '@/lib/sms-notify'
import { sendEmail } from '@/lib/mail'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import contactInquiriesDataAccess from '@/lib/server/actions/contact-inquiries'

/**
 * DOC: When using Zod for validation, how can I localize error messages?
 * https://next-intl.dev/docs/environments/actions-metadata-route-handlers#server-actions
 */
const contactFormSchema = z.object({
  name: z
    .string()
    .min(3, { message: 'Name must be at least 3 characters' })
    .max(30, { message: 'Name must not exceed 30 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  message: z
    .string()
    .min(10, { message: 'Message must be at least 10 characters' })
    .max(500, { message: 'Message must not exceed 500 characters' }),
  phone: z.string().max(20).optional(),
})

export type ContactFormInput = z.infer<typeof contactFormSchema>

export const sendMessageAction = async (parsedInput: ContactFormInput) => {
  try {
    const { name, email, message, phone } = parsedInput

    if (!websiteConfig.mail.supportEmail) {
      console.error('The mail receiver is not set')
      throw new Error('The mail receiver is not set')
    }

    // 1. 保存到数据库（phone 未填时用占位符，表字段为 notNull）
    const inquiry = await contactInquiriesDataAccess.createContactInquiry({
      name,
      phone: phone?.trim() || '未填写',
      email,
      message,
    })
    if (!inquiry) {
      console.error('save contact inquiry error')
      return { success: false, error: 'Failed to save the message' }
    }

    const locale = await getLocale()

    // 2. 发送邮件给管理员
    const result = await sendEmail({
      to: websiteConfig.mail.supportEmail,
      template: 'contactMessage',
      context: {
        name,
        email,
        message,
      },
      locale,
    })

    if (!result) {
      console.error('send message email error')
      return { success: false, error: 'Failed to send the message' }
    }

    // 3. 异步发送通知短信（不阻塞响应，使用 ALIYUN_SMS_TEMPLATE_CODE_NOTIFY）
    void sendInquiryNotifySms({
      name,
      email,
      message,
      phone: phone?.trim(),
    }).catch((err: unknown) => console.error('[send-message] notify SMS error:', err))

    return { success: true }
  } catch (error) {
    console.error('send message error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Something went wrong',
    }
  }
}
