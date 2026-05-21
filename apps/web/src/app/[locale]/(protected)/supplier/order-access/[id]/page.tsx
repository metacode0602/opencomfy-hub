import { AppShell } from '@/components/dashboard/app-shell'
import { OnboardingBatchDetailContent } from '../../_components/onboarding-batch-detail-content'

interface OrderAccessBatchDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderAccessBatchDetailPage({
  params,
}: OrderAccessBatchDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <OnboardingBatchDetailContent batchId={id} routeKind="order-access" />
    </AppShell>
  )
}
