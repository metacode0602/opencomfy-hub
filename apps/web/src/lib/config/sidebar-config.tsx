'use client'

import { Routes } from '@/lib/routes'
import type { NestedMenuItem } from '@/lib/types/index'
import { FileTextIcon, NewspaperIcon, FolderTreeIcon, UserPenIcon, DollarSign, MapPinIcon, Building2Icon, ImageIcon, Brain, Lightbulb, TagsIcon, Quote, Link2Icon, Package, Send, BuildingIcon, Box, CloudRainWind, ChartBarIcon, GlobeIcon, ClipboardListIcon, UserCogIcon, BellRingIcon, BarChart2Icon } from 'lucide-react'
import {
  ActivityIcon,
  CameraIcon,
  BellIcon,
  BookXIcon,
  CircleUserRoundIcon,
  CreditCardIcon,
  DollarSignIcon,
  HistoryIcon,
  LockKeyholeIcon,
  MailIcon,
  MessageCircleIcon,
  Settings2Icon,
  SettingsIcon,
  UsersRoundIcon,
  BookOpenIcon,
  LayoutDashboardIcon,
  UserPlusIcon,
  SidebarIcon,
} from 'lucide-react'
import type { useTranslations } from 'next-intl'

/**
 * Get sidebar config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://openroute.cn/docs/config/sidebar
 *
 * @param t - Translation function from useTranslations('Dashboard')
 * @returns The sidebar config with translated titles and descriptions
 */
