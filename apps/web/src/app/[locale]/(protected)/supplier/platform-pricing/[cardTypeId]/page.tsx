import { AppShell } from '@/components/dashboard/app-shell'
import { PlatformPricingDetailContent } from '../../components/platform-pricing-detail-content'
import { platformPricingDataAccess } from '@/lib/server/dataaccess/platform-pricing'
import { notFound } from 'next/navigation'

interface PlatformPricingDetailPageProps {
  params: Promise<{ cardTypeId: string }>
}

export default async function PlatformPricingDetailPage({
  params,
}: PlatformPricingDetailPageProps) {
  const { cardTypeId } = await params
  const detailData = platformPricingDataAccess.getDetailPage(cardTypeId)

  if (!detailData) {
    notFound()
  }

  return (
    <AppShell>
      <PlatformPricingDetailContent initialData={detailData} />
    </AppShell>
  )
}
