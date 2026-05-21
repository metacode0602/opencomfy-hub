import { AppShell } from '@/components/dashboard/app-shell'
import { SupplierDetailContent } from '@/components/dashboard/supplier-detail-content'
import { createServerCaller } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id } = await params
  const caller = await createServerCaller()

  let supplier
  try {
    supplier = await caller.supplier.getById({ id })
  } catch {
    notFound()
  }

  return (
    <AppShell>
      <SupplierDetailContent supplier={supplier} />
    </AppShell>
  )
}
