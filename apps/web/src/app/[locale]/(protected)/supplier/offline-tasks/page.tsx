import { AppShell } from '@/components/dashboard/app-shell'
import { PlannedBatchesContent } from '../_components/planned-batches-content'

export default function SupplierOfflineTasksPage() {
  return (
    <AppShell>
      <PlannedBatchesContent fixedBatchKind="device_retire" showLegacyHint />
    </AppShell>
  )
}
