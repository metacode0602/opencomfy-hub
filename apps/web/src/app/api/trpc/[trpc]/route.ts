import { createContextFromRequest } from '@/lib/trpc/server'
import { appRouter } from '@/lib/server/routers'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'

/**
 * 处理tRPC请求
 * @param req
 * @returns
 */
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async (opts) => {
      return await createContextFromRequest(opts.req)
    },
  })

export { handler as GET, handler as POST }
