import { Routes } from "../routes";

/**
 * website config, without translations
 *
 * docs:
 * https://mksaas.com/docs/config/website
 */
export const websiteConfig = {
  metadata: {
    title: '共绩CRM',
    authorName: '共绩CRM',
    icpNumber: '京ICP备2026001997号-1',
    gonganIcpNumber: '京公网安备11010502059490号',
    description:
      '共绩CRM 是一个用于构建和部署 AI 应用的平台。',
    base_url: 'https://crm.gongjiyun.com',
    theme: {
      defaultTheme: 'default',
      enableSwitch: false,
    },

    mode: {
      defaultMode: 'system',
      enableSwitch: true,
    },
    images: {
      ogImage: '/images/opengraph.png',
      logoLight: '/logo.png',
      logoDark: '/logo-dark.png',
    },
    social: {
      wechatId: 'qijianbin001',
      phoneNumber: '13681332236',
      email: 'service@gongjiyun.com',
      address: '北京市朝阳区东三环南路46号富顿中心A座20层',
      websiteUrl: 'https://www.gongjiyun.com',
      github: '',
      twitter: '',
      blueSky: '',
      discord: '',
      mastodon: '',
      linkedin: '',
      youtube: '',
      telegram: '',
      tiktok: '',
      instagram: '',
      facebook: '',
    },
  },
  features: {
    enableDiscordWidget: false,
    enableUpgradeCard: false,
    enableAffonsoAffiliate: false,
  },
  routes: {
    defaultLoginRedirect: Routes.Dashboard,
  },
  analytics: {
    enableVercelAnalytics: false,
    enableSpeedInsights: false,
  },
  auth: {
    emailSuffix: 'gongjiyun.com', // 邮箱后缀
    cookieDomain: process.env.NODE_ENV === 'production' ? '.gongjiyun.com' : '192.168.110.16',
    trustedOrigins:
      process.env.NODE_ENV === 'production'
        ? ['https://www.gongjiyun.com', 'https://gongjiyun.com']
        : ['http://localhost:30041', 'http://192.168.110.16:30041'], // 信任的来源列表，允许跨域请求
    enableGoogleLogin: false,
    enableGithubLogin: false,
    requireEmailVerification: false,
    autoSignInAfterVerification: true,
    smsProvider: (process.env.SMS_PROVIDER as 'tencent' | 'aliyun') || 'tencent', // 短信服务提供商: tencent 或 aliyun
  },
  i18n: {
    defaultLocale: 'zh',
    locales: {
      en: {
        flag: '🇺🇸',
        name: 'English',
      },
      zh: {
        flag: '🇨🇳',
        name: '中文',
      },
    },
  },
  blog: {
    paginationSize: 6,
    relatedPostsSize: 3,
  },
  mail: {
    provider: 'nodemailer' as const,
    fromEmail: '共绩CRM <service@gongjiyun.com>',
    supportEmail: '共绩CRM <service@gongjiyun.com>',
  },
  newsletter: {
    provider: 'nodemailer' as const,
    autoSubscribeAfterSignUp: true,
  },
  storage: {
    provider: 'oss',
  },
  payment: {
    provider: 'wechat',
  }
}
