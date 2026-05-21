'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  MoreHorizontal,
  Search,
  Server,
} from 'lucide-react'
import { toast } from 'sonner'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import type { PhysicalDevice } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { LIFECYCLE_STATUS_COLORS } from '@/lib/supplier/onboarding-batch-utils'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '操作失败，请稍后重试'
}

export function PhysicalDevicesContent({ supplierIdFilter }: { supplierIdFilter?: string }) {
  const router = useRouter()
  const utils = trpc.useUtils()

  const {
    data: devices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = trpc.supplier.listPhysicalDevices.useQuery(
    { supplierId: supplierIdFilter },
    { retry: 1 },
  )

  const { data: stats } = trpc.supplier.getPhysicalDeviceStats.useQuery(
    { supplierId: supplierIdFilter },
    { retry: 1 },
  )

  const markOnlineMutation = trpc.supplier.markPhysicalDeviceOnline.useMutation({
    onSuccess: (device) => {
      toast.success(`设备 ${device.sn} 已标记上线`)
      void utils.supplier.listPhysicalDevices.invalidate()
      void utils.supplier.getPhysicalDeviceStats.invalidate()
    },
    onError: (err) => {
      const message = getErrorMessage(err)
      if (message.includes('已在线')) {
        toast.info(message)
      } else {
        toast.error(message)
      }
    },
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      const q = search.trim().toLowerCase()
      const matchQ =
        !q ||
        d.sn.toLowerCase().includes(q) ||
        d.assetNo.toLowerCase().includes(q) ||
        d.idcCode.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || d.lifecycleStatus === statusFilter
      return matchQ && matchStatus
    })
  }, [devices, search, statusFilter])

  const displayStats = stats ?? {
    total: devices.length,
    online: devices.filter((d) => d.lifecycleStatus === '在线').length,
    onboarding: devices.filter((d) => d.lifecycleStatus === '接入中').length,
  }

  const markOnline = (device: PhysicalDevice) => {
    if (device.lifecycleStatus === '在线') {
      toast.info('设备已在线')
      return
    }
    markOnlineMutation.mutate({ deviceId: device.id })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        加载物理机列表...
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
    <div className="space-y-4">
      {!supplierIdFilter && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex gap-3">
              <Server className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-semibold">{displayStats.total}</p>
                <p className="text-xs text-muted-foreground">物理机总数</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-green-500">{displayStats.online}</p>
              <p className="text-xs text-muted-foreground">在线</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-blue-500">{displayStats.onboarding}</p>
              <p className="text-xs text-muted-foreground">接入中</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="搜索 SN、资产号、机房..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="生命周期" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="接入中">接入中</SelectItem>
            <SelectItem value="在线">在线</SelectItem>
            <SelectItem value="维护中">维护中</SelectItem>
            <SelectItem value="离线">离线</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SN / 资产号</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead>机房</TableHead>
              <TableHead>卡型</TableHead>
              <TableHead>生命周期</TableHead>
              <TableHead>子阶段</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  暂无物理机，请通过「运维数据导入」入库
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <PhysicalDeviceRow
                  key={d.id}
                  device={d}
                  markingOnline={markOnlineMutation.isPending && markOnlineMutation.variables?.deviceId === d.id}
                  onView={() => router.push(`/supplier/devices/machines/${d.id}`)}
                  onOnline={() => markOnline(d)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function PhysicalDeviceRow({
  device,
  markingOnline,
  onView,
  onOnline,
}: {
  device: PhysicalDevice
  markingOnline: boolean
  onView: () => void
  onOnline: () => void
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-mono text-sm">{device.sn}</div>
        <div className="text-xs text-muted-foreground">{device.assetNo}</div>
      </TableCell>
      <TableCell>
        <Link
          href={`/supplier/suppliers/${device.supplierId}`}
          className="text-primary hover:underline text-sm"
        >
          {device.supplierShortName}
        </Link>
      </TableCell>
      <TableCell>{device.idcCode}</TableCell>
      <TableCell>{device.cardTypeName}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={LIFECYCLE_STATUS_COLORS[device.lifecycleStatus] ?? ''}
        >
          {device.lifecycleStatus}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{device.onboardingSubstage ?? '—'}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={markingOnline}>
              {markingOnline ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MoreHorizontal className="w-4 h-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="w-4 h-4 mr-2" />
              详情
            </DropdownMenuItem>
            {device.lifecycleStatus !== '在线' && (
              <DropdownMenuItem onClick={onOnline} disabled={markingOnline}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                确认上线
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