export function getSidebarLinks(t: ReturnType<typeof useTranslations<'Dashboard'>>): NestedMenuItem[] {
  return [
    {
      title: t('dashboard.title'),
      icon: <LayoutDashboardIcon className='size-4 shrink-0' />,
      href: Routes.Dashboard,
      external: false,
    },
    {
      title: 'GEO智能分析',
      icon: <BookOpenIcon className='size-4 shrink-0' />,
      authorizeOnly: ['user', 'admin'],
      items: [
        {
          title: '关键词库',
          icon: <TagsIcon className='size-4 shrink-0' />,
          href: Routes.UserKeywords,
          external: false,
        },
        {
          title: '文章生成',
          icon: <FileTextIcon className='size-4 shrink-0' />,
          href: Routes.UserArticles,
          external: false,
        },
        {
          title: '竞争对手',
          icon: <Building2Icon className='size-4 shrink-0' />,
          href: Routes.UserCompetitors,
          external: false,
        },
        {
          title: '发布记录',
          icon: <Send className='size-4 shrink-0' />,
          href: Routes.UserRecords,
          external: false,
        },
        {
          title: '引用监测',
          icon: <Quote className='size-4 shrink-0' />,
          href: Routes.UserCitations,
          external: false,
        },
        {
          title: '品牌管理',
          icon: <BuildingIcon className='size-4 shrink-0' />,
          href: Routes.UserBrands,
          external: false,
        },
        {
          title: '产品服务',
          icon: <Box className='size-4 shrink-0' />,
          href: Routes.UserProducts,
          external: false,
        },
      ],
    },
    {
      title: '内容',
      icon: <BookOpenIcon className='size-4 shrink-0' />,
      authorizeOnly: ['user', 'admin'],
      items: [
        {
          title: '素材库',
          icon: <ImageIcon className='size-4 shrink-0' />,
          href: Routes.UserMedias,
          external: false,
        },
        {
          title: '知识库',
          icon: <Brain className='size-4 shrink-0' />,
          href: Routes.UserKnowledge,
          external: false,
        },
        {
          title: 'AI提示词',
          icon: <Lightbulb className='size-4 shrink-0' />,
          href: Routes.UserPrompts,
          external: false,
        },
        {
          title: '标签',
          icon: <TagsIcon className='size-4 shrink-0' />,
          href: Routes.UserTags,
          external: false,
        },
      ],
    },
    {
      title: t('sidebar.studyCenter'),
      icon: <BookOpenIcon className='size-4 shrink-0' />,
      authorizeOnly: ['admin', 'sales'],
      items: [
        {
          title: '管理仪表盘',
          icon: <CreditCardIcon className='size-4 shrink-0' />,
          href: Routes.AdminDashboard,
          external: false,
        },
        {
          title: '网站监控',
          icon: <SidebarIcon className='size-4 shrink-0' />,
          href: Routes.AdminAnalytics,
          external: false,
        },
        {
          title: '城市分析',
          icon: <CameraIcon className='size-4 shrink-0' />,
          href: Routes.AdminCity,
          external: false,
        },
        {
          title: '行业分析',
          icon: <HistoryIcon className='size-4 shrink-0' />,
          href: Routes.AdminIndustry,
          external: false,
        },
        {
          title: '进件管理',
          icon: <BookXIcon className='size-4 shrink-0' />,
          href: Routes.AdminOnboarding,
          external: false,
        },
        {
          title: '商户管理',
          icon: <DollarSign className='size-4 shrink-0' />,
          href: Routes.AdminOrganization,
          external: false,
        },
        {
          title: '企业监控',
          icon: <MessageCircleIcon className='size-4 shrink-0' />,
          href: Routes.AdminMonitor,
          external: false,
        },
        {
          title: '公司信息',
          icon: <UsersRoundIcon className='size-4 shrink-0' />,
          href: Routes.AdminCompany,
          external: false,
        },
        {
          title: '城市管理',
          icon: <MapPinIcon className='size-4 shrink-0' />,
          href: Routes.SettingsCity,
          external: false,
        },
        {
          title: '行业管理',
          icon: <Building2Icon className='size-4 shrink-0' />,
          href: Routes.SettingsIndustry,
          external: false,
        },
        {
          title: '标签管理',
          icon: <TagsIcon className='size-4 shrink-0' />,
          href: Routes.AdminTags,
          external: false,
        },
      ],
    },
    {
      title: t('admin.title'),
      icon: <SettingsIcon className='size-4 shrink-0' />,
      authorizeOnly: ['admin'],
      items: [

        {
          title: t('admin.rechargeOrders.title'),
          icon: <CreditCardIcon className='size-4 shrink-0' />,
          href: Routes.AdminRechargeOrders,
          external: false,
        },
        {
          title: t('admin.newsletterSubscriptions.title'),
          icon: <MailIcon className='size-4 shrink-0' />,
          href: Routes.AdminNewsletterSubscriptions,
          external: false,
        },
        {
          title: t('admin.payments.title'),
          icon: <DollarSignIcon className='size-4 shrink-0' />,
          href: Routes.AdminPayments,
          external: false,
        },
        {
          title: t('admin.users.title'),
          icon: <UsersRoundIcon className='size-4 shrink-0' />,
          href: Routes.AdminUsers,
          external: false,
        },
        {
          title: t('admin.sessions.title'),
          icon: <ActivityIcon className='size-4 shrink-0' />,
          href: Routes.AdminSessions,
          external: false,
        },
        {
          title: t('admin.chats.title'),
          icon: <MessageCircleIcon className='size-4 shrink-0' />,
          href: Routes.AdminChat,
          external: false,
        },
        {
          title: '任务管理',
          icon: <CloudRainWind className='size-4 shrink-0' />,
          href: Routes.AdminCrawlerTasks,
          external: false,
        }
      ],
    },
    {
      title: 'CMS',
      icon: <Settings2Icon className='size-4 shrink-0' />,
      authorizeOnly: ['sales', 'admin'],
      items: [
        {
          title: '博客',
          icon: <NewspaperIcon className='size-4 shrink-0' />,
          href: Routes.CMSBlog,
          external: false,
        },
        {
          title: '博客分类',
          icon: <FolderTreeIcon className='size-4 shrink-0' />,
          href: Routes.CMSBlogCategories,
          external: false,
        },
        {
          title: '博客作者',
          icon: <UserPenIcon className='size-4 shrink-0' />,
          href: Routes.CMSBlogAuthors,
          external: false,
        }
      ],
    },
    {
      title: t('settings.title'),
      icon: <Settings2Icon className='size-4 shrink-0' />,
      items: [
        {
          title: t('settings.profile.title'),
          icon: <CircleUserRoundIcon className='size-4 shrink-0' />,
          href: Routes.SettingsProfile,
          external: false,
        },
        {
          title: t('settings.billing.title'),
          icon: <CreditCardIcon className='size-4 shrink-0' />,
          href: Routes.SettingsBilling,
          external: false,
        },
        {
          title: t('settings.security.title'),
          icon: <LockKeyholeIcon className='size-4 shrink-0' />,
          href: Routes.SettingsSecurity,
          external: false,
        },
        {
          title: t('settings.notification.title'),
          icon: <BellIcon className='size-4 shrink-0' />,
          href: Routes.SettingsNotifications,
          external: false,
        },
        {
          title: '平台授权',
          icon: <Link2Icon className='size-4 shrink-0' />,
          href: '/settings/platforms',
          external: false,
        },
        {
          title: '邀请码',
          icon: <UserPlusIcon className='size-4 shrink-0' />,
          href: '/invite',
          external: false,
        }
      ],
    },
  ]
}


/**
 * Get sidebar config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://openroute.cn/docs/config/sidebar
 *
 * @param t - Translation function from useTranslations('Dashboard')
 * @returns The sidebar config with translated titles and descriptions
 */
