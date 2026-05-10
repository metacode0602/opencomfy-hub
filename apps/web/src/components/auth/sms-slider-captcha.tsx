'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@workspace/ui/components/dialog'
import SliderCaptcha, { type VerifyParam } from 'rc-slider-captcha'

const CHALLENGE_URL = '/api/auth/sms-captcha/challenge'
const VERIFY_URL = '/api/auth/sms-captcha/verify'

type CachedChallenge = {
  challengeId: string
  bgUrl: string
  puzzleUrl: string
  puzzleY: number
}

export interface SmsSliderCaptchaProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 验证成功后回调，携带 token；调用方在 sendOtp 时通过 Header x-temp-captcha-token 传递 */
  onVerified: (token: string) => void | Promise<void>
}

export function SmsSliderCaptcha({ open, onOpenChange, onVerified }: SmsSliderCaptchaProps) {
  const t = useTranslations('AuthPage.phoneLogin')
  const [error, setError] = useState<string | null>(null)
  const [puzzleTop, setPuzzleTop] = useState(10)
  const cachedChallengeRef = useRef<CachedChallenge | null>(null)
  /** 进行中的 request Promise，用于 Strict Mode 下二次 mount 时复用同一请求，避免 challenge 被调用两次 */
  const requestPromiseRef = useRef<Promise<{ bgUrl: string; puzzleUrl: string }> | null>(null)

  useEffect(() => {
    if (!open) {
      cachedChallengeRef.current = null
      requestPromiseRef.current = null
    }
  }, [open])

  const handleRequest = useCallback(async () => {
    setError(null)
    if (cachedChallengeRef.current) {
      const cached = cachedChallengeRef.current
      setPuzzleTop(cached.puzzleY)
      return { bgUrl: cached.bgUrl, puzzleUrl: cached.puzzleUrl }
    }
    if (requestPromiseRef.current) {
      const result = await requestPromiseRef.current
      const cached = cachedChallengeRef.current as CachedChallenge | null
      if (cached?.puzzleY != null) setPuzzleTop(cached.puzzleY)
      return result
    }
    const promise = (async () => {
      const res = await fetch(CHALLENGE_URL, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.challengeId || !data.bgUrl || !data.puzzleUrl) {
        setError(t('captchaChallengeFailed'))
        throw new Error('CHALLENGE_FAILED')
      }
      const puzzleY = typeof data.puzzleY === 'number' ? data.puzzleY : 10
      cachedChallengeRef.current = {
        challengeId: data.challengeId as string,
        bgUrl: data.bgUrl as string,
        puzzleUrl: data.puzzleUrl as string,
        puzzleY,
      }
      setPuzzleTop(puzzleY)
      return {
        bgUrl: data.bgUrl as string,
        puzzleUrl: data.puzzleUrl as string,
      }
    })()
    requestPromiseRef.current = promise
    return promise
  }, [t])

  const handleVerify = useCallback(
    async (verifyData: VerifyParam) => {
      const challengeId = cachedChallengeRef.current?.challengeId ?? null
      if (!challengeId) {
        setError(t('captchaChallengeFailed'))
        throw new Error('NO_CHALLENGE')
      }
      const res = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          x: verifyData.x,
          y: verifyData.y,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err = data?.error
        if (err === 'TOO_MANY_ATTEMPTS') setError(t('captchaTooManyAttempts'))
        else if (err === 'SLIDER_MISMATCH') setError(t('captchaMismatch'))
        else setError(t('captchaVerifyFailed'))
        throw new Error(err ?? 'VERIFY_FAILED')
      }
      if (!data.token) {
        setError(t('captchaVerifyFailed'))
        throw new Error('NO_TOKEN')
      }
      onOpenChange(false)
      await Promise.resolve(onVerified(data.token as string))
    },
    [t, onOpenChange, onVerified]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[372px] max-w-[calc(100vw-2rem)]'>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('captchaHint')}</DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          {open && (
            <SliderCaptcha
              mode='embed'
              puzzleSize={{
                width: 60,
                height: 60,
                top: puzzleTop,
              }}
              request={handleRequest}
              onVerify={handleVerify}
              errorHoldDuration={1000}
              tipText={{
                default: t('captchaHint'),
                loading: t('captchaLoading'),
                moving: t('captchaHint'),
                verifying: t('captchaVerifying'),
                success: t('codeSent'),
                error: t('captchaVerifyFailed'),
                errors: t('captchaVerifyFailed'),
                loadFailed: t('captchaChallengeFailed'),
              }}
            />
          )}
          {error && <p className='text-destructive text-xs'>{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
