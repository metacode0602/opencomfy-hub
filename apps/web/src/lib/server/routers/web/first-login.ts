import { createTRPCRouter, protectedProcedure } from '../trpc'
import { db } from '@/lib/db'
import { session, user } from '@workspace/db/schema'
import { eq, and, gt, count } from 'drizzle-orm'

export const firstLoginRouter = createTRPCRouter({
  /**
   * 检查是否是首次登录
   * 判断逻辑：
   * 1. 获取当前 session 的创建时间
   * 2. 获取用户的创建时间
   * 3. 如果 session 创建时间与用户创建时间在 5 分钟内，认为是首次登录
   * 4. 或者：如果用户只有一个活跃的 session，且该 session 创建时间接近用户创建时间
   */
  checkFirstLogin: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id
    const currentSessionId = ctx.session.id

    // 获取用户信息
    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, userId),
      columns: {
        id: true,
        createdAt: true,
      },
    })

    if (!currentUser) {
      return { isFirstLogin: false, reason: 'user_not_found' }
    }

    // 获取当前 session 信息
    const currentSession = await db.query.session.findFirst({
      where: eq(session.id, currentSessionId),
      columns: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
    })

    if (!currentSession) {
      return { isFirstLogin: false, reason: 'session_not_found' }
    }

    // 检查 session 是否过期
    const now = new Date()
    if (currentSession.expiresAt < now) {
      return { isFirstLogin: false, reason: 'session_expired' }
    }

    // 计算时间差（毫秒）
    const userCreatedAt = new Date(currentUser.createdAt)
    const sessionCreatedAt = new Date(currentSession.createdAt)
    const timeDiff = Math.abs(sessionCreatedAt.getTime() - userCreatedAt.getTime())

    // 5 分钟内的阈值（毫秒）
    const FIRST_LOGIN_THRESHOLD = 5 * 60 * 1000 // 5 分钟

    // 方法1：如果 session 创建时间与用户创建时间在 5 分钟内，认为是首次登录
    const isTimeBasedFirstLogin = timeDiff <= FIRST_LOGIN_THRESHOLD

    // 方法2：检查用户是否有其他活跃的 session
    // 如果只有当前这一个活跃 session，且时间接近，也认为是首次登录
    const activeSessionsResult = await db
      .select({ count: count() })
      .from(session)
      .where(
        and(
          eq(session.userId, userId),
          gt(session.expiresAt, now)
        )
      )

    const activeSessionCount = activeSessionsResult[0]?.count ?? 0
    const hasMultipleSessions = activeSessionCount > 1
    const isSessionBasedFirstLogin = !hasMultipleSessions && timeDiff <= FIRST_LOGIN_THRESHOLD * 2 // 10 分钟

    const isFirstLogin = isTimeBasedFirstLogin || isSessionBasedFirstLogin

    return {
      isFirstLogin,
      userCreatedAt: userCreatedAt.toISOString(),
      sessionCreatedAt: sessionCreatedAt.toISOString(),
      timeDiffMinutes: Math.round(timeDiff / (60 * 1000)),
      reason: isFirstLogin ? 'first_login_detected' : 'not_first_login',
    }
  }),
})

