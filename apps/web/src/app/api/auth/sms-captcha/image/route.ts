import { NextRequest, NextResponse } from 'next/server'
import { getChallengeImage } from '@/lib/captcha/sms-captcha-server'

export async function GET(request: NextRequest) {
  try {
    const challengeId = request.nextUrl.searchParams.get('challengeId')
    const type = request.nextUrl.searchParams.get('type')
    if (!challengeId || (type !== 'bg' && type !== 'puzzle')) {
      return new NextResponse('Bad Request', { status: 400 })
    }
    const buffer = await getChallengeImage(challengeId, type)
    if (!buffer) return new NextResponse('Not Found', { status: 404 })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new NextResponse('Internal Error', { status: 500 })
  }
}
