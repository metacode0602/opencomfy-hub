import { AppShell } from '@/components/dashboard/app-shell'
import { AggregateInventoryDetailContent } from '../../_components/aggregate-inventory-detail-content'
import {
  getDeviceById,
  getInventoryChangeLogsByInventoryId,
  mockSuppliers,
} from '@/lib/data/mock-data'
import { notFound } from 'next/navigation'

interface AggregateInventoryDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AggregateInventoryDetailPage({
  params,
}: AggregateInventoryDetailPageProps) {
  const { id } = await params
  const inventory = getDeviceById(id)

  if (!inventory) {
    notFound()
  }

  const supplier = mockSuppliers.find((s) => s.id === inventory.supplierId)
  const changeLogs = getInventoryChangeLogsByInventoryId(id)

  return (
    <AppShell>
      <AggregateInventoryDetailContent
        inventory={inventory}
        supplierName={supplier?.name ?? inventory.supplierId}
        cooperationMode={supplier?.cooperationMode ?? 'card_time'}
        changeLogs={changeLogs}
      />
    </AppShell>
  )
}
