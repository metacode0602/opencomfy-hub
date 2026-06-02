import { TRPCError, initTRPC } from '@trpc/server'
import { ZodError } from 'zod'
/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */

import { transformer } from './transformer'
import type { Session, User } from 'better-auth'

export interface UserWithRole extends User {
  role?: 'admin' | 'user' | 'sales'
}

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API
 *
 * These allow you to access things like the database, the session, etc, when
 * processing a request
 *
 */
interface CreateContextOptions<NextRequest> {
  headers: Headers
  user: UserWithRole | null
  session: Session | null
  apiKey?: string | null
  req?: NextRequest
}

/**
 * This helper generates the "internals" for a tRPC context. If you need to use
 * it, you can export it from here
 *
 * Examples of things you may need it for:
 * - testing, so we dont have to mock Next.js' req/res
 * - trpc's `createSSGHelpers` where we don't have req/res
 * @see https://create.t3.gg/en/usage/trpc#-servertrpccontextts
 */
export const createInnerTRPCContext = <NextRequest>(opts: CreateContextOptions<NextRequest>) => {
  return { ...opts }
}

/**
 * This is the actual context you'll use in your router. It will be used to
 * process every request that goes through your tRPC endpoint
 * @link https://trpc.io/docs/context
 */
export const createTRPCContext = async <NextRequest extends { headers: Headers }>(opts: {
  headers: Headers
  req?: NextRequest
  user?: UserWithRole | null
  session?: Session | null
   
}) => {
  const apiKey = opts.req?.headers.get('x-acme-api-key')
  return createInnerTRPCContext({
    user: opts.user ?? null,
    session: opts.session ?? null,
    apiKey,
    req: opts.req,
    headers: opts.headers,
  })
}

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
export const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router
export const router = t.router
export const mergeRouters = t.mergeRouters
export const createCallerFactory = t.createCallerFactory
/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure

/**
 * Reusable procedure that enforces users are logged in before running the
 * code
 */
const PASSWORD_CHANGE_PATH_PREFIX = 'firstLogin.'

export const protectedProcedure = t.procedure.use(({ ctx, next, path }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '请先登录',
    })
  }

  const mustChangePassword = Boolean(
    (ctx.user as User & { mustChangePassword?: boolean }).mustChangePassword,
  )
  if (mustChangePassword && !path.startsWith(PASSWORD_CHANGE_PATH_PREFIX)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: '请先修改密码后再继续使用系统',
    })
  }

  return next({
    ctx: {
      user: ctx.user as User,
      session: ctx.session as Session,
    },
  })
})

/**
 * Reusable procedure that enforces users are logged in and isAdmin before running the
 * code
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '请先登录',
    })
  }
  console.log("[trpc] [adminProcedure] ctx.user?.role", ctx.user?.role);
  if (ctx.user?.role === 'user') { // 用户不能执行此操作，只能admin和sales执行
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '暂无权限操作',
    })
  }
  return next({
    ctx: {
      user: ctx.user as UserWithRole,
      session: ctx.session as Session,
    },
  })
})
