import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter } from '@/lib/rate-limiter'
import { createJigsawChallenge } from '@/lib/captcha/sms-captcha-server'
import { getClientIp } from '@/lib/utils/request'

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const ok = (await rateLimiter.check('smsCaptchaChallengeIpMinute', ip)).ok
    if (!ok) {
      return NextResponse.json(
        { error: 'TOO_MANY_REQUESTS', message: '获取验证码过于频繁，请稍后再试' },
        { status: 429 }
      )
    }
    await rateLimiter.limit('smsCaptchaChallengeIpMinute', ip, { throws: true })
    const result = await createJigsawChallenge()
    return NextResponse.json(result)
  } catch (e) {
    if ((e as Error).message?.includes('Rate limit')) {
      return NextResponse.json(
        { error: 'TOO_MANY_REQUESTS', message: '获取验证码过于频繁，请稍后再试' },
        { status: 429 }
      )
    }
    console.warn('[sms-captcha challenge]', e)
    return NextResponse.json({ error: 'CHALLENGE_FAILED' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
