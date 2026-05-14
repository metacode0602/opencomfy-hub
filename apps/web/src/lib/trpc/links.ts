'use client'
import { httpBatchLink, loggerLink } from '@trpc/client'
import superjson from 'superjson'
import { authClient } from '@/lib/auth-client'
import { Routes } from '@/lib/routes'

/**
 * TRPC Nextjs Client - It will be used with react query
 */
export const trpcLinks = [
  loggerLink({
    enabled: (opts) =>
      process.env.NODE_ENV === 'development' || (opts.direction === 'down' && opts.result instanceof Error),
  }),
  httpBatchLink({
    // TODO: Change this to be a full URL exposed as a client side setting
    url: `/api/trpc`,
    maxURLLength: 14000,
    transformer: superjson,
    headers: async () => {
      const session = await authClient.getSession()
      if (session instanceof Error || !session) {
        return {}
      }
      return {
        Authorization: `Bearer ${session.data?.session.token}`,
        'x-trpc-source': 'client',
      }
    },
    // 添加错误处理
    fetch: async (url, options) => {
      const response = await fetch(url, options)
      if (response.status === 401) {
        window.location.href = Routes.Login
      }
      return response
    },
  }),
]
