import { AppShell } from '@/components/dashboard/app-shell'
import { PlatformPricingDetailContent } from '../../components/platform-pricing-detail-content'

interface PlatformPricingDetailPageProps {
  params: Promise<{ cardTypeId: string }>
}

export default async function PlatformPricingDetailPage({
  params,
}: PlatformPricingDetailPageProps) {
  const { cardTypeId } = await params

  return (
    <AppShell>
      <PlatformPricingDetailContent cardTypeId={cardTypeId} />
    </AppShell>
  )
}
