'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, FlaskConical, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
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
import {
  INTERNAL_TEST_HOLD_DEPARTMENT_LABELS,
  INTERNAL_TEST_HOLD_SETTLEMENT_LABELS,
  type InternalTestHold,
  type InternalTestHoldDepartment,
  type InternalTestHoldSettlement,
} from '@/lib/types/supplier-domain'
import { useDataCenterLabel, useSupplierLabel } from '@/lib/supplier/supplier-domain-lookups'
import { TestHoldDeviceEntryDialog } from './test-hold-device-entry-dialog'

const DEPARTMENT_OPTIONS: { value: InternalTestHoldDepartment; label: string }[] = [
  { value: 'product', label: '产品' },
  { value: 'rd', label: '研发' },
  { value: 'test', label: '测试' },
]

const SETTLEMENT_OPTIONS: { value: InternalTestHoldSettlement; label: string }[] = [
  { value: 'whole_rent', label: '整租' },
  { value: 'idle_time', label: '闲时' },
]

const MOCK_CARD_TYPES = ['A100-80G', 'H800', 'L40S', '4090', 'A10'] as const

type CardTypeRow = {
  key: string
  cardType: string
  unitCount: string
}

function emptyCardRow(): CardTypeRow {
  return {
    key: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    cardType: '',
    unitCount: '',
  }
}

