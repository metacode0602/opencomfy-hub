import { Suspense } from 'react'
import { AppShell } from '@/components/dashboard/app-shell'
import { createServerCaller } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'
import { MerchantPricingContent } from '../../_components/merchant-pricing-content'

interface MerchantPricingPageProps {
  params: Promise<{ id: string }>
}

export default async function MerchantPricingPage({ params }: MerchantPricingPageProps) {
  const { id } = await params
  const caller = await createServerCaller()
  try {
    await caller.merchant.getById({ id })
  } catch {
    notFound()
  }

  return (
    <AppShell>
      <Suspense fallback={<div className="text-sm text-muted-foreground">加载中...</div>}>
        <MerchantPricingContent merchantId={id} />
      </Suspense>
    </AppShell>
  )
}
