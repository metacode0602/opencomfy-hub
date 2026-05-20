'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FlaskConical, MoreHorizontal, Plus, Search } from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import type { InternalTestHold, SupplierActivity } from '@/lib/types/supplier-domain'
import { useDeviceLabel, useSupplierLabel } from '@/lib/supplier/supplier-domain-lookups'

function formatDt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

function isActive(hold: InternalTestHold) {
  const now = Date.now()
  const from = new Date(hold.hold_from).getTime()
  const until = hold.hold_until ? new Date(hold.hold_until).getTime() : null
  if (now < from) return false
  if (until != null && now > until) return false
  return true
}

export function TestHoldsContent() {
  const holds = useSupplierDomainMockStore((s) => s.internalTestHolds)
  const suppliers = useSupplierDomainMockStore((s) => s.suppliers)
  const devices = useSupplierDomainMockStore((s) => s.devices)
  const upsertInternalTestHold = useSupplierDomainMockStore((s) => s.upsertInternalTestHold)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    supplierId: '',
    deviceId: '',
    scope: 'GPU0-GPU3',
    holdFrom: '',
    holdUntil: '',
    remark: '',
  })

  const filtered = useMemo(() => {
    return holds.filter((h) => {
      const q = search.trim().toLowerCase()
      const matchQ = !q || h.scope.toLowerCase().includes(q)
      const matchActive = activeOnly === 'all' || (activeOnly === 'yes' ? isActive(h) : !isActive(h))
      return matchQ && matchActive
    })
  }, [holds, search, activeOnly])

  const supplierDevices = useMemo(
    () => devices.filter((d) => d.supplier_id === form.supplierId),
    [devices, form.supplierId],
  )

  const activeCount = holds.filter(isActive).length

  const createHold = () => {
    if (!form.supplierId || !form.deviceId || !form.scope.trim() || !form.holdFrom) {
      toast.error('请填写供应商、设备、占用范围与开始时间')
      return
    }
    const now = new Date().toISOString()
    const id = createId('hold')
    const row: InternalTestHold = {
      id,
      supplier_id: form.supplierId,
      device_id: form.deviceId,
      compute_node_id: null,
      scope: form.scope.trim(),
      hold_from: new Date(form.holdFrom).toISOString(),
      hold_until: form.holdUntil ? new Date(form.holdUntil).toISOString() : null,
      remark: form.remark.trim() || undefined,
    }
    upsertInternalTestHold(row)
    upsertSupplierActivity({
      id: createId('act'),
      supplier_id: form.supplierId,
      type: 'internal_test_hold',
      title: `内部测试占用 ${form.scope}`,
      description: form.remark.trim() || null,
      author_name: '运营（mock）',
      author_role: 'ops',
      ref_domain: 'device',
      ref_id: form.deviceId,
      occurred_at: now,
    })
    toast.success('测试占用已登记')
    setCreateOpen(false)
    setForm({ supplierId: '', deviceId: '', scope: 'GPU0-GPU3', holdFrom: '', holdUntil: '', remark: '' })
  }

  const endHold = (hold: InternalTestHold) => {
    upsertInternalTestHold({
      ...hold,
      hold_until: new Date().toISOString(),
    })
    toast.success('已结束占用')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">测试占用</h1>
          <p className="text-sm text-muted-foreground mt-1">
            内部测试 GPU 占用台账，影响可售量计算（Mock）
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          登记占用
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex gap-3">
            <FlaskConical className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-2xl font-semibold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">进行中占用</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{holds.length}</p>
            <p className="text-xs text-muted-foreground">历史记录总数</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="搜索占用范围..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={activeOnly} onValueChange={setActiveOnly}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="yes">进行中</SelectItem>
              <SelectItem value="no">已结束</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>供应商</TableHead>
              <TableHead>设备</TableHead>
              <TableHead>占用范围</TableHead>
              <TableHead>时段</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((h) => (
              <HoldRow key={h.id} hold={h} onEnd={() => endHold(h)} />
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>登记内部测试占用</DialogTitle>
            <DialogDescription>精确到物理机与 GPU 范围</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>供应商</Label>
              <Select value={form.supplierId} onValueChange={(v) => setForm((s) => ({ ...s, supplierId: v, deviceId: '' }))}>
                <SelectTrigger><SelectValue placeholder="选择" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.short_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>物理机</Label>
              <Select value={form.deviceId} onValueChange={(v) => setForm((s) => ({ ...s, deviceId: v }))} disabled={!form.supplierId}>
                <SelectTrigger><SelectValue placeholder="选择 SN" /></SelectTrigger>
                <SelectContent>
                  {supplierDevices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.sn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>占用范围</Label>
              <Input value={form.scope} onChange={(e) => setForm((s) => ({ ...s, scope: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input type="datetime-local" value={form.holdFrom} onChange={(e) => setForm((s) => ({ ...s, holdFrom: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>计划结束（可选）</Label>
                <Input type="datetime-local" value={form.holdUntil} onChange={(e) => setForm((s) => ({ ...s, holdUntil: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Input value={form.remark} onChange={(e) => setForm((s) => ({ ...s, remark: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={createHold}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HoldRow({ hold, onEnd }: { hold: InternalTestHold; onEnd: () => void }) {
  const supplierName = useSupplierLabel(hold.supplier_id)
  const deviceLabel = useDeviceLabel(hold.device_id ?? '')
  const active = isActive(hold)

  return (
    <TableRow>
      <TableCell>
        <Link href={`/supplier/suppliers/${hold.supplier_id}`} className="text-primary hover:underline text-sm">
          {supplierName}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-xs">{deviceLabel}</TableCell>
      <TableCell>{hold.scope}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDt(hold.hold_from)} — {formatDt(hold.hold_until)}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={active ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : ''}>
          {active ? '进行中' : '已结束'}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {active && <DropdownMenuItem onClick={onEnd}>结束占用</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
