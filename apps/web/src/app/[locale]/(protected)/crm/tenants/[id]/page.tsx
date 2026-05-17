import { AppShell } from '@/components/dashboard/app-shell'
import { TenantDetailContent } from '@/components/dashboard/tenant-detail-content'
import { mockTenants } from '@/lib/data/mock-data'
import { notFound } from 'next/navigation'

export default async function TenantDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const tenant = mockTenants.find(t => t.id === id)
  
  if (!tenant) {
    notFound()
  }

  return (
    <AppShell>
      <TenantDetailContent tenant={tenant} />
    </AppShell>
  )
}
