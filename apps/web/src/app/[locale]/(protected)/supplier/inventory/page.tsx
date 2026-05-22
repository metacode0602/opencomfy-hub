import { AppShell } from "@/components/dashboard/app-shell";
import { AggregateInventoryContent } from '../_components/aggregate-inventory-content'

export default function SupplierInventoryPage() {
  return (
    <AppShell>
      <InventoryContent />
    </AppShell>
  )
}


function InventoryContent() {

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">设备库存</h1>
          <p className="text-sm text-muted-foreground mt-1">
            机房×卡型聚合库存（L1）
          </p>
        </div>
      </div>
      <AggregateInventoryContent />
    </div>
  )
}