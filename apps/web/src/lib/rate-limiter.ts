import Redis from 'ioredis'

// Redis 连接配置
// 使用 lazyConnect 避免在构建时立即连接
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: Number.parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy: () => null, // 禁用自动重连，避免构建时无限重试
})

// 添加错误处理，避免未处理的错误事件
redis.on('error', (error) => {
  // 在运行时（非构建时），如果 Redis 不可用，只记录警告而不抛出错误
  // 构建时不会触发此错误，因为使用了 lazyConnect
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    console.warn('[Redis] Connection error (non-fatal):', error.message)
  }
})

// 限流配置
export const RATE_LIMITS = {
  ANONYMOUS_DAILY: 3,
  AUTHENTICATED_DAILY: 50,
  STANDARD_MONTHLY: 1000,
  PREMIUM_MONTHLY: 10_000,
  // 短信验证码防刷：同一手机号 1/分钟、5/小时，同一 IP 10/小时
  SMS_PHONE_MINUTE: 1,
  SMS_PHONE_HOUR: 5,
  SMS_IP_HOUR: 10,
  // 滑块验证码防刷：同一 IP 获取 challenge / 提交 verify 的频率
  SMS_CAPTCHA_CHALLENGE_IP_MINUTE: 20,
  SMS_CAPTCHA_VERIFY_IP_MINUTE: 60,
} as const

export type RateLimitType =
  | 'anonymousDaily'
  | 'authenticatedDaily'
  | 'standardMonthly'
  | 'premiumMonthly'
  | 'smsPhoneMinute'
  | 'smsPhoneHour'
  | 'smsIpHour'
  | 'smsCaptchaChallengeIpMinute'
  | 'smsCaptchaVerifyIpMinute'

type RateLimitResult = {
  ok: boolean
  remaining: number
  resetTime: number
  total: number
}

class RateLimiter {
  private readonly redis: Redis

  constructor(redisInstance: Redis) {
    this.redis = redisInstance
  }

  /**
   * 检查限流状态（不消耗配额）
   */
  async check(limitType: RateLimitType, key: string): Promise<RateLimitResult> {
    const config = this.getLimitConfig(limitType)
    const redisKey = this.getRedisKey(limitType, key)

    try {
      const current = await this.redis.get(redisKey)
      const count = current ? Number.parseInt(current, 10) : 0
      const remaining = Math.max(0, config.limit - count)
      const resetTime = this.getResetTime(config.period)

      return {
        ok: count < config.limit,
        remaining,
        resetTime,
        total: config.limit,
      }
    } catch (_error) {
      // 如果 Redis 出错，允许请求通过
      return {
        ok: true,
        remaining: config.limit,
        resetTime: Date.now() + config.period,
        total: config.limit,
      }
    }
  }

  /**
   * 消耗限流配额
   */
  async limit(limitType: RateLimitType, key: string, options: { throws?: boolean } = {}): Promise<RateLimitResult> {
    const config = this.getLimitConfig(limitType)
    const redisKey = this.getRedisKey(limitType, key)

    try {
      // 使用 Redis 的 INCR 和 EXPIRE 原子操作
      const pipeline = this.redis.pipeline()
      pipeline.incr(redisKey)
      pipeline.expire(redisKey, Math.ceil(config.period / 1000))

      const results = await pipeline.exec()
      const count = results?.[0]?.[1] as number

      if (count === 1) {
        // 第一次设置过期时间
        await this.redis.expire(redisKey, Math.ceil(config.period / 1000))
      }

      const remaining = Math.max(0, config.limit - count)
      const resetTime = this.getResetTime(config.period)

      const result: RateLimitResult = {
        ok: count <= config.limit,
        remaining,
        resetTime,
        total: config.limit,
      }

      if (!result.ok && options.throws) {
        throw new Error(`Rate limit exceeded for ${limitType}`)
      }

      return result
    } catch (_error) {
      // 如果 Redis 出错，允许请求通过
      return {
        ok: true,
        remaining: config.limit,
        resetTime: Date.now() + config.period,
        total: config.limit,
      }
    }
  }

  /**
   * 获取当前限流值
   */
  async getValue(limitType: RateLimitType, key: string): Promise<{ value: number; ts: number }> {
    const redisKey = this.getRedisKey(limitType, key)

    try {
      const current = await this.redis.get(redisKey)
      const value = current ? Number.parseInt(current, 10) : 0
      const ttl = await this.redis.ttl(redisKey)
      const ts = Date.now() - Math.ceil(ttl) * 1000

      return { value, ts }
    } catch (_error) {
      return { value: 0, ts: Date.now() }
    }
  }

