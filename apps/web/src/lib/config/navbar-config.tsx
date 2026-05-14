'use client'

import type { NestedMenuItem } from '@/lib/types/index'
import {
  BrainIcon,
  DollarSignIcon,
  SparklesIcon,
  Package2,
  BookOpenIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Get navbar config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://gongjiyun.com/docs/config/navbar
 *
 * @returns The navbar config with translated titles and descriptions
 */
export function getNavbarLinks(): NestedMenuItem[] {
  const t = useTranslations('Marketing.navbar')

  return [
    {
      title: "功能",
      icon: <Package2 className="size-4 shrink-0" />,
      href: "/#features",
      external: false,
    },
    {
      title: "模型",
      icon: <BrainIcon className="size-4 shrink-0" />,
      href: "/#models",
      external: false,
    },
    {
      title: "案例",
      icon: <BookOpenIcon className='size-4 shrink-0' />,
      href: "/#showcase",
      external: false,
    },
    {
      title: "定价",
      icon: <DollarSignIcon className='size-4 shrink-0' />,
      href: "/#pricing",
      external: false,
    },  
  ]
}
