import { localeRedirect } from '@/lib/i18n/navigation'

export default async function CrmBillingSyncRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  localeRedirect({ href: '/settings?section=billing-sync', locale })
}
