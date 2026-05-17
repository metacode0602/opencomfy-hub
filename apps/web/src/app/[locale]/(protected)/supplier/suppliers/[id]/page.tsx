import { AppShell } from '@/components/dashboard/app-shell'
import { SupplierDetailContent } from '@/components/dashboard/supplier-detail-content'
import { mockSuppliers } from '@/lib/data/mock-data'
import { notFound } from 'next/navigation'

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id } = await params
  const supplier = mockSuppliers.find((s) => s.id === id)

  if (!supplier) {
    notFound()
  }

  return (
    <AppShell>
      <SupplierDetailContent supplier={supplier} />
    </AppShell>
  )
}
