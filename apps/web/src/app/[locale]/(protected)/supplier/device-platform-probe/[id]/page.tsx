import { AppShell } from '@/components/dashboard/app-shell'
import { DevicePlatformProbeDetailContent } from '../../_components/device-platform-probe-detail-content'

interface DevicePlatformProbeDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function DevicePlatformProbeDetailPage({
  params,
}: DevicePlatformProbeDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <DevicePlatformProbeDetailContent probeId={id} />
    </AppShell>
  )
}
