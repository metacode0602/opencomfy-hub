'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { ListPagination } from '@/components/shared/list-pagination'
import { useListPagination } from '@/hooks/use-list-pagination'
import type { PhysicalDevice } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { normalizeDeviceOpsStatus } from '@/lib/supplier/device-import-utils'
import { LIFECYCLE_STATUS_COLORS } from '@/lib/supplier/onboarding-batch-utils'
import { DEVICE_OPS_STATUS_SEEDS } from '@workspace/db/schema'

const KNOWN_DEVICE_OPS_STATUSES = DEVICE_OPS_STATUS_SEEDS.map((s) => s.stateCode)

function formatDeviceIp(device: PhysicalDevice): string {
  if (device.internalIp && device.externalIp) {
    return `${device.internalIp} / ${device.externalIp}`
  }
  return device.internalIp ?? device.externalIp ?? '—'
}

function deviceMatchesOpsStatus(device: PhysicalDevice, opsStatusFilter: string): boolean {
  const normalized = normalizeDeviceOpsStatus(device.opsStatus ?? '预留闲置中')
  if (opsStatusFilter === '其他') {
    return !KNOWN_DEVICE_OPS_STATUSES.includes(normalized)
  }
  return normalized === opsStatusFilter
}

export function DatacenterOpsStatusDevicesDialog({
  open,
  onOpenChange,
  dataCenterId,
  dataCenterName,
  supplierId,
  opsStatusFilter,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataCenterId: string
  dataCenterName: string
  supplierId: string
  /** 具体运营状态，或 `all` 表示本机房全部设备 */
  opsStatusFilter: string | 'all' | null
}) {
  const { data: devices = [], isLoading } = trpc.supplier.listPhysicalDevices.useQuery(
    { supplierId },
    { enabled: open && Boolean(supplierId), retry: 1 },
  )

  const filtered = useMemo(() => {
    if (!opsStatusFilter) return []
    return devices.filter((device) => {
      if (device.dataCenterId !== dataCenterId) return false
      if (opsStatusFilter === 'all') return true
      return deviceMatchesOpsStatus(device, opsStatusFilter)
    })
  }, [devices, dataCenterId, opsStatusFilter])

  const pagination = useListPagination(filtered, {
    resetDeps: [opsStatusFilter, dataCenterId],
  })

  const title =
    opsStatusFilter === 'all'
      ? '全部设备'
      : opsStatusFilter
        ? `「${opsStatusFilter}」设备`
        : '设备列表'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-6xl min-w-[40vw] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {dataCenterName} · 共 {filtered.length.toLocaleString()} 台，可跳转查看单机详情
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              加载设备列表…
            </div>
          ) : pagination.totalItems === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">暂无设备</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">SN / 资产号</TableHead>
                    <TableHead className="text-muted-foreground">卡型</TableHead>
                    <TableHead className="text-muted-foreground">生命周期</TableHead>
                    <TableHead className="text-muted-foreground">运营状态</TableHead>
                    <TableHead className="text-muted-foreground">IP 地址</TableHead>
                    <TableHead className="text-muted-foreground">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.items.map((device) => (
                    <TableRow key={device.id} className="border-border">
                      <TableCell>
                        <div className="font-mono text-sm text-foreground">{device.sn}</div>
                        <div className="text-xs text-muted-foreground">{device.assetNo}</div>
                      </TableCell>
                      <TableCell className="text-foreground">
                        {device.gpuCount} × {device.cardTypeName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={LIFECYCLE_STATUS_COLORS[device.lifecycleStatus] ?? ''}
                        >
                          {device.lifecycleStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {device.opsStatus ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {formatDeviceIp(device)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/supplier/devices/${device.id}`}>
                            详情
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {!isLoading && pagination.totalItems > 0 && (
          <div className="border-t border-border px-6 py-3">
            <ListPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
