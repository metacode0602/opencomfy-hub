'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  MapPin,
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
import type { DataCenter } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { dcStatusColors, statusNames } from '@/components/dashboard/supplier-detail-constants'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '加载失败，请稍后重试'
}

function formatLocation(dc: DataCenter): string {
  return dc.address || dc.location || '—'
}

export function DatacentersContent({ supplierIdFilter }: { supplierIdFilter?: string }) {
  const {
    data: dataCenters = [],
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.supplier.listAllDataCenters.useQuery(
    { supplierId: supplierIdFilter },
    { retry: 1 },
  )

  const { data: stats } = trpc.supplier.getDataCenterStats.useQuery(
    { supplierId: supplierIdFilter },
    { retry: 1 },
  )

  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, {
    enabled: !supplierIdFilter,
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')

  const locationOptions = useMemo(() => {
    const locations = new Set<string>()
    for (const dc of dataCenters) {
      if (dc.location) locations.add(dc.location)
    }
    return [...locations].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  }, [dataCenters])

  const filtered = useMemo(() => {
    return dataCenters.filter((dc) => {
      const q = searchTerm.trim().toLowerCase()
      const matchQ =
        !q ||
        dc.name.toLowerCase().includes(q) ||
        dc.code.toLowerCase().includes(q) ||
        dc.supplierName.toLowerCase().includes(q) ||
        (dc.address?.toLowerCase().includes(q) ?? false) ||
        (dc.location?.toLowerCase().includes(q) ?? false)
      const matchStatus = statusFilter === 'all' || dc.status === statusFilter
      const matchSupplier =
        supplierIdFilter != null ||
        supplierFilter === 'all' ||
        dc.supplierId === supplierFilter
      const matchLocation = locationFilter === 'all' || dc.location === locationFilter
      return matchQ && matchStatus && matchSupplier && matchLocation
    })
  }, [dataCenters, searchTerm, statusFilter, supplierFilter, locationFilter, supplierIdFilter])

  const pagination = useListPagination(filtered, {
    resetDeps: [searchTerm, statusFilter, supplierFilter, locationFilter],
  })

  const displayStats = stats ?? {
    total: dataCenters.length,
    online: dataCenters.filter((dc) => dc.status === 'online').length,
    offline: dataCenters.filter((dc) => dc.status === 'offline').length,
    maintenance: dataCenters.filter((dc) => dc.status === 'maintenance').length,
    totalGpu: dataCenters.reduce((sum, dc) => sum + dc.totalDeviceCount, 0),
    onlineGpu: dataCenters.reduce((sum, dc) => sum + dc.onlineDeviceCount, 0),
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        加载机房列表...
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
      {!supplierIdFilter && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{displayStats.total}</p>
                  <p className="text-xs text-muted-foreground">机房总数</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">{displayStats.online}</p>
                  <p className="text-xs text-muted-foreground">在线机房</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                  <Settings2 className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {displayStats.maintenance}
                  </p>
                  <p className="text-xs text-muted-foreground">维护中</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <Server className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">
                    {displayStats.onlineGpu.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{displayStats.totalGpu.toLocaleString()}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">在线 GPU</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索机房名称、编码、地址、供应商..."
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
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="区域" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部区域</SelectItem>
                {locationOptions.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-x-auto border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {!supplierIdFilter && (
                <TableHead className="text-muted-foreground">供应商</TableHead>
              )}
              <TableHead className="text-muted-foreground">机房</TableHead>
              <TableHead className="text-muted-foreground">编码</TableHead>
              <TableHead className="text-muted-foreground">位置</TableHead>
              <TableHead className="text-muted-foreground">状态</TableHead>
              <TableHead className="text-muted-foreground">GPU 在线率</TableHead>
              <TableHead className="text-muted-foreground">网络费 (月)</TableHead>
              <TableHead className="text-muted-foreground">管控费 (月)</TableHead>
              <TableHead className="text-muted-foreground">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.totalItems === 0 ? (
              <TableRow className="border-border">
                <TableCell
                  colSpan={supplierIdFilter ? 8 : 9}
                  className="py-12 text-center text-muted-foreground"
                >
                  {dataCenters.length === 0
                    ? '暂无机房数据，可通过供应商详情页「导入机房」批量新增'
                    : '暂无匹配的机房记录'}
                </TableCell>
              </TableRow>
            ) : (
              pagination.items.map((dc) => {
                const onlineRate =
                  dc.totalDeviceCount > 0
                    ? (dc.onlineDeviceCount / dc.totalDeviceCount) * 100
                    : 0
                return (
                  <TableRow key={dc.id} className="border-border">
                    {!supplierIdFilter && (
                      <TableCell>
                        <Link
                          href={`/supplier/suppliers/${dc.supplierId}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {dc.supplierName}
                        </Link>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="font-medium text-foreground">{dc.name}</div>
                      {dc.sourceDeleted && (
                        <Badge
                          variant="outline"
                          className="mt-1 border-amber-500/30 bg-amber-500/10 text-amber-400"
                        >
                          源已删除
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-0.5 text-sm text-foreground">
                        {dc.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-foreground">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="max-w-[180px] truncate">{formatLocation(dc)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={dcStatusColors[dc.status]}>
                        {statusNames[dc.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={onlineRate} className="h-2 w-16" />
                        <span className="text-sm text-foreground">
                          {dc.onlineDeviceCount}/{dc.totalDeviceCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      ¥{dc.networkFee.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-foreground">
                      ¥{dc.managementNodeFee.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/supplier/datacenters/${dc.id}`}>
                          <Eye className="mr-1 h-3 w-3" />
                          详情
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {pagination.totalItems > 0 && (
          <ListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        )}
      </Card>
    </div>
  )
}
