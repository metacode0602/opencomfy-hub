import { getSessionCookie } from "better-auth/cookies"
import createIntlMiddleware from "next-intl/middleware"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { DEFAULT_LOCALE, LOCALES, routing } from "@/lib/i18n/routing"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-request-id, X-Request-Id",
}

const handleI18nRouting = createIntlMiddleware(routing)

/**
 * Strip an optional `[locale]` prefix so auth checks use stable paths
 * (e.g. `/en/sign-in` → `/sign-in`, `/sign-in` stays `/sign-in` for default locale).
 */
function pathnameWithoutLocale(pathname: string): {
  locale: string
  pathnameWithoutLocale: string
} {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  if (first && LOCALES.includes(first)) {
    const rest = segments.slice(1).join("/")
    return {
      locale: first,
      pathnameWithoutLocale: rest ? `/${rest}` : "/",
    }
  }
  return {
    locale: DEFAULT_LOCALE,
    pathnameWithoutLocale: pathname || "/",
  }
}

function buildLocalizedHref(locale: string, href: string): string {
  if (locale === DEFAULT_LOCALE) {
    return href
  }
  return `/${locale}${href === "/" ? "" : href}`
}

function isNavigationRedirect(response: NextResponse): boolean {
  return response.status >= 300 && response.status < 400
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/api/v1/generate")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: corsHeaders })
    }
    const res = NextResponse.next()
    for (const [k, v] of Object.entries(corsHeaders)) {
      res.headers.set(k, v)
    }
    return res
  }

  // Locale negotiation, prefix handling, and alternate links — see:
  // https://next-intl.dev/docs/routing/middleware
  const intlResponse = handleI18nRouting(request)

  if (isNavigationRedirect(intlResponse)) {
    return intlResponse
  }

  const sessionCookie = getSessionCookie(request)
  const { locale, pathnameWithoutLocale: pathForAuth } = pathnameWithoutLocale(pathname)

  const isPublicRoute =
    pathForAuth === "/" ||
    pathForAuth.startsWith("/login") ||
    pathForAuth.startsWith("/signin") ||
    pathForAuth.startsWith("/register") ||
    pathForAuth.startsWith("/forgot-password") ||
    pathForAuth.startsWith("/reset-password") ||
    pathForAuth.startsWith("/error")

  if (!sessionCookie && !isPublicRoute) {
    const signInHref = buildLocalizedHref(locale, "/login")
    return NextResponse.redirect(new URL(signInHref, request.url))
  }

  return intlResponse
}

export const config = {
  matcher: [
    // Match all pathnames except api, Next internals, Vercel, and static files with extensions
    // https://next-intl.dev/docs/routing/middleware#matcher-config
    "/((?!api|_next|_vercel|.*\\..*).*)",
    "/api/v1/generate/:path*",
  ],
}
