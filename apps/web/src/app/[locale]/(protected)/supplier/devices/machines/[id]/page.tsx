import { AppShell } from '@/components/dashboard/app-shell'
import { PhysicalDeviceDetailContent } from '../../../_components/physical-device-detail-content'

interface PhysicalDeviceDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PhysicalDeviceDetailPage({
  params,
}: PhysicalDeviceDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <PhysicalDeviceDetailContent deviceId={id} />
    </AppShell>
  )
}