  private getLimitConfig(limitType: RateLimitType) {
    switch (limitType) {
      case 'anonymousDaily':
        return { limit: RATE_LIMITS.ANONYMOUS_DAILY, period: 24 * 60 * 60 * 1000 } // 24 hours
      case 'authenticatedDaily':
        return { limit: RATE_LIMITS.AUTHENTICATED_DAILY, period: 24 * 60 * 60 * 1000 } // 24 hours
      case 'standardMonthly':
        return { limit: RATE_LIMITS.STANDARD_MONTHLY, period: 30 * 24 * 60 * 60 * 1000 } // 30 days
      case 'premiumMonthly':
        return { limit: RATE_LIMITS.PREMIUM_MONTHLY, period: 30 * 24 * 60 * 60 * 1000 } // 30 days
      case 'smsPhoneMinute':
        return { limit: RATE_LIMITS.SMS_PHONE_MINUTE, period: 60 * 1000 } // 1 minute
      case 'smsPhoneHour':
        return { limit: RATE_LIMITS.SMS_PHONE_HOUR, period: 60 * 60 * 1000 } // 1 hour
      case 'smsIpHour':
        return { limit: RATE_LIMITS.SMS_IP_HOUR, period: 60 * 60 * 1000 } // 1 hour
      case 'smsCaptchaChallengeIpMinute':
        return {
          limit: RATE_LIMITS.SMS_CAPTCHA_CHALLENGE_IP_MINUTE,
          period: 60 * 1000,
        }
      case 'smsCaptchaVerifyIpMinute':
        return {
          limit: RATE_LIMITS.SMS_CAPTCHA_VERIFY_IP_MINUTE,
          period: 60 * 1000,
        }
      default:
        throw new Error(`Unknown rate limit type: ${limitType}`)
    }
  }

  private getRedisKey(limitType: RateLimitType, key: string): string {
    return `rate_limit:${limitType}:${key}`
  }

  private getResetTime(period: number): number {
    return Date.now() + period
  }

  /**
   * 清理过期的限流记录
   */
  async cleanup(): Promise<void> {
    try {
      const pattern = 'rate_limit:*'
      const keys = await this.redis.keys(pattern)

      if (keys.length > 0) {
        const pipeline = this.redis.pipeline()
        for (const key of keys) {
          pipeline.ttl(key)
        }

        const results = await pipeline.exec()
        const expiredKeys: string[] = []

        results?.forEach((result, index) => {
          if (result && result[1] === -1) {
            expiredKeys.push(keys[index])
          }
        })

        if (expiredKeys.length > 0) {
          await this.redis.del(...expiredKeys)
        }
      }
    } catch (_error) {
      // 忽略清理错误
    }
  }

  /**
   * 关闭 Redis 连接
   */
  async close(): Promise<void> {
    await this.redis.quit()
  }
}

// 创建全局限流器实例
export const rateLimiter = new RateLimiter(redis)

// 错误类型
export class RateLimitError extends Error {
  limitType: RateLimitType
  remaining: number
  resetTime: number

  constructor(limitType: RateLimitType, remaining: number, resetTime: number) {
    super(
      `Rate limit exceeded for ${limitType}. Remaining: ${remaining}, Reset at: ${new Date(resetTime).toISOString()}`
    )
    this.name = 'RateLimitError'
    this.limitType = limitType
    this.remaining = remaining
    this.resetTime = resetTime
  }
}

// 辅助函数：检查用户是否超过限流
export async function checkUserRateLimit(
  userId: string,
  isAnonymous: boolean,
  isPremium: boolean,
  usesPremiumCredits = false
): Promise<RateLimitResult> {
  if (isPremium && usesPremiumCredits) {
    return await rateLimiter.check('premiumMonthly', userId)
  }
  // 检查月度限制
  const monthlyResult = await rateLimiter.check('standardMonthly', userId)
  if (!monthlyResult.ok) {
    return monthlyResult
  }

  // 检查日限制（仅非高级用户）
  if (!isPremium) {
    const dailyLimitType = isAnonymous ? 'anonymousDaily' : 'authenticatedDaily'
    return await rateLimiter.check(dailyLimitType, userId)
  }

  return monthlyResult
}

// 辅助函数：消耗用户限流配额
export async function consumeUserRateLimit(
  userId: string,
  isAnonymous: boolean,
  isPremium: boolean,
  usesPremiumCredits = false
): Promise<RateLimitResult> {
  if (isPremium && usesPremiumCredits) {
    return await rateLimiter.limit('premiumMonthly', userId, { throws: true })
  }

  // 检查月度限制
  const monthlyResult = await rateLimiter.limit('standardMonthly', userId, { throws: true })

  // 消耗日限制（仅非高级用户）
  if (!isPremium) {
    const dailyLimitType = isAnonymous ? 'anonymousDaily' : 'authenticatedDaily'
    await rateLimiter.limit(dailyLimitType, userId, { throws: true })
  }

  return monthlyResult
}

/** 短信验证码限流：先检查三个维度均未超限，再统一扣减；任一层超限则 throw 可读 message */
export async function checkAndConsumeSmsRateLimit(phoneNumber: string, ip: string): Promise<void> {
  const r1 = await rateLimiter.check('smsPhoneMinute', phoneNumber)
  const r2 = await rateLimiter.check('smsPhoneHour', phoneNumber)
  const r3 = await rateLimiter.check('smsIpHour', ip)
  if (!r1.ok) throw new Error('发送验证码过于频繁，请 1 分钟后再试')
  if (!r2.ok) throw new Error('该手机号今日验证码次数已达上限，请稍后再试')
  if (!r3.ok) throw new Error('请求过于频繁，请稍后再试')
  await rateLimiter.limit('smsPhoneMinute', phoneNumber, { throws: true })
  await rateLimiter.limit('smsPhoneHour', phoneNumber, { throws: true })
  await rateLimiter.limit('smsIpHour', ip, { throws: true })
}
