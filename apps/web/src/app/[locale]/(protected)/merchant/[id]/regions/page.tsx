import { AppShell } from '@/components/dashboard/app-shell'
import { createServerCaller } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'
import { MerchantRegionsContent } from '../../_components/merchant-regions-content'

interface MerchantRegionsPageProps {
  params: Promise<{ id: string }>
}

export default async function MerchantRegionsPage({ params }: MerchantRegionsPageProps) {
  const { id } = await params
  const caller = await createServerCaller()
  try {
    await caller.merchant.getById({ id })
  } catch {
    notFound()
  }

  return (
    <AppShell>
      <MerchantRegionsContent merchantId={id} />
    </AppShell>
  )
}
