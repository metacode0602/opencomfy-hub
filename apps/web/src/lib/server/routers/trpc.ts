import { TRPCError, initTRPC } from '@trpc/server'
import { ZodError } from 'zod'

import { normalizeAppRole, type AppRole } from '@/lib/auth/app-role'
import { resolveCrmDataScope, type CrmDataScope } from '@/lib/server/auth/crm-data-scope'
import { resolveMerchantDataScope, type MerchantDataScope } from '@/lib/server/auth/merchant-data-scope'
import { transformer } from './transformer'
import type { Session, User } from 'better-auth'

export interface UserWithRole extends User {
  role?: AppRole | 'sales' | string
}

interface CreateContextOptions<NextRequest> {
  headers: Headers
  user: UserWithRole | null
  session: Session | null
  apiKey?: string | null
  req?: NextRequest
  crmScope?: CrmDataScope
  merchantScope?: MerchantDataScope
}

export const createInnerTRPCContext = <NextRequest>(opts: CreateContextOptions<NextRequest>) => {
  return { ...opts }
}

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

export const createTRPCRouter = t.router
export const router = t.router
export const mergeRouters = t.mergeRouters
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure

const PASSWORD_CHANGE_PATH_PREFIX = 'firstLogin.'

function assertAuthenticated(ctx: { user?: UserWithRole | null }) {
  if (!ctx.user?.id) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '请先登录',
    })
  }
}

function assertPasswordChanged(ctx: { user?: UserWithRole | null }, path: string) {
  const mustChangePassword = Boolean(
    (ctx.user as User & { mustChangePassword?: boolean } | undefined)?.mustChangePassword,
  )
  if (mustChangePassword && !path.startsWith(PASSWORD_CHANGE_PATH_PREFIX)) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: '请先修改密码后再继续使用系统',
    })
  }
}

function getAppRole(ctx: { user?: UserWithRole | null }): AppRole {
  assertAuthenticated(ctx)
  const role = normalizeAppRole(ctx.user?.role)
  if (!role) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '账号角色无效' })
  }
  return role
}

export const protectedProcedure = t.procedure.use(({ ctx, next, path }) => {
  assertAuthenticated(ctx)
  assertPasswordChanged(ctx, path)
  return next({
    ctx: {
      user: ctx.user as User,
      session: ctx.session as Session,
    },
  })
})

export const adminProcedure = t.procedure.use(({ ctx, next, path }) => {
  assertAuthenticated(ctx)
  assertPasswordChanged(ctx, path)
  if (getAppRole(ctx) !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '需要管理员权限',
    })
  }
  return next({
    ctx: {
      user: ctx.user as UserWithRole,
      session: ctx.session as Session,
    },
  })
})

export const supplyProcedure = t.procedure.use(({ ctx, next, path }) => {
  assertAuthenticated(ctx)
  assertPasswordChanged(ctx, path)
  const role = getAppRole(ctx)
  if (role !== 'admin' && role !== 'member') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '暂无供应链访问权限',
    })
  }
  return next({
    ctx: {
      user: ctx.user as UserWithRole,
      session: ctx.session as Session,
    },
  })
})

export const sharedReadProcedure = t.procedure.use(({ ctx, next, path }) => {
  assertAuthenticated(ctx)
  assertPasswordChanged(ctx, path)
  return next({
    ctx: {
      user: ctx.user as UserWithRole,
      session: ctx.session as Session,
    },
  })
})

export const crmScopedProcedure = t.procedure.use(async ({ ctx, next, path }) => {
  assertAuthenticated(ctx)
  assertPasswordChanged(ctx, path)
  const role = getAppRole(ctx)
  if (role === 'member') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '暂无 CRM 访问权限',
    })
  }

  const crmScope = await resolveCrmDataScope(ctx.user as UserWithRole)
  return next({
    ctx: {
      user: ctx.user as UserWithRole,
      session: ctx.session as Session,
      crmScope,
    },
  })
})

export const crmWriteProcedure = t.procedure.use(async ({ ctx, next, path }) => {
  assertAuthenticated(ctx)
  assertPasswordChanged(ctx, path)
  const role = getAppRole(ctx)
  if (role === 'member') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '暂无 CRM 写权限',
    })
  }

  const crmScope = await resolveCrmDataScope(ctx.user as UserWithRole)
  return next({
    ctx: {
      user: ctx.user as UserWithRole,
      session: ctx.session as Session,
      crmScope,
    },
  })
})

export const merchantScopedProcedure = t.procedure.use(async ({ ctx, next, path }) => {
  assertAuthenticated(ctx)
  assertPasswordChanged(ctx, path)
  const role = getAppRole(ctx)
  if (role === 'member') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '暂无商户访问权限',
    })
  }

  const merchantScope = await resolveMerchantDataScope(ctx.user as UserWithRole)
  return next({
    ctx: {
      user: ctx.user as UserWithRole,
      session: ctx.session as Session,
      merchantScope,
    },
  })
})

export const merchantWriteProcedure = t.procedure.use(async ({ ctx, next, path }) => {
  assertAuthenticated(ctx)
  assertPasswordChanged(ctx, path)
  const role = getAppRole(ctx)
  if (role === 'member') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '暂无商户写权限',
    })
  }

  const merchantScope = await resolveMerchantDataScope(ctx.user as UserWithRole)
  return next({
    ctx: {
      user: ctx.user as UserWithRole,
      session: ctx.session as Session,
      merchantScope,
    },
  })
})
