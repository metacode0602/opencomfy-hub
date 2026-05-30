import { AppShell } from '@/components/dashboard/app-shell'
import { PlannedBatchesContent } from '../_components/planned-batches-content'

export default function SupplierOrderAccessPage() {
  return (
    <AppShell>
      <PlannedBatchesContent fixedBatchKind="order_access" showLegacyHint />
    </AppShell>
  )
}
