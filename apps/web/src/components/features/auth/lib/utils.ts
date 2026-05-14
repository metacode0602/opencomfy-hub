'use server'

import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function requireAuth(
  redirectHref: string = '/signup'
): Promise<undefined> {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (session == null) return redirect(redirectHref)
}

export async function requireUnauth(
  redirectHref: string = '/dashboard'
): Promise<undefined> {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (session != null) return redirect(redirectHref)
}
