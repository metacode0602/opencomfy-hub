
/**
 * website config, without translations
 *
 * docs:
 * https://mksaas.com/docs/config/website
 */
export const websiteConfig = {
  metadata: {
    title: '字节聚力',
    description:
      '字节聚力（北京）科技有限公司是一家专注AI搜索时代的数字营销服务商，提供GEO生成式搜索引擎优化解决方案，帮助企业在AI驱动的信息检索时代抢占先机。',
    base_url: 'https://www.bytemarketing.net',
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
      email: 'service@bytemarketing.net',
      address: '北京市朝阳区百富国际大厦A座28F',
      websiteUrl: 'https://www.bytemarketing.net',
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
  analytics: {
    enableVercelAnalytics: false,
    enableSpeedInsights: false,
  },
  auth: {
    emailSuffix: '@bytemarketing.net', // 邮箱后缀
    cookieDomain: process.env.NODE_ENV === 'production' ? '.bytemarketing.net' : 'localhost',
    trustedOrigins:
      process.env.NODE_ENV === 'production'
        ? ['https://www.bytemarketing.net', 'https://bytemarketing.net']
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
    provider: 'nodemailer',
    fromEmail: 'ByteMarketing <service@julianshuke.com>',
    supportEmail: 'ByteMarketing <service@bytemarketing.net>',
  },
  newsletter: {
    provider: 'nodemailer',
    autoSubscribeAfterSignUp: true,
  },
  storage: {
    provider: 'oss',
  },
  payment: {
    provider: 'wechat',
  }
}
