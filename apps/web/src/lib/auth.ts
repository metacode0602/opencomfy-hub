import { db } from './db'

import { OrganizationInvitationEmail } from '@workspace/email'
import { getActiveOrganization } from '@/lib/server/actions/organizations'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import {
  admin as adminPlugin,
  lastLoginMethod,
  organization as organizationPlugin,
  phoneNumber,
} from 'better-auth/plugins'
import { admin, member as MemberRole, owner } from '@workspace/auth'
import { invitation, member, organization } from '@workspace/db/schema'
import { account, session,user, verification } from '@workspace/db/schema'
import { Locale } from 'next-intl'
import { parse as parseCookies } from 'cookie'
import { websiteConfig } from './config/website'
import { getUrlWithLocaleInCallbackUrl } from '@/lib/utils/urls'
import { getUserById } from '@/lib/server/actions/users'
import { sendEmail } from '@/lib/mail'
import { LOCALE_COOKIE_NAME, routing } from '@/lib/i18n/routing'
import { render } from '@react-email/render'
import { createElement } from 'react'
import * as tencentcloud from 'tencentcloud-sdk-nodejs'

const isProd = process.env.NODE_ENV === 'production'

export const auth = betterAuth({
  advanced: {
    ...(isProd && {
      crossSubDomainCookies: {
        enabled: true,
        domain: websiteConfig.auth.cookieDomain,
        additionalCookies: ['better-auth.session_token'],
      },
    }),
  },
  trustedOrigins: websiteConfig.auth.trustedOrigins,

  emailAndPassword: {
    enabled: true,
    // https://www.better-auth.com/docs/concepts/email#2-require-email-verification
    requireEmailVerification: websiteConfig.auth.requireEmailVerification,
    // https://www.better-auth.com/docs/authentication/email-password#forget-password
    async sendResetPassword({ user, url }, request) {
      const locale = getLocaleFromRequest(request)
      const localizedUrl = getUrlWithLocaleInCallbackUrl(url, locale)

      await sendEmail({
        to: user.email,
        template: 'forgotPassword',
        context: {
          url: localizedUrl,
          name: user.name,
        },
        locale,
      })
    },
  },
  emailVerification: {
    // https://www.better-auth.com/docs/concepts/email#auto-signin-after-verification
    autoSignInAfterVerification: websiteConfig.auth.autoSignInAfterVerification,
    // https://www.better-auth.com/docs/authentication/email-password#require-email-verification
    sendVerificationEmail: async ({ user, url, token }, request) => {
      const locale = getLocaleFromRequest(request)
      const localizedUrl = getUrlWithLocaleInCallbackUrl(url, locale)

      await sendEmail({
        to: user.email,
        template: 'verifyEmail',
        context: {
          url: localizedUrl,
          name: user.name,
        },
        locale,
      })
    },
    // 邮箱验证成功后的钩子
    onVerification: async ({ user }: any) => {
      // 邮箱验证成功后自动订阅新闻邮件
      if (
        user.email &&
        websiteConfig.newsletter.autoSubscribeAfterSignUp &&
        !user.email.endsWith(websiteConfig.auth.emailSuffix)
      ) {
        try {
          const subscribed = await subscribeUserToNewsletter(user.email)
          if (!subscribed) {
            console.error(`Failed to subscribe user ${user.email} to newsletter`)
          } else {
            console.log(`User ${user.email} subscribed to newsletter after email verification`)
          }
        } catch (error) {
          console.error('Newsletter subscription error after email verification:', error)
        }
      }
    },
  },
  socialProviders: {
    ...(websiteConfig.auth.enableGoogleLogin && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    }),
    ...(websiteConfig.auth.enableGithubLogin && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
    }),
  },
  account: {
    // https://www.better-auth.com/docs/concepts/users-accounts#account-linking
    accountLinking: {
      enabled: true,
      trustedProviders: ['github'],
    },
  },
  user: {
    // https://www.better-auth.com/docs/concepts/database#extending-core-schema
    additionalFields: {
      customerId: {
        type: 'string',
        required: false,
      },
      mustChangePassword: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
    },
    // https://www.better-auth.com/docs/concepts/users-accounts#delete-user
    deleteUser: {
      enabled: true,
    },
  },
  databaseHooks: {
    // https://www.better-auth.com/docs/concepts/database#database-hooks
    user: {
      create: {
        after: async (user) => {
          // Auto create organization for user
          // 用户创建成功后自动创建同名organization
          try {
            await auth.api.createOrganization({
              body: {
                name: user.name || user.email?.split('@')[0] || 'user', // 使用用户名或邮箱前缀作为组织名
                slug: (user.name || user.email?.split('@')[0] || 'user').toLowerCase().replace(/\s+/g, '-'),
                userId: user.id,
                metadata: {
                  langfuse: {
                    organization: {
                      id: process.env.LANGFUSE_ORG_ID as string,
                      publicKey: process.env.LANGFUSE_ORG_PUBLIC_KEY as string,
                      secretKey: process.env.LANGFUSE_ORG_SECRET_KEY as string,
                    },
                  },
                },
              },
            })
          } catch (error) {
            console.error('Failed to create organization for user:', error)
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const organization = await getActiveOrganization(session.userId)
          if (!organization?.organization || !organization?.organization?.id) {
            const userInfo = await getUserById(session.userId);
            if (userInfo && userInfo.id) {
              const newOrganization = await auth.api.createOrganization({
                body: {
                  name: userInfo?.email || userInfo?.name || '',
                  slug: (userInfo?.email?.replace('@', '-') || userInfo.id).toLowerCase().replace(/\s+/g, '-'),
                  userId: userInfo?.id,
                  metadata: {
                    langfuse: {
                      organization: {
                        id: process.env.LANGFUSE_ORG_ID as string,
                        publicKey: process.env.LANGFUSE_ORG_PUBLIC_KEY as string,
                        secretKey: process.env.LANGFUSE_ORG_SECRET_KEY as string,
                      },
                    },
                  },
                },
              });
              const newId = newOrganization?.id as string;
              return {
                data: {
                  ...session,
                  activeOrganizationId: newId,
                },
              }
            }
          }
          return {
            data: {
              ...session,
              activeOrganizationId: organization?.organization?.id,
            },
          }
        },
        after: async (createdSession) => {
          try {
            const userInfo = await getUserById(createdSession.userId)
            if (!userInfo) return
            const { autoLinkStaffForAuthUser } = await import(
              '@/lib/server/dataaccess/crm/staff-auth'
            )
            await autoLinkStaffForAuthUser({
              id: userInfo.id,
              email: userInfo.email,
              phoneNumber: userInfo.phoneNumber,
            })
          } catch (error) {
            console.error('Failed to auto-link staff for auth user:', error)
          }
        },
      },
    },
  },

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: user,
      session: session,
      account: account,
      verification: verification,
      organization: organization,
      member: member,
      invitation: invitation,
    },
  }),
  plugins: [
    organizationPlugin({
      async sendInvitationEmail(data) {
        const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/accept-invitation/${data.id}`
        const html = await render(
          createElement(OrganizationInvitationEmail, {
            email: data.email,
            invitedByUsername: data.inviter.user.name,
            invitedByEmail: data.inviter.user.email,
            teamName: data.organization.name,
            inviteLink,
          }),
        )
        const text = await render(
          createElement(OrganizationInvitationEmail, {
            email: data.email,
            invitedByUsername: data.inviter.user.name,
            invitedByEmail: data.inviter.user.email,
            teamName: data.organization.name,
            inviteLink,
          }),
          { plainText: true },
        )
        await sendEmail({
          to: data.email,
          subject: "You've been invited to join our organization",
          html,
          text,
        })
      },
      roles: {
        owner,
        admin,
        member: MemberRole,
      },
    }),
    // https://www.better-auth.com/docs/plugins/admin
    // support user management, ban/unban user, manage user roles, etc.
    adminPlugin({
      // https://www.better-auth.com/docs/plugins/admin#default-ban-reason
      // defaultBanReason: 'Spamming',
      defaultBanExpiresIn: undefined,
      bannedUserMessage:
        'You have been banned from this application. Please contact support if you believe this is an error.',
    }),
    phoneNumber({
      sendOTP: async ({ phoneNumber, code }, request) => {
        // Implement sending OTP code via SMS
        console.log(`Sending OTP ${code} to phone number ${phoneNumber}`)
        // 实际项目中需要替换为真实的短信发送逻辑
        if (isProd) {
          // 生产环境下才发送短信
          await sendSmsCodeByTecent(phoneNumber, code)
        }
      },
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => {
          return `${phoneNumber}@${websiteConfig.auth.emailSuffix}`
        },
        //optionally, you can also pass `getTempName` function to generate a temporary name for the user
        getTempName: (phoneNumber) => {
          return phoneNumber //by default, it will use the phone number as the name
        },
      },
    }),
    lastLoginMethod(),
    nextCookies(),
  ],
  onAPIError: {
    // https://www.better-auth.com/docs/reference/options#onapierror
    errorURL: '/auth/error',
    onError: (error, ctx) => {
      console.error('auth error:', error, ctx?.session?.user)
    },
  },
})

/**
 * Gets the locale from a request by parsing the cookies
 * If no locale is found in the cookies, returns the default locale
 *
 * @param request - The request to get the locale from
 * @returns The locale from the request or the default locale
 */
export function getLocaleFromRequest(request?: Request): Locale {
  const cookies = parseCookies(request?.headers.get('cookie') ?? '')
  return (cookies[LOCALE_COOKIE_NAME] as Locale) ?? routing.defaultLocale
}

/** Hook newsletter provider here (e.g. mailing list API). */
async function subscribeUserToNewsletter(_email: string): Promise<boolean> {
  return false
}

async function sendSmsCodeByTecent(phone: string, code: string) {
  const SmsClient = tencentcloud.sms.v20210111.Client
  // 实例化要请求产品(以cvm为例)的client对象
  const client = new SmsClient({
    // 为了保护密钥安全，建议将密钥设置在环境变量中或者配置文件中，请参考本文凭证管理章节。
    // 硬编码密钥到代码中有可能随代码泄露而暴露，有安全隐患，并不推荐。
    credential: {
      secretId: process.env.COS_SECERT_ID,
      secretKey: process.env.COS_SECERT_KEY,
    },
    // 产品地域
    region: 'ap-nanjing',
    // 可选配置实例
    profile: {
      signMethod: 'TC3-HMAC-SHA256', // 签名方法
      httpProfile: {
        reqMethod: 'POST', // 请求方法
        reqTimeout: 30, // 请求超时时间，默认60s
      },
    },
  })
  // 通过client对象调用想要访问的接口（Action），需要传入请求对象（Params）以及响应回调函数
  // 即：client.Action(Params).then(res => console.log(res), err => console.error(err))
  // 如：查询云服务器可用区列表
  try {
    const resp = await client.SendSms({
      PhoneNumberSet: [phone],
      SmsSdkAppId: process.env.COS_SMS_APPID ?? '',
      TemplateId: process.env.COS_SMS_TEMPLATEID ?? '',
      SignName: process.env.COS_SMS_SIGN_NAME ?? '',
      TemplateParamSet: [code + '', '5'],
    })
    console.warn('resposne:', resp)
    return { code: 200, data: { ...resp } }
  } catch (error) {
    console.warn('error:', JSON.stringify(error))
    return { code: 500, msg: JSON.stringify(error) }
  }
}
