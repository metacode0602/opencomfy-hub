'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select'
import { websiteConfig } from '@/lib/config/website'
import { useLocalePathname, useLocaleRouter } from '@/lib/i18n/navigation'
import { DEFAULT_LOCALE } from '@/lib/i18n/routing'
import { useLocaleStore } from '@/lib/stores/locale-store'
import { type Locale, useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { useEffect, useTransition } from 'react'

type AppLocale = keyof typeof websiteConfig.i18n.locales

/**
 * 1. LocaleSelector
 *
 * By combining useLocaleRouter with useLocalePathname, you can change the locale for the current page
 * programmatically by navigating to the same pathname, while overriding the locale.
 * Depending on if you're using the pathnames setting, you optionally have to forward params
 * to potentially resolve an internal pathname.
 *
 * https://next-intl.dev/docs/routing/navigation#userouter
 */
export default function LocaleSelector() {
  const router = useLocaleRouter()
  const pathname = useLocalePathname()
  const params = useParams()
  const locale = useLocale()
  const { currentLocale, setCurrentLocale } = useLocaleStore()
  const [, startTransition] = useTransition()

  useEffect(() => {
    setCurrentLocale(locale)
  }, [locale, setCurrentLocale])

  const locales = websiteConfig.i18n.locales
  const showLocaleSwitch = Object.keys(locales).length > 1
  if (!showLocaleSwitch) {
    return null
  }

  const defaultLocaleMeta = locales[DEFAULT_LOCALE as AppLocale]

  const onSelectChange = (nextLocale: Locale) => {
    setCurrentLocale(nextLocale)

    startTransition(() => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname, params },
        { locale: nextLocale }
      )
    })
  }

  return (
    <Select defaultValue={locale} value={currentLocale} onValueChange={onSelectChange}>
      <SelectTrigger className='w-fit cursor-pointer'>
        <SelectValue
          placeholder={
            <div className='flex items-center gap-2'>
              {defaultLocaleMeta.flag && <span className='text-lg'>{defaultLocaleMeta.flag}</span>}
              <span>{defaultLocaleMeta.name}</span>
            </div>
          }
        >
          {currentLocale && (
            <div className='flex items-center gap-2'>
              {locales[currentLocale as AppLocale].flag && (
                <span className='text-lg'>{locales[currentLocale as AppLocale].flag}</span>
              )}
              <span>{locales[currentLocale as AppLocale].name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(locales).map(([cur, data]) => (
          <SelectItem key={cur} value={cur} className='flex cursor-pointer items-center gap-2'>
            <div className='flex items-center gap-2'>
              {data.flag && <span className='text-md'>{data.flag}</span>}
              <span>{data.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
