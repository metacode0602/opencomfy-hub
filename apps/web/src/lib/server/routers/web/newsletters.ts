import { sendEmail } from '@/lib/mail'
import { LOCALES, routing } from '@/lib/i18n/routing'
import { createTRPCRouter, publicProcedure } from '../trpc'
import type { Locale } from 'next-intl'
import { z } from 'zod'

function resolveLocale(value: string | undefined): Locale {
  if (value && LOCALES.includes(value)) {
    return value as Locale
  }
  return routing.defaultLocale as Locale
}

const subscribeNewsletterInput = z.object({
  email: z.string().email(),
  locale: z.string().optional(),
})

export const newslettersRouter = createTRPCRouter({
  subscribeNewsletterAction: publicProcedure
    .input(subscribeNewsletterInput)
    .mutation(async ({ input }) => {
      const locale = resolveLocale(input.locale)
      try {
        const sent = await sendEmail({
          to: input.email,
          template: 'subscribeNewsletter',
          context: {},
          locale,
        })
        if (!sent) {
          return { success: false as const }
        }
        return { success: true as const }
      } catch (e) {
        console.error('[newsletters] subscribeNewsletterAction', e)
        return { success: false as const }
      }
    }),
})
