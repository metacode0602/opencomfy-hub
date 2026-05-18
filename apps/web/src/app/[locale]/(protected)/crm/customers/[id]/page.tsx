import { notFound } from 'next/navigation'
import { CustomerDetailContent } from '@/components/dashboard/customer-detail-content'
import { AppShell } from '@/components/dashboard/app-shell'
import { createServerCaller } from '@/lib/trpc/server'

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const caller = await createServerCaller()
  const customer = await caller.crm.customers.getById({ id })

  if (!customer) {
    notFound()
  }

  return (
    <AppShell>
      <CustomerDetailContent customer={customer} />
    </AppShell>
  )
}
