'use client'

import LocaleSelector from '@/components/layout/locale-selector'
import { Logo } from '@/components/layout/logo'
import { ModeSwitcherHorizontal } from '@/components/layout/mode-switcher-horizontal'
import { Button, buttonVariants } from '@workspace/ui/components/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@workspace/ui/components/collapsible'
import { getNavbarLinks } from '@/lib/config/navbar-config'
import { LocaleLink, useLocalePathname } from '@/lib/i18n/navigation'
import { authClient } from '@/lib/auth-client'
import { cn } from '@workspace/ui/lib/utils'
import { Routes } from '@/lib/routes'
import { ArrowUpRightIcon, ChevronDownIcon, ChevronRightIcon, MenuIcon, XIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { RemoveScroll } from 'react-remove-scroll'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { UserButtonMobile } from './user-button-mobile'

const LG_MEDIA_QUERY = '(min-width: 1024px)'

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mediaQueryList = window.matchMedia(query)
      mediaQueryList.addEventListener('change', onStoreChange)
      return () => mediaQueryList.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function NavbarMobile({ className, ...other }: React.HTMLAttributes<HTMLDivElement>) {
  const isClient = useIsClient()
  const isLargeScreen = useMediaQuery(LG_MEDIA_QUERY)
  const [openPath, setOpenPath] = useState<string | null>(null)
  const localePathname = useLocalePathname()
  const menuOpen = openPath === localePathname && !isLargeScreen
  const { data: session, isPending } = authClient.useSession()
  const currentUser = session?.user

  useEffect(() => {
    if (document.activeElement instanceof HTMLInputElement) {
      document.activeElement.blur()
    }
  }, [localePathname])

  useEffect(() => {
    const mediaQueryList = window.matchMedia(LG_MEDIA_QUERY)
    const closeOnDesktop = () => {
      if (mediaQueryList.matches) {
        setOpenPath(null)
      }
    }
    mediaQueryList.addEventListener('change', closeOnDesktop)
    return () => mediaQueryList.removeEventListener('change', closeOnDesktop)
  }, [])

  const handleToggleMobileMenu = (): void => {
    setOpenPath((current) =>
      current === localePathname ? null : localePathname,
    )
  }

  if (!isClient) {
    return null
  }

  return (
    <>
      <div className={cn('flex items-center justify-between', className)} {...other}>
        {/* navbar left shows logo */}
        <LocaleLink href={Routes.Root} className='flex items-center gap-2'>
          <Logo />
          {/* <span className='font-semibold'>{t('Metadata.name')}</span> */}
        </LocaleLink>

        {/* navbar right shows menu icon and user button */}
        <div className='flex items-center justify-end gap-4'>
          {/* show user button if user is logged in */}
          {isPending ? (
            <Skeleton className='size-8 rounded-full border' />
          ) : currentUser ? (
            <UserButtonMobile user={currentUser} />
          ) : null}

          <Button
            variant='ghost'
            size='icon'
            aria-expanded={menuOpen}
            aria-label='Toggle Mobile Menu'
            onClick={handleToggleMobileMenu}
            className='flex aspect-square size-8 h-fit cursor-pointer select-none items-center justify-center rounded-md border'
          >
            {menuOpen ? <XIcon className='size-4' /> : <MenuIcon className='size-4' />}
          </Button>
        </div>
      </div>

      {/* mobile menu */}
      {menuOpen && (
        <div>
          {/* if we don't add RemoveScroll component, the underlying 
            page will scroll when we scroll the mobile menu */}
          <RemoveScroll allowPinchZoom enabled>
            {/* Only render MainMobileMenu when not in loading state */}
            {!isPending && <MainMobileMenu userLoggedIn={!!currentUser} onLinkClicked={handleToggleMobileMenu} />}
          </RemoveScroll>
        </div>
      )}
    </>
  )
}

interface MainMobileMenuProps {
  userLoggedIn: boolean
  onLinkClicked: () => void
}

function MainMobileMenu({ userLoggedIn, onLinkClicked }: MainMobileMenuProps) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})
  const t = useTranslations()
  const menuLinks = getNavbarLinks()
  const localePathname = useLocalePathname()

  return (
    <div
      className='fade-in-0 fixed inset-0 z-50 mt-[64px] w-full animate-in overflow-y-auto bg-background backdrop-blur-md'
    >
      <div className='flex size-full flex-col items-start space-y-4'>
        {/* action buttons */}
        {userLoggedIn ? null : (
          <div className='flex w-full flex-col gap-4 px-4'>
            <LocaleLink
              href={Routes.Login}
              onClick={onLinkClicked}
              className={cn(
                buttonVariants({
                  size: 'lg',
                }),
                'w-full'
              )}
            >
              {t('Common.login')}
            </LocaleLink>
            {/* <LocaleLink
              href={Routes.Register}
              className={cn(
                buttonVariants({
                  variant: 'default',
                  size: 'lg',
                }),
                'w-full'
              )}
              onClick={onLinkClicked}
            >
              {t('Common.signUp')}
            </LocaleLink> */}
          </div>
        )}

        {/* main menu */}
        <ul className='w-full px-4'>
          {menuLinks?.map((item) => {
            const isActive = item.href
              ? localePathname.startsWith(item.href)
              : item.items?.some((subItem) => subItem.href && localePathname.startsWith(subItem.href))

            return (
              <li key={item.title} className='py-1'>
                {item.items ? (
                  <Collapsible
                    open={expanded[item.title.toLowerCase()]}
                    onOpenChange={(isOpen) =>
                      setExpanded((prev) => ({
                        ...prev,
                        [item.title.toLowerCase()]: isOpen,
                      }))
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        type='button'
                        variant='ghost'
                        className={cn(
                          '!pl-2 flex w-full items-center justify-between text-left',
                          'cursor-pointer bg-transparent text-muted-foreground',
                          'hover:bg-transparent hover:text-foreground',
                          'focus:bg-transparent focus:text-foreground',
                          isActive && 'bg-transparent font-semibold text-foreground'
                        )}
                      >
                        <span className='text-base'>{item.title}</span>
                        {expanded[item.title.toLowerCase()] ? (
                          <ChevronDownIcon className='size-4' />
                        ) : (
                          <ChevronRightIcon className='size-4' />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className='pl-2'>
                      <ul className='mt-2 space-y-2 pl-0'>
                        {item.items.map((subItem) => {
                          const isSubItemActive = subItem.href && localePathname.startsWith(subItem.href)

                          return (
                            <li key={subItem.title}>
                              <LocaleLink
                                href={subItem.href || '#'}
                                target={subItem.external ? '_blank' : undefined}
                                rel={subItem.external ? 'noopener noreferrer' : undefined}
                                className={cn(
                                  buttonVariants({ variant: 'ghost' }),
                                  'group !pl-0 !pr-3 h-auto w-full justify-start gap-4 p-1',
                                  'cursor-pointer bg-transparent text-muted-foreground',
                                  'hover:bg-transparent hover:text-foreground',
                                  'focus:bg-transparent focus:text-foreground',
                                  isSubItemActive && 'bg-transparent font-semibold text-foreground'
                                )}
                                onClick={onLinkClicked}
                              >
                                <div
                                  className={cn(
                                    'ml-0 flex size-8 shrink-0 items-center justify-center transition-colors',
                                    'bg-transparent text-muted-foreground',
                                    'group-hover:bg-transparent group-hover:text-foreground',
                                    'group-focus:bg-transparent group-focus:text-foreground',
                                    isSubItemActive && 'bg-transparent text-foreground'
                                  )}
                                >
                                  {subItem.icon ? subItem.icon : null}
                                </div>
                                <div className='flex-1'>
                                  <span
                                    className={cn(
                                      'text-muted-foreground text-sm',
                                      'group-hover:bg-transparent group-hover:text-foreground',
                                      'group-focus:bg-transparent group-focus:text-foreground',
                                      isSubItemActive && 'bg-transparent font-semibold text-foreground'
                                    )}
                                  >
                                    {subItem.title}
                                  </span>
                                  {/* hide description for now */}
                                  {/* {subItem.description && (
                                      <p
                                        className={cn(
                                          'text-xs text-muted-foreground',
                                          'group-hover:bg-transparent group-hover:text-foreground/80',
                                          'group-focus:bg-transparent group-focus:text-foreground/80',
                                          isSubItemActive &&
                                          'bg-transparent text-foreground/80'
                                        )}
                                      >
                                        {subItem.description}
                                      </p>
                                    )} */}
                                </div>
                                {subItem.external && (
                                  <ArrowUpRightIcon
                                    className={cn(
                                      'size-4 shrink-0 items-center text-muted-foreground',
                                      'group-hover:bg-transparent group-hover:text-foreground',
                                      'group-focus:bg-transparent group-focus:text-foreground',
                                      isSubItemActive && 'bg-transparent text-foreground'
                                    )}
                                  />
                                )}
                              </LocaleLink>
                            </li>
                          )
                        })}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <LocaleLink
                    href={item.href || '#'}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                    className={cn(
                      buttonVariants({ variant: 'ghost' }),
                      '!pl-2 group w-full cursor-pointer justify-start',
                      'bg-transparent text-muted-foreground',
                      'hover:bg-transparent hover:text-foreground',
                      'focus:bg-transparent focus:text-foreground',
                      isActive && 'bg-transparent font-semibold text-foreground'
                    )}
                    onClick={onLinkClicked}
                  >
                    <div className='flex w-full items-center pl-0'>
                      <span className='text-base'>{item.title}</span>
                    </div>
                  </LocaleLink>
                )}
              </li>
            )
          })}
        </ul>

        {/* bottom buttons */}
        <div className='flex w-full items-center justify-between gap-4 border-border/50 border-t p-4'>
          <LocaleSelector />
          <ModeSwitcherHorizontal />
        </div>
      </div>
    </div>
  )
}
