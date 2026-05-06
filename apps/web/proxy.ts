import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, x-request-id, X-Request-Id",
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

  const sessionCookie = getSessionCookie(request)

  const isAuthRoute =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up") || pathname.startsWith("/create")

  if (!sessionCookie && !isAuthRoute) {
    return NextResponse.redirect(new URL("/sign-in", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/api/v1/generate/:path*",
  ],
}
