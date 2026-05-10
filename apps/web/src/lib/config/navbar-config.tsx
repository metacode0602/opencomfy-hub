'use client'

import { Routes } from '@/lib/routes'
import type { NestedMenuItem } from '@/lib/types/index'
import {
  BookXIcon,
  MessageCircleIcon,
  SparklesIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Get navbar config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://openroute.cn/docs/config/navbar
 *
 * @returns The navbar config with translated titles and descriptions
 */
export function getNavbarLinks(): NestedMenuItem[] {
  const t = useTranslations('Marketing.navbar')

  return [
    {
      title: "公司咨询",
      icon: <MessageCircleIcon className="size-4 shrink-0" />,
      href: Routes.Company,
      external: false,
    },
    {
      title: "观点洞察",
      icon: <SparklesIcon className="size-4 shrink-0" />,
      href: Routes.Insights,
      external: false,
    },
    // {
    //   title: t('blog.title'),
    //   icon: <FileTextIcon className='size-4 shrink-0' />,
    //   href: Routes.Blog,
    //   external: false,
    // }
  ]
}
