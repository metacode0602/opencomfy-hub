'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FlaskConical,
  Loader2,
  Search,
  Server,
  Settings2,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Progress } from '@workspace/ui/components/progress'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { ListPagination } from '@/components/shared/list-pagination'
import { useListPagination } from '@/hooks/use-list-pagination'
import type { DataCenterDevice } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'

const statusNames: Record<DataCenterDevice['status'], string> = {
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
}

const deviceStatusColors: Record<DataCenterDevice['status'], string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '加载失败，请稍后重试'
}

export function AggregateInventoryContent({ supplierIdFilter }: { supplierIdFilter?: string }) {
  const {
    data: devices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.supplier.listGpuInventory.useQuery(
    { supplierId: supplierIdFilter },
    { retry: 1 },
  )

  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, {
    enabled: !supplierIdFilter,
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [internalTestFilter, setInternalTestFilter] = useState('all')

  const filtered = useMemo(() => {
    return devices.filter((device) => {
      const q = searchTerm.trim().toLowerCase()
      const supplierLabel = device.supplierShortName ?? device.supplierId
      const matchQ =
        !q ||
        device.dataCenterName.toLowerCase().includes(q) ||
        device.cardTypeName.toLowerCase().includes(q) ||
        supplierLabel.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || device.status === statusFilter
      const matchSupplier =
        supplierIdFilter != null ||
        supplierFilter === 'all' ||
        device.supplierId === supplierFilter
      const matchInternalTest =
        internalTestFilter === 'all' ||
        (internalTestFilter === 'yes' && device.isInternalTest) ||
        (internalTestFilter === 'no' && !device.isInternalTest)
      return matchQ && matchStatus && matchSupplier && matchInternalTest
    })
  }, [devices, searchTerm, statusFilter, supplierFilter, internalTestFilter, supplierIdFilter])

  const pagination = useListPagination(filtered, {
    resetDeps: [searchTerm, statusFilter, supplierFilter, internalTestFilter],
  })

  const stats = useMemo(() => {
    const totalQuantity = devices.reduce((sum, d) => sum + d.quantity, 0)
    const totalOnline = devices.reduce((sum, d) => sum + d.onlineQuantity, 0)
    return {
      maintenance: devices.filter((d) => d.status === 'maintenance').length,
      internalTest: devices.filter((d) => d.isInternalTest).length,
      totalQuantity,
      totalOnline,
    }
  }, [devices])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载聚合库存...
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex flex-wrap items-center gap-3">
          <span>{getErrorMessage(error)}</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            重试
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {stats.totalQuantity.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">GPU 总量</p>
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
                <p className="text-2xl font-semibold text-foreground">
                  {stats.totalOnline.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">在线 GPU</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.maintenance}</p>
                <p className="text-xs text-muted-foreground">维护中资源组</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.internalTest}</p>
                <p className="text-xs text-muted-foreground">内部测试中</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索机房、卡型、供应商..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="online">在线</SelectItem>
                <SelectItem value="offline">离线</SelectItem>
                <SelectItem value="maintenance">维护中</SelectItem>
              </SelectContent>
            </Select>
            {!supplierIdFilter && (
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="供应商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部供应商</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={internalTestFilter} onValueChange={setInternalTestFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="内部测试" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="yes">测试中</SelectItem>
                <SelectItem value="no">非测试</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {!supplierIdFilter && <TableHead className="text-muted-foreground">供应商</TableHead>}
              <TableHead className="text-muted-foreground">机房</TableHead>
              <TableHead className="text-muted-foreground">卡型</TableHead>
              <TableHead className="text-muted-foreground">数量</TableHead>
              <TableHead className="text-muted-foreground">在线</TableHead>
              <TableHead className="text-muted-foreground">在线率</TableHead>
              <TableHead className="text-muted-foreground">成本</TableHead>
              <TableHead className="text-muted-foreground">状态</TableHead>
              <TableHead className="text-muted-foreground">内部测试</TableHead>
              <TableHead className="text-muted-foreground">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.totalItems === 0 ? (
              <TableRow className="border-border">
                <TableCell
                  colSpan={supplierIdFilter ? 8 : 9}
                  className="text-center text-muted-foreground py-12"
                >
                  {devices.length === 0
                    ? '暂无聚合库存，请通过「运维数据导入」入库设备后自动汇总'
                    : '暂无匹配的设备记录'}
                </TableCell>
              </TableRow>
            ) : (
              pagination.items.map((device) => {
                const onlineRate =
                  device.quantity > 0 ? (device.onlineQuantity / device.quantity) * 100 : 0
                const cost = device.cardTimeCostPerHour ?? device.revenueShareCostPerHour ?? 0
                return (
                  <TableRow key={device.id} className="border-border">
                    {!supplierIdFilter && (
                      <TableCell>
                        <Link
                          href={`/supplier/suppliers/${device.supplierId}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {device.supplierShortName ?? device.supplierId}
                        </Link>
                      </TableCell>
                    )}
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
                      {cost > 0 ? `¥${cost.toFixed(0)}/小时` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={deviceStatusColors[device.status]}>
                        {statusNames[device.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {device.isInternalTest ? (
                        <Badge
                          variant="outline"
                          className="bg-purple-500/10 text-purple-400 border-purple-500/30"
                        >
                          测试中
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/supplier/inventory/${device.id}`}>
                          详情
                        <ChevronRight className="w-3 h-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <ListPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          onPageChange={pagination.setPage}
        />
      </Card>
    </div>
  )
}
