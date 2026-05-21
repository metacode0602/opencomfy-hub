import { AppShell } from '@/components/dashboard/app-shell'
import { OnboardingBatchDetailContent } from '../../_components/onboarding-batch-detail-content'

interface OnlineTaskBatchDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OnlineTaskBatchDetailPage({
  params,
}: OnlineTaskBatchDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <OnboardingBatchDetailContent batchId={id} routeKind="online-tasks" />
    </AppShell>
  )
}