const EMPTY_FORM = {
  supplierId: '',
  dataCenterId: '',
  userName: '',
  department: '' as InternalTestHoldDepartment | '',
  settlementMode: '' as InternalTestHoldSettlement | '',
  holdFrom: '',
  holdUntil: '',
  remark: '',
}

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
  const dataCenters = useSupplierDomainMockStore((s) => s.dataCenters)
  const upsertInternalTestHold = useSupplierDomainMockStore((s) => s.upsertInternalTestHold)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [cardRows, setCardRows] = useState<CardTypeRow[]>([emptyCardRow()])

  useEffect(() => {
    if (createOpen) setCardRows([emptyCardRow()])
  }, [createOpen])

  const filtered = useMemo(() => {
    return holds.filter((h) => {
      const q = search.trim().toLowerCase()
      const matchQ =
        !q ||
        h.user_name.toLowerCase().includes(q) ||
        h.card_type.toLowerCase().includes(q) ||
        INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[h.department].includes(q) ||
        INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[h.settlement_mode].includes(q)
      const matchActive = activeOnly === 'all' || (activeOnly === 'yes' ? isActive(h) : !isActive(h))
      return matchQ && matchActive
    })
  }, [holds, search, activeOnly])

  const supplierDataCenters = useMemo(
    () => dataCenters.filter((dc) => dc.supplier_id === form.supplierId),
    [dataCenters, form.supplierId],
  )

  const activeCount = holds.filter(isActive).length

  const updateCardRow = (key: string, patch: Partial<CardTypeRow>) => {
    setCardRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addCardRow = () => setCardRows((prev) => [...prev, emptyCardRow()])

  const removeCardRow = (key: string) => {
    setCardRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  const isBlankCardRow = (row: CardTypeRow) => !row.cardType.trim() && !row.unitCount.trim()

  const createHold = () => {
    if (
      !form.supplierId ||
      !form.dataCenterId ||
      !form.userName.trim() ||
      !form.department ||
      !form.settlementMode ||
      !form.holdFrom
    ) {
      toast.error('请填写供应商、机房、使用者、使用部门、结算方式与开始时间')
      return
    }

    const parsedRows: { cardType: string; unitCount: number }[] = []
    for (const row of cardRows) {
      if (isBlankCardRow(row)) continue
      const cardType = row.cardType.trim()
      const unitCount = Number.parseInt(row.unitCount, 10)
      if (!cardType || !Number.isFinite(unitCount) || unitCount <= 0) {
        toast.error('请为每一行填写有效的卡型与台数')
        return
      }
      parsedRows.push({ cardType, unitCount })
    }
    if (parsedRows.length === 0) {
      toast.error('请至少添加一行卡型与台数')
      return
    }

    const now = new Date().toISOString()
    const holdFrom = new Date(form.holdFrom).toISOString()
    const holdUntil = form.holdUntil ? new Date(form.holdUntil).toISOString() : null
    const remark = form.remark.trim() || undefined

    for (const { cardType, unitCount } of parsedRows) {
      upsertInternalTestHold({
        id: createId('hold'),
        supplier_id: form.supplierId,
        data_center_id: form.dataCenterId,
        user_name: form.userName.trim(),
        department: form.department,
        card_type: cardType,
        unit_count: unitCount,
        settlement_mode: form.settlementMode,
        hold_from: holdFrom,
        hold_until: holdUntil,
        remark,
      })
    }

    const cardSummary = parsedRows.map((r) => `${r.cardType} × ${r.unitCount}台`).join('、')
    upsertSupplierActivity({
      id: createId('act'),
      supplier_id: form.supplierId,
      type: 'internal_test_hold',
      title:
        parsedRows.length === 1
          ? `内部测试占用 ${cardSummary}`
          : `内部测试占用 ${parsedRows.length} 种卡型`,
      description: `${cardSummary} · ${form.userName.trim()} · ${INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[form.department]} · ${INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[form.settlementMode]}${remark ? ` · ${remark}` : ''}`,
      author_name: '运营（mock）',
      author_role: 'ops',
      ref_domain: 'data_center',
      ref_id: form.dataCenterId,
      occurred_at: now,
    })

    toast.success(
      parsedRows.length === 1 ? '测试占用已登记' : `已登记 ${parsedRows.length} 条测试占用`,
    )
    setCreateOpen(false)
    setForm(EMPTY_FORM)
    setCardRows([emptyCardRow()])
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
            <Input
              className="pl-9"
              placeholder="搜索使用者、卡型、部门..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
              <TableHead>机房</TableHead>
              <TableHead>使用者</TableHead>
              <TableHead>使用部门</TableHead>
              <TableHead>卡型</TableHead>
              <TableHead>台数</TableHead>
              <TableHead>结算方式</TableHead>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>登记内部测试占用</DialogTitle>
            <DialogDescription>按机房登记内部测试资源占用，可一次添加多种卡型与台数</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>供应商</Label>
              <Select
                value={form.supplierId}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, supplierId: v, dataCenterId: '' }))
                }
              >
                <SelectTrigger><SelectValue placeholder="选择" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.short_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>机房</Label>
              <Select
                value={form.dataCenterId}
                onValueChange={(v) => setForm((s) => ({ ...s, dataCenterId: v }))}
                disabled={!form.supplierId}
              >
                <SelectTrigger><SelectValue placeholder={form.supplierId ? '选择机房' : '请先选择供应商'} /></SelectTrigger>
                <SelectContent>
                  {supplierDataCenters.map((dc) => (
                    <SelectItem key={dc.id} value={dc.id}>
                      {dc.name} ({dc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>使用者</Label>
              <Input
                placeholder="填写使用人姓名"
                value={form.userName}
                onChange={(e) => setForm((s) => ({ ...s, userName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>使用部门</Label>
                <Select
                  value={form.department}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, department: v as InternalTestHoldDepartment }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="选择" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>结算方式</Label>
                <Select
                  value={form.settlementMode}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, settlementMode: v as InternalTestHoldSettlement }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="选择" /></SelectTrigger>
                  <SelectContent>
                    {SETTLEMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>卡型与台数</Label>
              <div className="space-y-3">
                {cardRows.map((row, idx) => (
                  <div
                    key={row.key}
                    className="rounded-lg border border-border p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        卡型 {idx + 1}
                      </span>
                      {cardRows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCardRow(row.key)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">卡型</Label>
                        <Select
                          value={row.cardType}
                          onValueChange={(v) => updateCardRow(row.key, { cardType: v })}
                        >
                          <SelectTrigger><SelectValue placeholder="选择" /></SelectTrigger>
                          <SelectContent>
                            {MOCK_CARD_TYPES.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">台数</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="例如 4"
                          value={row.unitCount}
                          onChange={(e) => updateCardRow(row.key, { unitCount: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={addCardRow}
                >
                  <Plus className="w-4 h-4" />
                  添加卡型
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>开始时间</Label>
                <Input
                  type="datetime-local"
                  value={form.holdFrom}
                  onChange={(e) => setForm((s) => ({ ...s, holdFrom: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>计划结束（可选）</Label>
                <Input
                  type="datetime-local"
                  value={form.holdUntil}
                  onChange={(e) => setForm((s) => ({ ...s, holdUntil: e.target.value }))}
                />
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
  const dataCenterLabel = useDataCenterLabel(hold.data_center_id)
  const active = isActive(hold)
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false)
  const deviceCount = hold.devices?.length ?? 0

  return (
    <TableRow>
      <TableCell>
        <Link href={`/supplier/suppliers/${hold.supplier_id}`} className="text-primary hover:underline text-sm">
          {supplierName}
        </Link>
      </TableCell>
      <TableCell className="text-sm">{dataCenterLabel}</TableCell>
      <TableCell>{hold.user_name}</TableCell>
      <TableCell>{INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[hold.department]}</TableCell>
      <TableCell className="font-mono text-xs">{hold.card_type}</TableCell>
      <TableCell>{hold.unit_count}</TableCell>
      <TableCell>{INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[hold.settlement_mode]}</TableCell>
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
            <DropdownMenuItem asChild>
              <Link href={`/supplier/test-holds/${hold.id}`}>
                详情 <ChevronRight className="w-3 h-3 ml-1" />
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setDeviceDialogOpen(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              录入设备
              {deviceCount > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">{deviceCount} 台</span>
              )}
            </DropdownMenuItem>
            {active && <DropdownMenuItem onClick={onEnd}>结束占用</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        <TestHoldDeviceEntryDialog
          hold={hold}
          open={deviceDialogOpen}
          onOpenChange={setDeviceDialogOpen}
        />
      </TableCell>
    </TableRow>
  )
}
