'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Eye,
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
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import type { SupplierActivity, SupplierDevice } from '@/lib/types/supplier-domain'
import { LIFECYCLE_STATUS_COLORS } from '@/lib/supplier/onboarding-batch-utils'
import { useSupplierLabel } from '@/lib/supplier/supplier-domain-lookups'

export function PhysicalDevicesContent({ supplierIdFilter }: { supplierIdFilter?: string }) {
  const router = useRouter()
  const devices = useSupplierDomainMockStore((s) => s.devices)
  const upsertDevice = useSupplierDomainMockStore((s) => s.upsertDevice)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const upsertEntityStateTransitionLog = useSupplierDomainMockStore((s) => s.upsertEntityStateTransitionLog)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      if (supplierIdFilter && d.supplier_id !== supplierIdFilter) return false
      const q = search.trim().toLowerCase()
      const matchQ =
        !q ||
        d.sn.toLowerCase().includes(q) ||
        d.asset_no.toLowerCase().includes(q) ||
        d.idc_code.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || d.lifecycle_status === statusFilter
      return matchQ && matchStatus
    })
  }, [devices, search, statusFilter, supplierIdFilter])

  const stats = useMemo(() => {
    const base = supplierIdFilter ? devices.filter((d) => d.supplier_id === supplierIdFilter) : devices
    return {
      total: base.length,
      online: base.filter((d) => d.lifecycle_status === '在线').length,
      onboarding: base.filter((d) => d.lifecycle_status === '接入中').length,
    }
  }, [devices, supplierIdFilter])

  const markOnline = (device: SupplierDevice) => {
    if (device.lifecycle_status === '在线') {
      toast.info('设备已在线')
      return
    }
    const now = new Date().toISOString()
    const from = device.lifecycle_status
    upsertDevice({
      ...device,
      lifecycle_status: '在线',
      onboarding_substage: '已完成',
      platform_resource_id: device.platform_resource_id ?? `res-${device.sn.toLowerCase()}`,
    })
    upsertEntityStateTransitionLog({
      id: createId('esl'),
      entity_type: 'device',
      entity_id: device.id,
      from_state: from,
      to_state: '在线',
      operator_id: 'staff-mock-01',
      reason_code: 'ONBOARDING_DONE',
      occurred_at: now,
    })
    const activity: SupplierActivity = {
      id: createId('act'),
      supplier_id: device.supplier_id,
      type: 'device_online',
      title: `设备 ${device.sn} 已上线`,
      description: `机房 ${device.idc_code}`,
      author_name: '运营（mock）',
      author_role: 'ops',
      ref_domain: 'device',
      ref_id: device.id,
      occurred_at: now,
    }
    upsertSupplierActivity(activity)
    toast.success('已标记上线')
  }

  return (
    <div className="space-y-4">
      {!supplierIdFilter && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex gap-3">
              <Server className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-semibold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">物理机总数</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-green-500">{stats.online}</p>
              <p className="text-xs text-muted-foreground">在线</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-blue-500">{stats.onboarding}</p>
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
                  暂无物理机，请通过「设备上架」批次入库
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <PhysicalDeviceRow
                  key={d.id}
                  device={d}
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
  onView,
  onOnline,
}: {
  device: SupplierDevice
  onView: () => void
  onOnline: () => void
}) {
  const supplierName = useSupplierLabel(device.supplier_id)
  return (
    <TableRow>
      <TableCell>
        <div className="font-mono text-sm">{device.sn}</div>
        <div className="text-xs text-muted-foreground">{device.asset_no}</div>
      </TableCell>
      <TableCell>
        <Link href={`/supplier/suppliers/${device.supplier_id}`} className="text-primary hover:underline text-sm">
          {supplierName}
        </Link>
      </TableCell>
      <TableCell>{device.idc_code}</TableCell>
      <TableCell>{device.card_type}</TableCell>
      <TableCell>
        <Badge variant="outline" className={LIFECYCLE_STATUS_COLORS[device.lifecycle_status] ?? ''}>
          {device.lifecycle_status}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{device.onboarding_substage}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="w-4 h-4 mr-2" />
              详情
            </DropdownMenuItem>
            {device.lifecycle_status !== '在线' && (
              <DropdownMenuItem onClick={onOnline}>
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
