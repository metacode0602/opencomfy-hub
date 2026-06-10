import { AppShell } from '@/components/dashboard/app-shell'
import { createServerCaller } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'
import { MerchantRechargeContent } from '../../_components/merchant-recharge-content'

interface MerchantRechargePageProps {
  params: Promise<{ id: string }>
}

export default async function MerchantRechargePage({ params }: MerchantRechargePageProps) {
  const { id } = await params
  const caller = await createServerCaller()
  try {
    await caller.merchant.getById({ id })
  } catch {
    notFound()
  }

  return (
    <AppShell>
      <MerchantRechargeContent merchantId={id} />
    </AppShell>
  )
}
