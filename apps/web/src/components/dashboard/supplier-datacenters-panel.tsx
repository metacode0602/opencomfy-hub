'use client'

import { useState } from 'react'
import { MapPin, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Progress } from '@workspace/ui/components/progress'
import {
  getDataCentersBySupplierId,
  getDevicesBySupplierId,
} from '@/lib/data/mock-data'
import type { DataCenter, DataCenterDevice, Supplier } from '@/lib/data/types'
import { dcStatusColors, statusNames } from '@/components/dashboard/supplier-detail-constants'

interface SupplierDatacentersPanelProps {
  supplier: Supplier
}

export function SupplierDatacentersPanel({ supplier }: SupplierDatacentersPanelProps) {
  const [dataCenters] = useState<DataCenter[]>(() => getDataCentersBySupplierId(supplier.id))
  const [devices] = useState<DataCenterDevice[]>(() => getDevicesBySupplierId(supplier.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">机房管理</h2>
          <p className="text-sm text-muted-foreground">管理供应商的数据中心和配套费用</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          新增机房
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {dataCenters.map((dc) => {
          const dcDevices = devices.filter((d) => d.dataCenterId === dc.id)
          const dcOnlineDevices = dcDevices.reduce((sum, d) => sum + d.onlineQuantity, 0)
          const dcTotalDevices = dcDevices.reduce((sum, d) => sum + d.quantity, 0)

          return (
            <Card key={dc.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{dc.name}</CardTitle>
                      <Badge variant="outline" className={dcStatusColors[dc.status]}>
                        {statusNames[dc.status]}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {dc.address}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>编辑机房</DropdownMenuItem>
                      <DropdownMenuItem>管理设备</DropdownMenuItem>
                      <DropdownMenuItem>调整费用</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">机房编码:</span>
                  <code className="px-2 py-0.5 rounded bg-muted text-foreground">{dc.code}</code>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground">设备在线率</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress
                        value={dcTotalDevices > 0 ? (dcOnlineDevices / dcTotalDevices) * 100 : 0}
                        className="h-2 flex-1"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {dcOnlineDevices}/{dcTotalDevices}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">设备类型</p>
                    <p className="text-foreground font-medium mt-1">{dcDevices.length} 种卡型</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">网络费用 (月)</p>
                    <p className="text-lg font-semibold text-foreground">
                      ¥{dc.networkFee.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground">管控节点费用 (月)</p>
                    <p className="text-lg font-semibold text-foreground">
                      ¥{dc.managementNodeFee.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">设备分布</p>
                  <div className="flex flex-wrap gap-1">
                    {dcDevices.map((device) => (
                      <Badge key={device.id} variant="secondary" className="text-xs">
                        {device.cardTypeName}: {device.onlineQuantity}/{device.quantity}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