export function getUserSidebarLinks(t: ReturnType<typeof useTranslations<'Dashboard'>>): NestedMenuItem[] {
  return [
    {
      title: t('dashboard.title'),
      icon: <LayoutDashboardIcon className='size-4 shrink-0' />,
      href: Routes.Dashboard,
      external: false,
    },
    {
      title: 'GEO智能分析',
      icon: <BookOpenIcon className='size-4 shrink-0' />,
      items: [
        {
          title: '监测报告',
          icon: <ChartBarIcon className='size-4 shrink-0' />,
          href: Routes.UserReports,
          external: false,
        },
        {
          title: '网站监控',
          icon: <SidebarIcon className='size-4 shrink-0' />,
          href: Routes.UserAnalytics,
          external: false,
        },
        {
          title: '竞争对手',
          icon: <Building2Icon className='size-4 shrink-0' />,
          href: Routes.UserCompetitors,
          external: false,
        },
        {
          title: '问法模板',
          icon: <FileTextIcon className='size-4 shrink-0' />,
          href: Routes.UserQuestions,
          external: false,
        },
        {
          title: '关键词库',
          icon: <TagsIcon className='size-4 shrink-0' />,
          href: Routes.UserKeywords,
          external: false,
        },
        {
          title: '信源引用',
          icon: <Quote className='size-4 shrink-0' />,
          href: Routes.UserCitations,
          external: false,
        },
        {
          title: '品牌管理',
          icon: <BuildingIcon className='size-4 shrink-0' />,
          href: Routes.UserBrands,
          external: false,
        },
        {
          title: '产品服务',
          icon: <Box className='size-4 shrink-0' />,
          href: Routes.UserProducts,
          external: false,
        },
      ],
    },
    {
      title: '内容',
      icon: <BookOpenIcon className='size-4 shrink-0' />,
      items: [
        {
          title: '素材库',
          icon: <ImageIcon className='size-4 shrink-0' />,
          href: Routes.UserMedias,
          external: false,
        },
        {
          title: '知识库',
          icon: <Brain className='size-4 shrink-0' />,
          href: Routes.UserKnowledge,
          external: false,
        },
        // {
        //   title: 'AI提示词',
        //   icon: <Lightbulb className='size-4 shrink-0' />,
        //   href: Routes.UserPrompts,
        //   external: false,
        // },
        // {
        //   title: '标签',
        //   icon: <TagsIcon className='size-4 shrink-0' />,
        //   href: Routes.UserTags,
        //   external: false,
        // },
      ],
    }
  ]
}

export function getSettingsSidebarLinks(t: ReturnType<typeof useTranslations<'Dashboard'>>): NestedMenuItem[] {
  return [
    {
      title: t('settings.title'),
      icon: <Settings2Icon className='size-4 shrink-0' />,
      items: [
        {
          title: t('settings.profile.title'),
          icon: <CircleUserRoundIcon className='size-4 shrink-0' />,
          href: Routes.SettingsProfile,
          external: false,
        },
        {
          title: t('settings.billing.title'),
          icon: <CreditCardIcon className='size-4 shrink-0' />,
          href: Routes.SettingsBilling,
          external: false,
        },
        {
          title: t('settings.security.title'),
          icon: <LockKeyholeIcon className='size-4 shrink-0' />,
          href: Routes.SettingsSecurity,
          external: false,
        },
        {
          title: t('settings.notification.title'),
          icon: <BellIcon className='size-4 shrink-0' />,
          href: Routes.SettingsNotifications,
          external: false,
        },
        {
          title: '平台授权',
          icon: <Link2Icon className='size-4 shrink-0' />,
          href: '/settings/platforms',
          external: false,
        },
        {
          title: '邀请码',
          icon: <UserPlusIcon className='size-4 shrink-0' />,
          href: '/settings/invite',
          external: false,
        }
      ],
    },
  ]
}

