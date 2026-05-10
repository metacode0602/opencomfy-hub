'use client'

import { BlueskyIcon } from '@workspace/ui/components/icons/bluesky'
import { DiscordIcon } from '@workspace/ui/components/icons/discord'
import { FacebookIcon } from '@workspace/ui/components/icons/facebook'
import { GitHubIcon } from '@workspace/ui/components/icons/github'
import { InstagramIcon } from '@workspace/ui/components/icons/instagram'
import { LinkedInIcon } from '@workspace/ui/components/icons/linkedin'
import { MastodonIcon } from '@workspace/ui/components/icons/mastodon'
import { TelegramIcon } from '@workspace/ui/components/icons/telegram'
import { TikTokIcon } from '@workspace/ui/components/icons/tiktok'
import { YouTubeIcon } from '@workspace/ui/components/icons/youtube'
import XIcon from '@workspace/ui/components/icons/x'
import type { MenuItem } from '@/lib/types/index'
import { websiteConfig } from './website'

/**
 * Get social config
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://openroute.cn/docs/config/social
 *
 * @returns The social config
 */
export function getSocialLinks(): MenuItem[] {
  const socialLinks: MenuItem[] = []

  if (websiteConfig.metadata.social?.github) {
    socialLinks.push({
      title: 'GitHub',
      href: websiteConfig.metadata.social.github,
      icon: <GitHubIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.twitter) {
    socialLinks.push({
      title: 'Twitter',
      href: websiteConfig.metadata.social.twitter,
      icon: <XIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.blueSky) {
    socialLinks.push({
      title: 'Bluesky',
      href: websiteConfig.metadata.social.blueSky,
      icon: <BlueskyIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.mastodon) {
    socialLinks.push({
      title: 'Mastodon',
      href: websiteConfig.metadata.social.mastodon,
      icon: <MastodonIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.discord) {
    socialLinks.push({
      title: 'Discord',
      href: websiteConfig.metadata.social.discord,
      icon: <DiscordIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.youtube) {
    socialLinks.push({
      title: 'YouTube',
      href: websiteConfig.metadata.social.youtube,
      icon: <YouTubeIcon   className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.linkedin) {
    socialLinks.push({
      title: 'LinkedIn',
      href: websiteConfig.metadata.social.linkedin,
      icon: <LinkedInIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.facebook) {
    socialLinks.push({
      title: 'Facebook',
      href: websiteConfig.metadata.social.facebook,
      icon: <FacebookIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.instagram) {
    socialLinks.push({
      title: 'Instagram',
      href: websiteConfig.metadata.social.instagram,
      icon: <InstagramIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.tiktok) {
    socialLinks.push({
      title: 'TikTok',
      href: websiteConfig.metadata.social.tiktok,
      icon: <TikTokIcon className='size-4 shrink-0' />,
    })
  }

  if (websiteConfig.metadata.social?.telegram) {
    socialLinks.push({
      title: 'Telegram',
      href: websiteConfig.metadata.social.telegram,
      icon: <TelegramIcon className='size-4 shrink-0' />,
    })
  }

  return socialLinks
}
