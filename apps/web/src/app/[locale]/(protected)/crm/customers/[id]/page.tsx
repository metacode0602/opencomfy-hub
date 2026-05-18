import { notFound } from 'next/navigation'
import { CustomerDetailContent } from '@/components/dashboard/customer-detail-content'
import { AppShell } from '@/components/dashboard/app-shell'
import { getCustomerById } from '@/lib/data/mock-data'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const customer = getCustomerById(id)

  if (!customer) {
    notFound()
  }

  return (
    <AppShell>
      <CustomerDetailContent customer={customer} />
    </AppShell>
  )
}
