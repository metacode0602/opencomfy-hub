import { AppShell } from '@/components/dashboard/app-shell'
import { createServerCaller } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'
import { MerchantConsumptionContent } from '../../_components/merchant-consumption-content'

interface MerchantConsumptionPageProps {
  params: Promise<{ id: string }>
}

export default async function MerchantConsumptionPage({ params }: MerchantConsumptionPageProps) {
  const { id } = await params
  const caller = await createServerCaller()
  try {
    await caller.merchant.getById({ id })
  } catch {
    notFound()
  }

  return (
    <AppShell>
      <MerchantConsumptionContent merchantId={id} />
    </AppShell>
  )
}
