'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, Loader2, MoreHorizontal, Plus, Search } from 'lucide-react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import type { FaultIncidentListItem } from '@/lib/types/fault-incident-api'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'

const severityColors: Record<string, string> = {
  P1: 'bg-red-500/20 text-red-400 border-red-500/30',
  P2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  P3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  P4: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const CLOSED_STATUSES = new Set(['已关闭', 'closed'])

function formatDt(value: Date | string | null) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  return d.toLocaleString('zh-CN')
}

function isOpen(incident: FaultIncidentListItem) {
  return !CLOSED_STATUSES.has(incident.incidentStatus)
}

function deviceRefLabel(incident: FaultIncidentListItem) {
  if (incident.deviceId) {
    if (incident.deviceAssetNo && incident.deviceSn) {
      return `${incident.deviceAssetNo} / ${incident.deviceSn}`
    }
    return incident.deviceSn ?? incident.deviceId
  }
  if (incident.computeNodeId) {
    return `节点 ${incident.computeNodeId.slice(0, 12)}`
  }
  return '—'
}

export function FaultIncidentsContent() {
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | '处理中' | '已关闭'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [closeTarget, setCloseTarget] = useState<FaultIncidentListItem | null>(null)
  const [resolution, setResolution] = useState('')

  const [form, setForm] = useState({
    supplierId: '',
    title: '',
    severity: 'P3' as 'P1' | 'P2' | 'P3' | 'P4',
    deviceId: '',
  })

  const listInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter,
    }),
    [search, statusFilter],
  )

  const { data, isLoading, isError } = trpc.supplier.faultIncident.list.useQuery(listInput)
  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, { enabled: createOpen })
  const { data: supplierDevices = [] } = trpc.supplier.listPhysicalDevices.useQuery(
    { supplierId: form.supplierId || undefined },
    { enabled: createOpen && !!form.supplierId },
  )

  const createMutation = trpc.supplier.faultIncident.create.useMutation({
    onSuccess: () => {
      toast.success('故障单已创建')
      setCreateOpen(false)
      setForm({ supplierId: '', title: '', severity: 'P3', deviceId: '' })
      void utils.supplier.faultIncident.list.invalidate()
      invalidateGlobalDashboard(utils)
    },
    onError: (error) => toast.error(error.message),
  })

  const closeMutation = trpc.supplier.faultIncident.close.useMutation({
    onSuccess: () => {
      toast.success('故障已关闭')
      setCloseTarget(null)
      setResolution('')
      void utils.supplier.faultIncident.list.invalidate()
      invalidateGlobalDashboard(utils)
    },
    onError: (error) => toast.error(error.message),
  })

  const incidents = data?.items ?? []

  const openCount = useMemo(() => incidents.filter(isOpen).length, [incidents])
  const highSeverityCount = useMemo(
    () => incidents.filter((f) => f.severity === 'P1' || f.severity === 'P2').length,
    [incidents],
  )
  const closedCount = useMemo(() => incidents.filter((f) => !isOpen(f)).length, [incidents])

  const handleCreate = () => {
    if (!form.supplierId || !form.title.trim()) {
      toast.error('请填写供应商与标题')
      return
    }
    createMutation.mutate({
      supplierId: form.supplierId,
      title: form.title.trim(),
      severity: form.severity,
      deviceId: form.deviceId || null,
    })
  }

  const handleClose = () => {
    if (!closeTarget) return
    closeMutation.mutate({
      incidentId: closeTarget.id,
      resolution: resolution.trim() || null,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">故障事件</h1>
          <p className="text-sm text-muted-foreground mt-1">
            登记与跟踪供应商侧物理机/节点故障
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/supplier/suppliers">故障记录表导入</Link>
          </Button>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            新建故障单
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-semibold">{openCount}</p>
              <p className="text-xs text-muted-foreground">处理中</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{highSeverityCount}</p>
            <p className="text-xs text-muted-foreground">P1/P2</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{closedCount}</p>
            <p className="text-xs text-muted-foreground">已关闭</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索标题、级别..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="处理中">处理中</SelectItem>
              <SelectItem value="已关闭">已关闭</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            加载中...
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-destructive">加载失败，请刷新重试</div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">暂无故障记录</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>供应商</TableHead>
                <TableHead>级别</TableHead>
                <TableHead>关联对象</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>开启时间</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((f) => (
                <FaultRow
                  key={f.id}
                  incident={f}
                  onClose={() => {
                    setCloseTarget(f)
                    setResolution('')
                  }}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建故障单</DialogTitle>
            <DialogDescription>关联供应商，可选物理机</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>供应商</Label>
              <Select
                value={form.supplierId}
                onValueChange={(v) => setForm((s) => ({ ...s, supplierId: v, deviceId: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>严重级别</Label>
              <Select
                value={form.severity}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, severity: v as typeof form.severity }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>物理机（可选）</Label>
              <Select
                value={form.deviceId || '_none'}
                onValueChange={(v) => setForm((s) => ({ ...s, deviceId: v === '_none' ? '' : v }))}
                disabled={!form.supplierId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="不关联" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不关联</SelectItem>
                  {supplierDevices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.sn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeTarget} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>关闭故障</DialogTitle>
            <DialogDescription>{closeTarget?.title}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="处理结果..."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>
              取消
            </Button>
            <Button onClick={handleClose} disabled={closeMutation.isPending}>
              {closeMutation.isPending ? '提交中...' : '确认关闭'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FaultRow({
  incident,
  onClose,
}: {
  incident: FaultIncidentListItem
  onClose: () => void
}) {
  const supplierName = incident.supplierShortName ?? incident.supplierName

  return (
    <TableRow>
      <TableCell className="font-medium">{incident.title}</TableCell>
      <TableCell>
        <Link
          href={`/supplier/suppliers/${incident.supplierId}`}
          className="text-primary hover:underline text-sm"
        >
          {supplierName}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={severityColors[incident.severity] ?? ''}>
          {incident.severity}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{deviceRefLabel(incident)}</TableCell>
      <TableCell>{incident.incidentStatus}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDt(incident.openedAt)}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOpen(incident) && (
              <DropdownMenuItem onClick={onClose}>关闭故障</DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/supplier/suppliers/${incident.supplierId}`}>
                供应商详情 <ChevronRight className="w-3 h-3 ml-1" />
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
