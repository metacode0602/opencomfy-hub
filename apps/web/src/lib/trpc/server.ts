import { createTRPCContext, type AppRouter, createCallerFactory } from '@/server/routers'
import type { UserWithRole } from '@/server/routers/trpc'
import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client'
import superjson from 'superjson'
import { authClient } from '../auth-client'
import { auth } from '../auth'
import { getBaseUrl } from '../urls/urls'
import { headers } from 'next/headers'
import { appRouter } from '@/server/routers'

// TRPC Server Api
export const serverApi = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' || (opts.direction === 'down' && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      maxURLLength: 14000,
      transformer: superjson,
      headers: async () => {
        const session = await authClient.getSession()
        if (session instanceof Error || !session) {
          return {}
        }
        return {
          Authorization: `Bearer ${session.data?.session.token}`,
          'x-trpc-source': 'server',
        }
      },
    }),
  ],
})

/**
 * Create a server-side caller for use in server components
 * This uses Next.js headers() to get the session properly
 */
export const createServerCaller = async () => {
  const headersList = await headers()
  const authSession = await auth.api.getSession({
    headers: headersList,
  })

  const user = authSession?.user
    ? ({
      ...authSession.user,
      role: (authSession.user.role === 'admin' || authSession.user.role === 'user'
        ? authSession.user.role
        : undefined) as 'admin' | 'user' | undefined,
    } as UserWithRole)
    : null

  const ctx = await createTRPCContext({
    headers: headersList,
    user,
    session: authSession?.session ?? null,
  })

  const callerFactory = createCallerFactory(appRouter)
  return callerFactory(ctx)
}

/**
 * 从请求中创建tRPC上下文
 * @param req
 * @returns
 */
export const createContextFromRequest = async (req: Request) => {
  const headers = new Headers(req.headers)
  const authSession = await getUserFromRequest(req)
  // console.log("[route.ts] [createContextFromRequest] user", authSession);
  const user = authSession?.user
    ? ({
      ...authSession.user,
      role: (authSession.user.role === 'admin' || authSession.user.role === 'user'
        ? authSession.user.role
        : undefined) as 'admin' | 'user' | undefined,
    } as UserWithRole)
    : null
  return createTRPCContext({ headers, req, user, session: authSession?.session })
}

/**
 * 从请求中获取用户
 * @param req
 * @returns
 */
const getUserFromRequest = async (req: Request) => {
  const authSession = await auth.api.getSession({
    headers: req.headers,
  })

  const source = req.headers.get('x-trpc-source') ?? 'unknown'
  // console.log('>>> tRPC Request from', source, 'by', authSession?.user, 'session:', authSession?.session)
  return authSession
}
