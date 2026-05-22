import { AppShell } from '@/components/dashboard/app-shell'
import { SuppliersContent } from '@/components/dashboard/suppliers-content'

interface SuppliersPageProps {
  searchParams: Promise<{ external_tenant_id?: string }>
}

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  const { external_tenant_id } = await searchParams
  const externalTenantId = external_tenant_id?.trim() || undefined

  return (
    <AppShell>
      <SuppliersContent externalTenantId={externalTenantId} />
    </AppShell>
  )
}
