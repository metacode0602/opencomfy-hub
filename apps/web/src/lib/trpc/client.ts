import type { AppRouter } from '@/server/routers'
import { createTRPCClient } from '@trpc/client'
import { createTRPCReact } from '@trpc/react-query'
import { trpcLinks } from './links'

// TRPC Client Api for Client Components with "use client"
export const clientApi = createTRPCClient<AppRouter>({
  links: trpcLinks,
})

export const trpc = createTRPCReact<AppRouter>()
