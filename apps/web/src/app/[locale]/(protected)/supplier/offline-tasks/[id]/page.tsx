import { AppShell } from '@/components/dashboard/app-shell'
import { DeviceRetireBatchDetailContent } from '../../_components/device-retire-batch-detail-content'

interface OfflineTaskDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OfflineTaskDetailPage({ params }: OfflineTaskDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <DeviceRetireBatchDetailContent batchId={id} />
    </AppShell>
  )
}
