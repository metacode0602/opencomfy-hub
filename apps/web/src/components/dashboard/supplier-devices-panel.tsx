'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Cpu, MoreHorizontal, Plus, Server } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Progress } from '@workspace/ui/components/progress'
import { getDevicesBySupplierId } from '@/lib/data/mock-data'
import type { DataCenterDevice, Supplier } from '@/lib/data/types'
import { dcStatusColors, statusNames } from '@/components/dashboard/supplier-detail-constants'

interface SupplierDevicesPanelProps {
  supplier: Supplier
}

export function SupplierDevicesPanel({ supplier }: SupplierDevicesPanelProps) {
  const [devices] = useState<DataCenterDevice[]>(() => getDevicesBySupplierId(supplier.id))

  const totalOnlineDevices = devices.reduce((sum, d) => sum + d.onlineQuantity, 0)
  const totalDevices = devices.reduce((sum, d) => sum + d.quantity, 0)

  const devicesByCardType = useMemo(
    () =>
      devices.reduce(
        (acc, device) => {
          const existing = acc.find((d) => d.cardTypeName === device.cardTypeName)
          if (existing) {
            existing.quantity += device.quantity
            existing.onlineQuantity += device.onlineQuantity
          } else {
            acc.push({
              cardTypeName: device.cardTypeName,
              cardTypeId: device.cardTypeId,
              quantity: device.quantity,
              onlineQuantity: device.onlineQuantity,
            })
          }
          return acc
        },
        [] as {
          cardTypeName: string
          cardTypeId: string
          quantity: number
          onlineQuantity: number
        }[],
      ),
    [devices],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">设备资源</h2>
          <p className="text-sm text-muted-foreground">管理各机房的GPU设备和成本配置</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          新增设备
        </Button>
      </div>

      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">机房</TableHead>
              <TableHead className="text-muted-foreground">卡型</TableHead>
              <TableHead className="text-muted-foreground">数量</TableHead>
              <TableHead className="text-muted-foreground">在线</TableHead>
              <TableHead className="text-muted-foreground">在线率</TableHead>
              <TableHead className="text-muted-foreground">
                {supplier.cooperationMode === 'card_time' ? '卡时成本' : '分成成本'}
              </TableHead>
              <TableHead className="text-muted-foreground">状态</TableHead>
              <TableHead className="text-muted-foreground w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => {
              const onlineRate = (device.onlineQuantity / device.quantity) * 100
              return (
                <TableRow key={device.id} className="border-border">
                  <TableCell className="font-medium text-foreground">
                    {device.dataCenterName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{device.cardTypeName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">{device.quantity}</TableCell>
                  <TableCell className="text-foreground">{device.onlineQuantity}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={onlineRate} className="h-2 w-16" />
                      <span className="text-sm text-foreground">{onlineRate.toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    ¥
                    {(device.cardTimeCostPerHour || device.revenueShareCostPerHour || 0).toFixed(0)}
                    /小时
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={dcStatusColors[device.status]}>
                      {statusNames[device.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>编辑设备</DropdownMenuItem>
                        <DropdownMenuItem>调整成本</DropdownMenuItem>
                        <DropdownMenuItem>查看使用记录</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{totalDevices}</p>
                <p className="text-xs text-muted-foreground">设备总数</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{totalOnlineDevices}</p>
                <p className="text-xs text-muted-foreground">在线设备</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{devicesByCardType.length}</p>
                <p className="text-xs text-muted-foreground">卡型种类</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
