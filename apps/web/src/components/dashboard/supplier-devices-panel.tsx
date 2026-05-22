'use client'

import { Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import type { Supplier } from '@/lib/data/types'
import { AggregateInventoryContent } from '@/app/[locale]/(protected)/supplier/_components/aggregate-inventory-content'

interface SupplierDevicesPanelProps {
  supplier: Supplier
  onOpenOpsImport?: () => void
}

export function SupplierDevicesPanel({ supplier, onOpenOpsImport }: SupplierDevicesPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">设备资源</h2>
          <p className="text-sm text-muted-foreground">管理各机房的 GPU 设备聚合库存与成本配置</p>
        </div>
        <div className="flex gap-2">
          {onOpenOpsImport && (
            <Button variant="outline" className="gap-2" onClick={onOpenOpsImport}>
              <Plus className="w-4 h-4" />
              运维导入
            </Button>
          )}
          <Button className="gap-2" disabled>
            <Plus className="w-4 h-4" />
            新增设备
          </Button>
        </div>
      </div>

      <AggregateInventoryContent supplierIdFilter={supplier.id} />
    </div>
  )
}
