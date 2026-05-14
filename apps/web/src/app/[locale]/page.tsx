import { auth } from "@/lib/auth"
import { localeRedirect } from "@/lib/i18n/navigation"
import { isExpired } from "@workspace/ui/lib/utils"
import { type Locale } from "next-intl"
import { headers } from "next/headers"

export default async function LocaleRootPage({
  params,
}: {
  params: Promise<{ locale: Locale }>
}) {
  const { locale } = await params
  const response = await auth.api.getSession({
    headers: await headers(),
  })

  const loggedIn =
    response != null && !isExpired(response.session.expiresAt)

  if (loggedIn) {
    localeRedirect({ href: "/dashboard", locale })
  }

  localeRedirect({ href: "/signin", locale })
}
