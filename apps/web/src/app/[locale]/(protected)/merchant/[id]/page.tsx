import { AppShell } from '@/components/dashboard/app-shell'
import { createServerCaller } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'
import { MerchantDetailContent } from '../_components/merchant-detail-content'

interface MerchantDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function MerchantDetailPage({ params }: MerchantDetailPageProps) {
  const { id } = await params
  const caller = await createServerCaller()
  try {
    await caller.merchant.getById({ id })
  } catch {
    notFound()
  }

  return (
    <AppShell>
      <MerchantDetailContent merchantId={id} />
    </AppShell>
  )
}
