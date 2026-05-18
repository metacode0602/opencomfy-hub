'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Cpu,
  Eye,
  Factory,
  FlaskConical,
  MoreHorizontal,
  Plus,
  Search,
  Server,
  Settings2,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@workspace/ui/components/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Label } from '@workspace/ui/components/label'
import { Progress } from '@workspace/ui/components/progress'
import { Switch } from '@workspace/ui/components/switch'
import { mockDataCenterDevices, mockSuppliers } from '@/lib/data/mock-data'
import type { ContractPricingMode, DataCenterDevice } from '@/lib/data/types'
import { contractPricingModeNames } from '@/lib/data/types'

type DeviceStatus = DataCenterDevice['status']

type DeviceRecord = DataCenterDevice & {
  supplierName: string
  cooperationMode: ContractPricingMode
}

const statusNames: Record<string, string> = {
  online: '在线',
  offline: '离线',
  maintenance: '维护中',
}

const deviceStatusColors: Record<DeviceStatus, string> = {
  online: 'bg-green-500/20 text-green-400 border-green-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
}

function buildDeviceRecords(): DeviceRecord[] {
  return mockDataCenterDevices.map((device) => {
    const supplier = mockSuppliers.find((s) => s.id === device.supplierId)
    return {
      ...device,
      supplierName: supplier?.name ?? device.supplierId,
      cooperationMode: supplier?.cooperationMode ?? 'card_time',
    }
  })
}

