/**
 * 短信验证码拼图：challenge 创建、图片读取、校验、一次性 token 发放与消费
 * 与 Better-Auth 自定义 captcha 插件配合：校验通过后返回 token，前端通过 Header 携带，插件内消费
 */

import crypto from 'node:crypto'
import Redis from 'ioredis'
import { createPuzzle } from '@/lib/captcha/puzzle-generator'

const CHALLENGE_TTL = 120
const TOKEN_TTL = 120
const MAX_ATTEMPTS = 5
/** 拼图 x 像素容差（仅校验水平位置；y 为库内鼠标位移不参与比对） */
const TOLERANCE_PX = 12

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: Number.parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy: () => null,
})

redis.on('error', (err) => {
  if (process.env.NEXT_PHASE !== 'phase-production-build') {
    console.warn('[Redis sms-captcha]', err.message)
  }
})

const CHALLENGE_PREFIX = 'sms_captcha_challenge:'
const TOKEN_PREFIX = 'sms_captcha_token:'

type ChallengeData = {
  x: number
  y: number
  attempts: number
  bgBase64: string
  puzzleBase64: string
}

export type CreateJigsawChallengeResult = {
  challengeId: string
  bgUrl: string
  puzzleUrl: string
  /** 拼图缺口在背景图上的 y 坐标，前端用于设置 SliderCaptcha puzzleSize.top */
  puzzleY: number
}

/**
 * 创建拼图 challenge：生成 bg/puzzle，存 Redis，返回 challengeId 与图片 URL（不包含 x,y）
 */
export async function createJigsawChallenge(): Promise<CreateJigsawChallengeResult> {
  const challengeId = crypto.randomUUID()
  const { bg, puzzle, x, y } = await createPuzzle(undefined, {})
  const data: ChallengeData = {
    x,
    y,
    attempts: 0,
    bgBase64: bg.toString('base64'),
    puzzleBase64: puzzle.toString('base64'),
  }
  const value = JSON.stringify(data)
  await redis.setex(CHALLENGE_PREFIX + challengeId, CHALLENGE_TTL, value)

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const bgUrl = `${base ?? ''}/api/auth/sms-captcha/image?challengeId=${encodeURIComponent(challengeId)}&type=bg`
  const puzzleUrl = `${base ?? ''}/api/auth/sms-captcha/image?challengeId=${encodeURIComponent(challengeId)}&type=puzzle`

  return { challengeId, bgUrl, puzzleUrl, puzzleY: data.y }
}

/**
 * 根据 challengeId 与 type 取背景图或拼图 Buffer（仅服务端读 Redis 用）
 */
export async function getChallengeImage(
  challengeId: string,
  type: 'bg' | 'puzzle'
): Promise<Buffer | null> {
  const raw = await redis.get(CHALLENGE_PREFIX + challengeId)
  if (!raw) return null
  const data = JSON.parse(raw) as ChallengeData
  const b64 = type === 'bg' ? data.bgBase64 : data.puzzleBase64
  return Buffer.from(b64, 'base64')
}

export type VerifyJigsawResult =
  | { ok: true; token: string }
  | { ok: false; error: 'INVALID_CHALLENGE' | 'SLIDER_MISMATCH' | 'TOO_MANY_ATTEMPTS' }

/**
 * 拼图校验：比对前端提交的 x（及 y）与 Redis 中存储的缺口位置，通过则发放一次性 token
 */
export async function verifyJigsawChallenge(
  challengeId: string,
  x: number,
  y?: number
): Promise<VerifyJigsawResult> {
  const key = CHALLENGE_PREFIX + challengeId
  const raw = await redis.get(key)
  if (!raw) return { ok: false, error: 'INVALID_CHALLENGE' }
  const data = JSON.parse(raw) as ChallengeData

  if (data.attempts >= MAX_ATTEMPTS) {
    await redis.del(key)
    return { ok: false, error: 'TOO_MANY_ATTEMPTS' }
  }

  const diffX = Math.abs(x - data.x)
  // rc-slider-captcha 的 VerifyParam.y 是「鼠标按下到松手的 Y 轴位移」，不是缺口纵坐标，故仅用 x 做容差校验
  const diffY = y !== undefined ? Math.abs(y - data.y) : 0
  const pass = diffX <= TOLERANCE_PX

  console.log('[sms-captcha verify]', {
    challengeId,
    received: { x, y },
    stored: { x: data.x, y: data.y },
    diffX,
    diffY,
    tolerancePx: TOLERANCE_PX,
    pass,
  })

  if (!pass) {
    data.attempts += 1
    await redis.setex(key, CHALLENGE_TTL, JSON.stringify(data))
    return { ok: false, error: 'SLIDER_MISMATCH' }
  }

  await redis.del(key)
  const token = crypto.randomBytes(16).toString('hex')
  await redis.setex(TOKEN_PREFIX + token, TOKEN_TTL, '1')
  return { ok: true, token }
}

/** 校验并消费 token（一次性），存在则删除并返回 true；供 Better-Auth 插件使用 */
export async function consumeAndValidateToken(token: string): Promise<boolean> {
  const key = TOKEN_PREFIX + token
  const exists = await redis.get(key)
  if (!exists) return false
  await redis.del(key)
  return true
}
