import { AppShell } from '@/components/dashboard/app-shell'
import { AggregateInventoryDetailContent } from '../../_components/aggregate-inventory-detail-content'

interface InventoryDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function InventoryDetailPage({ params }: InventoryDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <AggregateInventoryDetailContent inventoryId={id} />
    </AppShell>
  )
}
