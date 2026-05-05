import type { AppRouter } from '@/lib/server/routers'
import { createTRPCClient } from '@trpc/client'
import { createTRPCReact, type CreateTRPCReact } from '@trpc/react-query'
import { trpcLinks } from './links'

// TRPC Client Api for Client Components with "use client"
export const clientApi = createTRPCClient<AppRouter>({
  links: trpcLinks,
})

export const trpc: CreateTRPCReact<AppRouter, unknown> = createTRPCReact<AppRouter>()
