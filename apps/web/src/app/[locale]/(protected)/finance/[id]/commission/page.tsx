'use client'

import { FinanceCommissionDeriveContent } from '@/app/[locale]/(protected)/finance/_components/finance-commission-derive-content'
import { useParams } from 'next/navigation'

export default function FinancePeriodCommissionPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  if (!id) {
    return (
      <div className="bg-background p-4 md:p-6">
        <p className="text-muted-foreground">无效账期 ID</p>
      </div>
    )
  }

  return <FinanceCommissionDeriveContent billingPeriodId={id} />
}