export function getAdminSidebarLinks(t: ReturnType<typeof useTranslations<'Dashboard'>>): NestedMenuItem[] {
  return [
    {
      title: t('dashboard.title'),
      icon: <LayoutDashboardIcon className='size-4 shrink-0' />,
      href: Routes.AdminDashboard,
      external: false,
    },
    {
      title: '监测中心',
      icon: <ClipboardListIcon className='size-4 shrink-0' />,
      external: false,
      items: [
        {
          title: '监测任务',
          icon: <ClipboardListIcon className='size-4 shrink-0' />,
          href: Routes.AdminMonitorCenterTask,
          external: false,
        },
        {
          title: '平台账号',
          icon: <UserCogIcon className='size-4 shrink-0' />,
          href: Routes.AdminMonitorCenterPlatformAccount,
          external: false,
        },
        {
          title: '通知配置',
          icon: <BellRingIcon className='size-4 shrink-0' />,
          href: Routes.AdminMonitorCenterNotificationConfig,
          external: false,
        },
        {
          title: '信源管理',
          icon: <GlobeIcon className='size-4 shrink-0' />,
          href: Routes.AdminMonitorCenterSourceSite,
          external: false,
        },
        {
          title: '报告汇总',
          icon: <BarChart2Icon className='size-4 shrink-0' />,
          href: Routes.AdminMonitorCenterReport,
          external: false,
        },
      ],
    },
    {
      title: '管理中心',
      icon: <BookOpenIcon className='size-4 shrink-0' />,
      authorizeOnly: ['admin', 'sales'],
      items: [

        {
          title: '进件管理',
          icon: <BookXIcon className='size-4 shrink-0' />,
          href: Routes.AdminOnboarding,
          external: false,
        },
        {
          title: '商户管理',
          icon: <DollarSign className='size-4 shrink-0' />,
          href: Routes.AdminOrganization,
          external: false,
        },
        {
          title: '发布记录',
          icon: <Send className='size-4 shrink-0' />,
          href: Routes.AdminRecords,
          external: false,
        },
        // {
        //   title: '企业监控',
        //   icon: <MessageCircleIcon className='size-4 shrink-0' />,
        //   href: Routes.AdminMonitor,
        //   external: false,
        // },

        {
          title: '公司信息',
          icon: <UsersRoundIcon className='size-4 shrink-0' />,
          href: Routes.AdminCompany,
          external: false,
        },
        {
          title: '城市管理',
          icon: <MapPinIcon className='size-4 shrink-0' />,
          href: Routes.AdminCity,
          external: false,
        },

        {
          title: '行业管理',
          icon: <Building2Icon className='size-4 shrink-0' />,
          href: Routes.AdminIndustry,
          external: false,
        },
        {
          title: '行业词云',
          icon: <Brain className='size-4 shrink-0' />,
          href: Routes.AdminIndustryWordCloud,
          external: false,
        },
        {
          title: '标签管理',
          icon: <TagsIcon className='size-4 shrink-0' />,
          href: Routes.AdminTags,
          external: false,
        },
        {
          title: '网站托管',
          icon: <GlobeIcon className='size-4 shrink-0' />,
          href: Routes.AdminWebsites,
          external: false,
        },

        {
          title: '行业分析',
          icon: <ChartBarIcon className='size-4 shrink-0' />,
          href: Routes.AdminIndustryData,
          external: false,
        },
        {
          title: '城市分析',
          icon: <ChartBarIcon className='size-4 shrink-0' />,
          href: Routes.AdminCityData,
          external: false,
        },
      ],
    },
    {
      title: 'CMS',
      icon: <Settings2Icon className='size-4 shrink-0' />,
      authorizeOnly: ['sales', 'admin'],
      items: [
        {
          title: '博客',
          icon: <NewspaperIcon className='size-4 shrink-0' />,
          href: Routes.CMSBlog,
          external: false,
        },
        {
          title: '博客分类',
          icon: <FolderTreeIcon className='size-4 shrink-0' />,
          href: Routes.CMSBlogCategories,
          external: false,
        },
        {
          title: '博客作者',
          icon: <UserPenIcon className='size-4 shrink-0' />,
          href: Routes.CMSBlogAuthors,
          external: false,
        }
      ],
    },
    {
      title: t('admin.title'),
      icon: <SettingsIcon className='size-4 shrink-0' />,
      authorizeOnly: ['admin'],
      items: [

        {
          title: t('admin.rechargeOrders.title'),
          icon: <CreditCardIcon className='size-4 shrink-0' />,
          href: Routes.AdminRechargeOrders,
          external: false,
        },
        {
          title: t('admin.newsletterSubscriptions.title'),
          icon: <MailIcon className='size-4 shrink-0' />,
          href: Routes.AdminNewsletterSubscriptions,
          external: false,
        },
        {
          title: t('admin.payments.title'),
          icon: <DollarSignIcon className='size-4 shrink-0' />,
          href: Routes.AdminPayments,
          external: false,
        },
        {
          title: t('admin.users.title'),
          icon: <UsersRoundIcon className='size-4 shrink-0' />,
          href: Routes.AdminUsers,
          external: false,
        },
        {
          title: t('admin.sessions.title'),
          icon: <ActivityIcon className='size-4 shrink-0' />,
          href: Routes.AdminSessions,
          external: false,
        },
        {
          title: t('admin.chats.title'),
          icon: <MessageCircleIcon className='size-4 shrink-0' />,
          href: Routes.AdminChat,
          external: false,
        },
        {
          title: '任务管理',
          icon: <CloudRainWind className='size-4 shrink-0' />,
          href: Routes.AdminCrawlerTasks,
          external: false,
        }
      ],
    }
  ]
}