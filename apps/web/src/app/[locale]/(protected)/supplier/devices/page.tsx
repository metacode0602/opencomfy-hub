import { AppShell } from "@/components/dashboard/app-shell";
import { Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { PhysicalDevicesContent } from "../_components/physical-devices-content";

export default function SupplierDevicesPage() {
  return (
    <AppShell>
      <DevicesContent />
    </AppShell>
  )
}


function DevicesContent() {

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">设备管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            物理机台账
          </p>
        </div>
          <Button className="gap-2" disabled>
            <Plus className="w-4 h-4" />
            新增设备
          </Button>

      </div>

      <PhysicalDevicesContent />
    </div>
  )
}
