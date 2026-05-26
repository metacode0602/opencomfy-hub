import { runScheduledBillingSync } from '@/lib/server/dataaccess/crm/billing-scheduled-sync'
import { getCronSecret } from '@/lib/server/dataaccess/crm/billing-sync-config'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const secret = getCronSecret()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runScheduledBillingSync({ trigger: 'scheduled' })
  return NextResponse.json(result)
}
