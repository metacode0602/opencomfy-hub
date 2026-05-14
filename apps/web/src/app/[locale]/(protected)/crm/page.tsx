import { localeRedirect } from "@/lib/i18n/navigation"
import { type Locale } from "next-intl"

export default async function CrmIndexPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  localeRedirect({ href: "/crm/tenants", locale })
}