function unitCostLabel(device: DeviceRecord) {
  const cost = device.cardTimeCostPerHour ?? device.revenueShareCostPerHour ?? 0
  const mode = device.cooperationMode === 'card_time' ? '卡时成本' : '分成成本'
  return { cost, mode }
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusChangeDialog({
  open,
  onOpenChange,
  pendingStatus,
  setPendingStatus,
  onConfirm,
  deviceLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pendingStatus: DeviceStatus
  setPendingStatus: (s: DeviceStatus) => void
  onConfirm: () => void
  deviceLabel?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改设备状态</DialogTitle>
          <DialogDescription>
            {deviceLabel ? `正在修改：${deviceLabel}` : '选择新的运行状态'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>运行状态</Label>
            <Select
              value={pendingStatus}
              onValueChange={(v) => setPendingStatus(v as DeviceStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">在线</SelectItem>
                <SelectItem value="offline">离线</SelectItem>
                <SelectItem value="maintenance">维护中</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm}>确认修改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InternalTestDialog({
  open,
  onOpenChange,
  enabled,
  setEnabled,
  scope,
  setScope,
  until,
  setUntil,
  onConfirm,
  deviceLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  enabled: boolean
  setEnabled: (v: boolean) => void
  scope: string
  setScope: (v: string) => void
  until: string
  setUntil: (v: string) => void
  onConfirm: () => void
  deviceLabel?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>内部测试设置</DialogTitle>
          <DialogDescription>
            {deviceLabel
              ? `为「${deviceLabel}」配置内部测试占用，测试期间资源不对外售卖`
              : '配置内部测试占用范围与计划结束时间'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">划入内部测试</p>
              <p className="text-xs text-muted-foreground">开启后标记为测试资源池</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          {enabled && (
            <>
              <div className="grid gap-2">
                <Label>占用范围</Label>
                <Input
                  placeholder="如：全部、GPU0-GPU3"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>计划结束时间</Label>
                <Input
                  type="datetime-local"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm}>保存设置</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DevicesContent() {
  const [devices, setDevices] = useState<DeviceRecord[]>(buildDeviceRecords)
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [internalTestFilter, setInternalTestFilter] = useState('all')

  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [internalTestDialogOpen, setInternalTestDialogOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<DeviceStatus>('online')
  const [internalTestEnabled, setInternalTestEnabled] = useState(false)
  const [internalTestScope, setInternalTestScope] = useState('')
  const [internalTestUntil, setInternalTestUntil] = useState('')

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId],
  )

  const filteredDevices = devices.filter((device) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      device.dataCenterName.toLowerCase().includes(q) ||
      device.cardTypeName.toLowerCase().includes(q) ||
      device.supplierName.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter
    const matchesSupplier = supplierFilter === 'all' || device.supplierId === supplierFilter
    const matchesInternalTest =
      internalTestFilter === 'all' ||
      (internalTestFilter === 'yes' && device.isInternalTest) ||
      (internalTestFilter === 'no' && !device.isInternalTest)
    return matchesSearch && matchesStatus && matchesSupplier && matchesInternalTest
  })

  const stats = useMemo(() => {
    const totalQuantity = devices.reduce((sum, d) => sum + d.quantity, 0)
    const totalOnline = devices.reduce((sum, d) => sum + d.onlineQuantity, 0)
    return {
      total: devices.length,
      maintenance: devices.filter((d) => d.status === 'maintenance').length,
      internalTest: devices.filter((d) => d.isInternalTest).length,
      totalQuantity,
      totalOnline,
    }
  }, [devices])

  const updateDevice = (id: string, patch: Partial<DeviceRecord>) => {
    setDevices((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d,
      ),
    )
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
    setView('detail')
  }

  const backToList = () => {
    setView('list')
    setSelectedId(null)
  }

  const openStatusDialog = (device: DeviceRecord) => {
    setSelectedId(device.id)
    setPendingStatus(device.status)
    setStatusDialogOpen(true)
  }

  const openInternalTestDialog = (device: DeviceRecord) => {
    setSelectedId(device.id)
    setInternalTestEnabled(Boolean(device.isInternalTest))
    setInternalTestScope(device.internalTestScope ?? '')
    setInternalTestUntil(device.internalTestUntil?.slice(0, 16) ?? '')
    setInternalTestDialogOpen(true)
  }

  const confirmStatusChange = () => {
    if (!selectedId) return
    updateDevice(selectedId, { status: pendingStatus })
    setStatusDialogOpen(false)
  }

  const confirmInternalTest = () => {
    if (!selectedId) return
    updateDevice(selectedId, {
      isInternalTest: internalTestEnabled,
      internalTestScope: internalTestEnabled ? internalTestScope || '全部' : undefined,
      internalTestUntil:
        internalTestEnabled && internalTestUntil
          ? new Date(internalTestUntil).toISOString()
          : null,
    })
    setInternalTestDialogOpen(false)
  }

  const deviceLabel = selectedDevice
    ? `${selectedDevice.dataCenterName} · ${selectedDevice.cardTypeName}`
    : undefined

  const dialogProps = {
    statusDialogOpen,
    internalTestDialogOpen,
    pendingStatus,
    setPendingStatus,
    internalTestEnabled,
    setInternalTestEnabled,
    internalTestScope,
    setInternalTestScope,
    internalTestUntil,
    setInternalTestUntil,
    onConfirmStatus: confirmStatusChange,
    onConfirmInternalTest: confirmInternalTest,
    onCloseStatusDialog: setStatusDialogOpen,
    onCloseInternalTestDialog: setInternalTestDialogOpen,
    deviceLabel,
  }

  if (view === 'detail' && selectedDevice) {
    const onlineRate =
      selectedDevice.quantity > 0
        ? (selectedDevice.onlineQuantity / selectedDevice.quantity) * 100
        : 0
    const { cost, mode } = unitCostLabel(selectedDevice)

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" className="mt-1" onClick={backToList}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-foreground">{selectedDevice.cardTypeName}</h1>
                <Badge variant="outline" className={deviceStatusColors[selectedDevice.status]}>
                  {statusNames[selectedDevice.status]}
                </Badge>
                {selectedDevice.isInternalTest && (
                  <Badge
                    variant="outline"
                    className="bg-purple-500/10 text-purple-400 border-purple-500/30"
                  >
                    <FlaskConical className="w-3 h-3 mr-1" />
                    内部测试中
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {selectedDevice.dataCenterName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openStatusDialog(selectedDevice)}>
              <Settings2 className="w-4 h-4 mr-2" />
              修改状态
            </Button>
            <Button variant="outline" onClick={() => openInternalTestDialog(selectedDevice)}>
              <FlaskConical className="w-4 h-4 mr-2" />
              内部测试
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">设备数量</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{selectedDevice.quantity}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">在线数量</p>
              <p className="text-2xl font-semibold text-foreground mt-1">
                {selectedDevice.onlineQuantity}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">在线率</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{onlineRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{mode}</p>
              <p className="text-2xl font-semibold text-foreground mt-1">¥{cost.toFixed(0)}/小时</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
              <CardDescription>设备资源组标识与归属</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">资源 ID</span>
                <code className="text-foreground">{selectedDevice.id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">供应商</span>
                <Link
                  href={`/supplier/suppliers/${selectedDevice.supplierId}`}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Factory className="w-3.5 h-3.5" />
                  {selectedDevice.supplierName}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">合作模式</span>
                <Badge variant="outline">{contractPricingModeNames[selectedDevice.cooperationMode]}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">机房 ID</span>
                <span className="text-foreground">{selectedDevice.dataCenterId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">卡型 ID</span>
                <span className="text-foreground">{selectedDevice.cardTypeId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">最近更新</span>
                <span className="text-foreground">{formatDateTime(selectedDevice.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-base">运行与测试</CardTitle>
              <CardDescription>在线率与内部测试占用配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">在线率</span>
                  <span className="text-foreground font-medium">
                    {selectedDevice.onlineQuantity}/{selectedDevice.quantity}
                  </span>
                </div>
                <Progress value={onlineRate} className="h-2" />
              </div>
              <div className="pt-4 border-t border-border space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">内部测试</span>
                  <span className="text-foreground">
                    {selectedDevice.isInternalTest ? '已开启' : '未开启'}
                  </span>
                </div>
                {selectedDevice.isInternalTest && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">占用范围</span>
                      <span className="text-foreground">
                        {selectedDevice.internalTestScope ?? '全部'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">计划结束</span>
                      <span className="text-foreground">
                        {formatDateTime(selectedDevice.internalTestUntil)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <StatusChangeDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          pendingStatus={pendingStatus}
          setPendingStatus={setPendingStatus}
          onConfirm={confirmStatusChange}
          deviceLabel={deviceLabel}
        />
        <InternalTestDialog
          open={internalTestDialogOpen}
          onOpenChange={setInternalTestDialogOpen}
          enabled={internalTestEnabled}
          setEnabled={setInternalTestEnabled}
          scope={internalTestScope}
          setScope={setInternalTestScope}
          until={internalTestUntil}
          setUntil={setInternalTestUntil}
          onConfirm={confirmInternalTest}
          deviceLabel={deviceLabel}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">设备管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理各机房 GPU 设备资源、运行状态与内部测试占用
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          新增设备
        </Button>
      </div>

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
                <p className="text-2xl font-semibold text-foreground">
                  {stats.totalOnline.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">在线数量</p>
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
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="供应商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部供应商</SelectItem>
                {mockSuppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">供应商</TableHead>
              <TableHead className="text-muted-foreground">机房</TableHead>
              <TableHead className="text-muted-foreground">卡型</TableHead>
              <TableHead className="text-muted-foreground">数量</TableHead>
              <TableHead className="text-muted-foreground">在线</TableHead>
              <TableHead className="text-muted-foreground">在线率</TableHead>
              <TableHead className="text-muted-foreground">成本</TableHead>
              <TableHead className="text-muted-foreground">状态</TableHead>
              <TableHead className="text-muted-foreground">内部测试</TableHead>
              <TableHead className="text-muted-foreground w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDevices.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                  暂无匹配的设备记录
                </TableCell>
              </TableRow>
            ) : (
              filteredDevices.map((device) => {
                const onlineRate =
                  device.quantity > 0 ? (device.onlineQuantity / device.quantity) * 100 : 0
                const { cost } = unitCostLabel(device)
                return (
                  <TableRow
                    key={device.id}
                    className="border-border cursor-pointer"
                    onClick={() => openDetail(device.id)}
                  >
                    <TableCell>
                      <Link
                        href={`/supplier/suppliers/${device.supplierId}`}
                        className="text-sm text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {device.supplierName}
                      </Link>
                    </TableCell>
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
                      ¥{cost.toFixed(0)}/小时
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/supplier/devices/${device.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openStatusDialog(device)}>
                            <Settings2 className="w-4 h-4 mr-2" />
                            修改状态
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openInternalTestDialog(device)}>
                            <FlaskConical className="w-4 h-4 mr-2" />
                            内部测试设置
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <StatusChangeDialog
        open={dialogProps.statusDialogOpen}
        onOpenChange={dialogProps.onCloseStatusDialog}
        pendingStatus={dialogProps.pendingStatus}
        setPendingStatus={dialogProps.setPendingStatus}
        onConfirm={dialogProps.onConfirmStatus}
        deviceLabel={dialogProps.deviceLabel}
      />
      <InternalTestDialog
        open={dialogProps.internalTestDialogOpen}
        onOpenChange={dialogProps.onCloseInternalTestDialog}
        enabled={dialogProps.internalTestEnabled}
        setEnabled={dialogProps.setInternalTestEnabled}
        scope={dialogProps.internalTestScope}
        setScope={dialogProps.setInternalTestScope}
        until={dialogProps.internalTestUntil}
        setUntil={dialogProps.setInternalTestUntil}
        onConfirm={dialogProps.onConfirmInternalTest}
        deviceLabel={dialogProps.deviceLabel}
      />
    </div>
  )
}
