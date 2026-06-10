import { AppShell } from '@/components/dashboard/app-shell'
import { createServerCaller } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'
import { MerchantTenantsContent } from '../../_components/merchant-tenants-content'

interface MerchantTenantsPageProps {
  params: Promise<{ id: string }>
}

export default async function MerchantTenantsPage({ params }: MerchantTenantsPageProps) {
  const { id } = await params
  const caller = await createServerCaller()
  try {
    await caller.merchant.getById({ id })
  } catch {
    notFound()
  }

  return (
    <AppShell>
      <MerchantTenantsContent merchantId={id} />
    </AppShell>
  )
}
