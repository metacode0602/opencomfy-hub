'use client'

import Container from '@/components/layout/container'
import { Logo } from '@/components/layout/logo'
import { getFooterLinks } from '@/lib/config/footer-config'
import { getSocialLinks } from '@/lib/config/social-config'
import { LocaleLink } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'
import type React from 'react'

export function Footer({ className }: React.HTMLAttributes<HTMLElement>) {
  const t = useTranslations()
  const footerLinks = getFooterLinks()
  const socialLinks = getSocialLinks()

  return (
    <footer className={cn('border-t', className)}>
      <Container className='px-4'>
        <div className='grid grid-cols-2 gap-8 py-8 md:py-16 md:grid-cols-6'>
          <div className='col-span-full flex flex-col items-start md:col-span-2'>
            <div className='space-y-4'>
              {/* logo and name */}
              <div className='flex items-center space-x-2'>
                <Logo full={true} />
                {/* <span className='font-semibold text-sm lg:text-xl whitespace-nowrap'>{t('Metadata.name')}</span> */}
              </div>

              {/* tagline */}
              <p className='py-2 text-base text-muted-foreground md:pr-12'>{t('Marketing.footer.tagline')}</p>

              {/* social links */}
              <div className='flex items-center gap-4 py-2'>
                <div className='flex items-center gap-2'>
                  {socialLinks?.map((link) => (
                    <a
                      key={link.title}
                      href={link.href || '#'}
                      target='_blank'
                      rel='noreferrer'
                      aria-label={link.title}
                      className='inline-flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-accent hover:text-accent-foreground'
                    >
                      <span className='sr-only'>{link.title}</span>
                      {link.icon ? link.icon : null}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* footer links */}
          {footerLinks?.map((section) => (
            <div key={section.title} className='col-span-1 items-start md:col-span-1'>
              <span className='font-semibold text-sm uppercase'>{section.title}</span>
              <ul className='mt-4 list-inside space-y-3'>
                {section.items?.map(
                  (item) =>
                    item.href && (
                      <li key={item.title}>
                        <LocaleLink
                          href={item.href || '#'}
                          target={item.external ? '_blank' : undefined}
                          className='text-muted-foreground text-sm hover:text-primary'
                        >
                          {item.title}
                        </LocaleLink>
                      </li>
                    )
                )}
              </ul>
            </div>
          ))}
        </div>
      </Container>

      <div className='border-t py-6 sm:py-8'>
        <Container className='px-4'>
          <div className='flex flex-col items-center justify-center gap-y-3 text-center sm:gap-y-4'>
            <span className='px-2 text-muted-foreground text-xs sm:text-sm'>
              Copyright ©2025-2027 字节聚力（北京）科技有限公司版权所有
            </span>

            <div className='flex flex-col items-center justify-center gap-y-2 text-muted-foreground text-sm sm:flex-row sm:gap-x-4 sm:gap-y-0'>
              <span className='transition-colors hover:text-primary'>
                <Link href='https://beian.miit.gov.cn/' target='_blank' rel='noopener noreferrer'>
                  京ICP备2026001997号-1
                </Link>
              </span>
              <span className='hidden text-muted-foreground/50 sm:inline'>|</span>
              <div className='flex items-center gap-x-2'>
                <Image src='/images/gongan.jpg' alt='beian' width={16} height={16} className='flex-shrink-0' />
                <span className='transition-colors hover:text-primary'>
                  <Link
                    href='http://www.beian.gov.cn/portal/registerSystemInfo'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    京公网安备11010502059490号
                  </Link>
                </span>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  )
}
