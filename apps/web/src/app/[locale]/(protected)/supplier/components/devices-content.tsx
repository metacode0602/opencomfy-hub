'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { AggregateInventoryContent } from '../_components/aggregate-inventory-content'
import { PhysicalDevicesContent } from '../_components/physical-devices-content'

export function DevicesContent() {
  const [listTab, setListTab] = useState<'aggregate' | 'physical'>('aggregate')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">设备管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            机房×卡型聚合库存（L1）与物理机 SN 台账（L2）
          </p>
        </div>
        {listTab === 'aggregate' && (
          <Button className="gap-2" disabled>
            <Plus className="w-4 h-4" />
            新增设备
          </Button>
        )}
      </div>

      <Tabs value={listTab} onValueChange={(v) => setListTab(v as 'aggregate' | 'physical')}>
        <TabsList>
          <TabsTrigger value="aggregate">聚合库存（L1）</TabsTrigger>
          <TabsTrigger value="physical">物理机台账（L2）</TabsTrigger>
        </TabsList>
        <TabsContent value="aggregate" className="mt-4">
          <AggregateInventoryContent />
        </TabsContent>
        <TabsContent value="physical" className="mt-4">
          <PhysicalDevicesContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}
