'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ChevronRight, MoreHorizontal, Plus, Search } from 'lucide-react'
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
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import type { FaultIncident, SupplierActivity } from '@/lib/types/supplier-domain'
import { useDeviceLabel, useSupplierLabel } from '@/lib/supplier/supplier-domain-lookups'

const severityColors: Record<string, string> = {
  P1: 'bg-red-500/20 text-red-400 border-red-500/30',
  P2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  P3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  P4: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

function formatDt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

export function FaultIncidentsContent() {
  const incidents = useSupplierDomainMockStore((s) => s.faultIncidents)
  const suppliers = useSupplierDomainMockStore((s) => s.suppliers)
  const devices = useSupplierDomainMockStore((s) => s.devices)
  const upsertFaultIncident = useSupplierDomainMockStore((s) => s.upsertFaultIncident)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [closeTarget, setCloseTarget] = useState<FaultIncident | null>(null)
  const [resolution, setResolution] = useState('')

  const [form, setForm] = useState({
    supplierId: '',
    title: '',
    severity: 'P3',
    deviceId: '',
    nodeId: '',
  })

  const filtered = useMemo(() => {
    return incidents.filter((f) => {
      const q = search.trim().toLowerCase()
      const matchQ = !q || f.title.toLowerCase().includes(q) || f.severity.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || f.incident_status === statusFilter
      return matchQ && matchStatus
    })
  }, [incidents, search, statusFilter])

  const supplierDevices = useMemo(
    () => devices.filter((d) => d.supplier_id === form.supplierId),
    [devices, form.supplierId],
  )

  const createIncident = () => {
    if (!form.supplierId || !form.title.trim()) {
      toast.error('请填写供应商与标题')
      return
    }
    const now = new Date().toISOString()
    const id = createId('fault')
    const row: FaultIncident = {
      id,
      supplier_id: form.supplierId,
      title: form.title.trim(),
      device_id: form.deviceId || null,
      compute_node_id: form.nodeId || null,
      severity: form.severity,
      incident_status: '处理中',
      resolution_outcome: '',
      opened_at: now,
      closed_at: null,
    }
    upsertFaultIncident(row)
    const activity: SupplierActivity = {
      id: createId('act'),
      supplier_id: form.supplierId,
      type: 'fault_opened',
      title: `故障 ${form.severity}：${form.title}`,
      description: null,
      author_name: '运营（mock）',
      author_role: 'ops',
      ref_domain: 'fault',
      ref_id: id,
      occurred_at: now,
    }
    upsertSupplierActivity(activity)
    toast.success('故障单已创建')
    setCreateOpen(false)
    setForm({ supplierId: '', title: '', severity: 'P3', deviceId: '', nodeId: '' })
  }

  const closeIncident = () => {
    if (!closeTarget) return
    const now = new Date().toISOString()
    upsertFaultIncident({
      ...closeTarget,
      incident_status: '已关闭',
      resolution_outcome: resolution.trim() || '已处理',
      closed_at: now,
    })
    upsertSupplierActivity({
      id: createId('act'),
      supplier_id: closeTarget.supplier_id,
      type: 'fault_closed',
      title: `故障已关闭：${closeTarget.title}`,
      description: resolution.trim() || null,
      author_name: '运营（mock）',
      author_role: 'ops',
      ref_domain: 'fault',
      ref_id: closeTarget.id,
      occurred_at: now,
    })
    toast.success('故障已关闭')
    setCloseTarget(null)
    setResolution('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">故障事件</h1>
          <p className="text-sm text-muted-foreground mt-1">
            登记与跟踪供应商侧物理机/节点故障（Mock，后续接 tRPC）
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          新建故障单
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex gap-3">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-semibold">{incidents.filter((f) => f.incident_status === '处理中').length}</p>
              <p className="text-xs text-muted-foreground">处理中</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{incidents.filter((f) => f.severity === 'P1' || f.severity === 'P2').length}</p>
            <p className="text-xs text-muted-foreground">P1/P2</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{incidents.filter((f) => f.incident_status === '已关闭').length}</p>
            <p className="text-xs text-muted-foreground">已关闭</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索标题、级别..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            {filtered.map((f) => (
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
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建故障单</DialogTitle>
            <DialogDescription>关联供应商，可选物理机或计算节点</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>供应商</Label>
              <Select value={form.supplierId} onValueChange={(v) => setForm((s) => ({ ...s, supplierId: v, deviceId: '', nodeId: '' }))}>
                <SelectTrigger><SelectValue placeholder="选择" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.short_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>标题</Label>
              <Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>严重级别</Label>
              <Select value={form.severity} onValueChange={(v) => setForm((s) => ({ ...s, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['P1', 'P2', 'P3', 'P4'].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>物理机（可选）</Label>
              <Select value={form.deviceId || '_none'} onValueChange={(v) => setForm((s) => ({ ...s, deviceId: v === '_none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="不关联" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">不关联</SelectItem>
                  {supplierDevices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.sn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={createIncident}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeTarget} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>关闭故障</DialogTitle>
            <DialogDescription>{closeTarget?.title}</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="处理结果..." value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>取消</Button>
            <Button onClick={closeIncident}>确认关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FaultRow({ incident, onClose }: { incident: FaultIncident; onClose: () => void }) {
  const supplierName = useSupplierLabel(incident.supplier_id)
  const deviceLabel = useDeviceLabel(incident.device_id ?? '')
  const refLabel = incident.device_id
    ? deviceLabel
    : incident.compute_node_id
      ? `节点 ${incident.compute_node_id.slice(0, 12)}`
      : '—'

  return (
    <TableRow>
      <TableCell className="font-medium">{incident.title}</TableCell>
      <TableCell>
        <Link href={`/supplier/suppliers/${incident.supplier_id}`} className="text-primary hover:underline text-sm">
          {supplierName}
        </Link>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={severityColors[incident.severity] ?? ''}>{incident.severity}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{refLabel}</TableCell>
      <TableCell>{incident.incident_status}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{formatDt(incident.opened_at)}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {incident.incident_status === '处理中' && (
              <DropdownMenuItem onClick={onClose}>关闭故障</DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/supplier/suppliers/${incident.supplier_id}`}>
                供应商详情 <ChevronRight className="w-3 h-3 ml-1" />
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
