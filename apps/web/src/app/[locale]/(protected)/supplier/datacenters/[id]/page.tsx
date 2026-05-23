import { AppShell } from '@/components/dashboard/app-shell'
import { DatacenterDetailContent } from '../../_components/datacenter-detail-content'

interface DatacenterDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function DatacenterDetailPage({ params }: DatacenterDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <DatacenterDetailContent dataCenterId={id} />
    </AppShell>
  )
}
