import { Routes } from "../routes";

/**
 * website config, without translations
 *
 * docs:
 * https://mksaas.com/docs/config/website
 */
export const websiteConfig = {
  metadata: {
    title: 'Vercel AI',
    description:
      '字节聚力（北京）科技有限公司是一家专注AI搜索时代的数字营销服务商，提供GEO生成式搜索引擎优化解决方案，帮助企业在AI驱动的信息检索时代抢占先机。',
    base_url: 'https://www.vercelai.cn',
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
      email: 'service@vercelai.cn',
      address: '北京市朝阳区百富国际大厦A座28F',
      websiteUrl: 'https://www.vercelai.cn',
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
    emailSuffix: 'vercelai.cn', // 邮箱后缀
    cookieDomain: process.env.NODE_ENV === 'production' ? '.vercelai.cn' : 'localhost',
    trustedOrigins:
      process.env.NODE_ENV === 'production'
        ? ['https://www.vercelai.cn', 'https://vercelai.cn']
        : ['http://localhost:30041'],
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
    fromEmail: 'VercelAI <service@vercelai.cn>',
    supportEmail: 'VercelAI <service@vercelai.cn>',
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
