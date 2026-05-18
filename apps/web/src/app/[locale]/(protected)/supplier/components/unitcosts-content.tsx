'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Cpu,
  DollarSign,
  Factory,
  History,
  Ban,
  CheckCircle,
  MoreHorizontal,
  Pencil,
  Percent,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
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
  DropdownMenuSeparator,
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
import { RadioGroup } from '@workspace/ui/components/radio-group'
import { CreateCardPricingDialog } from '@/components/dashboard/create-card-pricing-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  mockGPUCardTypes,
  mockDataCenters,
  mockSupplierPricingHistory,
  mockSupplierPricingRecords,
  mockSuppliers,
} from '@/lib/data/mock-data'
import type {
  ContractPricingMode,
  ContractPricingTier,
  CooperationMode,
  GPUCardType,
  GPUCardTypeManufacturer,
  GPUCardTypeStatus,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
import {
  contractPricingModeNames,
  isSharePricingMode,
  manufacturerNames,
} from '@/lib/data/types'

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

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN')
}

function getRecordPricingMode(record: SupplierPricingRecord): ContractPricingMode {
  return record.pricingMode ?? (record.cooperationMode === 'card_time' ? 'card_time' : 'revenue_share')
}

function pricingValueLabel(record: SupplierPricingRecord) {
  const mode = getRecordPricingMode(record)
  if (mode === 'card_time') {
    return record.unitPricePerHour != null ? `¥${record.unitPricePerHour}/小时` : '—'
  }
  if (mode === 'revenue_share') {
    return record.revenueSharePercent != null ? `${record.revenueSharePercent}%` : '—'
  }
  const tiers = record.pricingTiers?.length ?? 0
  return tiers > 0 ? `${tiers} 档阶梯` : '—'
}

function historyChangeLabel(row: SupplierPricingHistory) {
  if (row.cooperationMode === 'card_time') {
    const prev = row.previousUnitPricePerHour != null ? `¥${row.previousUnitPricePerHour}` : '—'
    const next = row.newUnitPricePerHour != null ? `¥${row.newUnitPricePerHour}` : '—'
    return { prev, next, unit: '/小时' }
  }
  const prev = row.previousRevenueSharePercent != null ? `${row.previousRevenueSharePercent}%` : '—'
  const next = row.newRevenueSharePercent != null ? `${row.newRevenueSharePercent}%` : '—'
  return { prev, next, unit: '' }
}

function buildInitialPricing(): SupplierPricingRecord[] {
  return mockSupplierPricingRecords.map((r) => ({ ...r }))
}

function buildInitialHistory(): SupplierPricingHistory[] {
  return [...mockSupplierPricingHistory]
}

function buildInitialCardTypes(): GPUCardType[] {
  return mockGPUCardTypes.map((c) => ({ ...c }))
}

const cardTypeStatusNames: Record<GPUCardTypeStatus, string> = {
  active: '启用',
  disabled: '已禁用',
}

const gpuManufacturers: GPUCardTypeManufacturer[] = [
  'NVIDIA',
  'AMD',
  'Intel',
  'Huawei',
  'Other',
]

export interface UnitCostsContentProps {
  /** 锁定为指定供应商（用于供应商详情页嵌入） */
  supplierId?: string
  /** 嵌入模式：隐藏页面级标题与统计卡片 */
  embedded?: boolean
}

export function UnitCostsContent({ supplierId: lockedSupplierId, embedded }: UnitCostsContentProps = {}) {
  const [activeTab, setActiveTab] = useState('pricing')
  const [pricingRecords, setPricingRecords] = useState<SupplierPricingRecord[]>(buildInitialPricing)
  const [history, setHistory] = useState<SupplierPricingHistory[]>(buildInitialHistory)
  const [cardTypes, setCardTypes] = useState<GPUCardType[]>(buildInitialCardTypes)

  const [searchTerm, setSearchTerm] = useState('')
  const [supplierFilter, setSupplierFilter] = useState(lockedSupplierId ?? 'all')
  const [dataCenterFilter, setDataCenterFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [cardTypeFilter, setCardTypeFilter] = useState('all')

  const [historySearch, setHistorySearch] = useState('')
  const [historySupplierFilter, setHistorySupplierFilter] = useState('all')

  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editUnitPrice, setEditUnitPrice] = useState('')
  const [editSharePercent, setEditSharePercent] = useState('')
  const [editEffectiveFrom, setEditEffectiveFrom] = useState('')
  const [editReason, setEditReason] = useState('')

  const selectedRecord = useMemo(
    () => pricingRecords.find((r) => r.id === selectedId) ?? null,
    [pricingRecords, selectedId],
  )

  const recordHistory = useMemo(() => {
    if (!selectedId) return []
    return history
      .filter((h) => h.pricingRecordId === selectedId)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
  }, [history, selectedId])

  const scopedPricingRecords = useMemo(
    () =>
      lockedSupplierId
        ? pricingRecords.filter((r) => r.supplierId === lockedSupplierId)
        : pricingRecords,
    [pricingRecords, lockedSupplierId],
  )

  const filteredPricing = scopedPricingRecords.filter((row) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      row.supplierName.toLowerCase().includes(q) ||
      row.dataCenterName.toLowerCase().includes(q) ||
      row.cardTypeName.toLowerCase().includes(q)
    const matchesSupplier = supplierFilter === 'all' || row.supplierId === supplierFilter
    const matchesDc = dataCenterFilter === 'all' || row.dataCenterId === dataCenterFilter
    const matchesMode = modeFilter === 'all' || row.cooperationMode === modeFilter
    const matchesCard = cardTypeFilter === 'all' || row.cardTypeId === cardTypeFilter
    return matchesSearch && matchesSupplier && matchesDc && matchesMode && matchesCard
  })

  const filteredHistory = history
    .filter((row) => {
      const q = historySearch.toLowerCase()
      const matchesSearch =
        row.supplierName.toLowerCase().includes(q) ||
        row.dataCenterName.toLowerCase().includes(q) ||
        row.cardTypeName.toLowerCase().includes(q) ||
        (row.reason?.toLowerCase().includes(q) ?? false)
      const matchesSupplier = historySupplierFilter === 'all' || row.supplierId === historySupplierFilter
      return matchesSearch && matchesSupplier
    })
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())

  const stats = useMemo(() => {
    const cardTime = scopedPricingRecords.filter((r) => r.cooperationMode === 'card_time').length
    const revenueShare = scopedPricingRecords.filter((r) => r.cooperationMode === 'revenue_share').length
    const suppliers = new Set(scopedPricingRecords.map((r) => r.supplierId)).size
    const dataCenters = new Set(scopedPricingRecords.map((r) => r.dataCenterId)).size
    return { total: scopedPricingRecords.length, cardTime, revenueShare, suppliers, dataCenters }
  }, [scopedPricingRecords])

  const dataCenterOptions = useMemo(() => {
    const scopeId = lockedSupplierId ?? (supplierFilter === 'all' ? null : supplierFilter)
    if (!scopeId) return mockDataCenters
    return mockDataCenters.filter((dc) => dc.supplierId === scopeId)
  }, [supplierFilter, lockedSupplierId])

  const activeCardTypes = useMemo(
    () => cardTypes.filter((c) => c.status === 'active'),
    [cardTypes],
  )

  const openEdit = (record: SupplierPricingRecord) => {
    setSelectedId(record.id)
    setEditUnitPrice(record.unitPricePerHour?.toString() ?? '')
    setEditSharePercent(record.revenueSharePercent?.toString() ?? '')
    setEditEffectiveFrom(record.effectiveFrom)
    setEditReason('')
    setEditDialogOpen(true)
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
    setView('detail')
    setActiveTab('pricing')
  }

  const backToList = () => {
    setView('list')
    setSelectedId(null)
  }

  const confirmEdit = () => {
    if (!selectedId || !selectedRecord) return

    const now = new Date().toISOString()
    const isCardTime = selectedRecord.cooperationMode === 'card_time'
    const newUnitPrice = isCardTime ? parseFloat(editUnitPrice) : undefined
    const newShare = !isCardTime ? parseFloat(editSharePercent) : undefined

    if (isCardTime && (newUnitPrice == null || Number.isNaN(newUnitPrice))) return
    if (!isCardTime && (newShare == null || Number.isNaN(newShare))) return

    const hasChange = isCardTime
      ? newUnitPrice !== selectedRecord.unitPricePerHour
      : newShare !== selectedRecord.revenueSharePercent

    if (hasChange) {
      const historyRow: SupplierPricingHistory = {
        id: `sph-${Date.now()}`,
        pricingRecordId: selectedId,
        supplierId: selectedRecord.supplierId,
        supplierName: selectedRecord.supplierName,
        dataCenterId: selectedRecord.dataCenterId,
        dataCenterName: selectedRecord.dataCenterName,
        cardTypeId: selectedRecord.cardTypeId,
        cardTypeName: selectedRecord.cardTypeName,
        cooperationMode: selectedRecord.cooperationMode,
        previousUnitPricePerHour: selectedRecord.unitPricePerHour,
        newUnitPricePerHour: newUnitPrice,
        previousRevenueSharePercent: selectedRecord.revenueSharePercent,
        newRevenueSharePercent: newShare,
        changedAt: now,
        changedBy: '当前用户',
        reason: editReason || undefined,
      }
      setHistory((prev) => [historyRow, ...prev])
    }

    setPricingRecords((prev) =>
      prev.map((r) =>
        r.id === selectedId
          ? {
              ...r,
              unitPricePerHour: newUnitPrice,
              revenueSharePercent: newShare,
              effectiveFrom: editEffectiveFrom || r.effectiveFrom,
              updatedAt: now,
              updatedBy: '当前用户',
            }
          : r,
      ),
    )
    setEditDialogOpen(false)
  }

  if (view === 'detail' && selectedRecord) {
    return (
      <UnitCostDetailView
        record={selectedRecord}
        recordHistory={recordHistory}
        onBack={backToList}
        onEdit={() => openEdit(selectedRecord)}
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        editUnitPrice={editUnitPrice}
        setEditUnitPrice={setEditUnitPrice}
        editSharePercent={editSharePercent}
        setEditSharePercent={setEditSharePercent}
        editEffectiveFrom={editEffectiveFrom}
        setEditEffectiveFrom={setEditEffectiveFrom}
        editReason={editReason}
        setEditReason={setEditReason}
        onConfirmEdit={confirmEdit}
      />
    )
  }

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">卡型单价管理</h1>
            <p className="text-sm text-muted-foreground mt-1">
              按供应商 × 机房 × 卡型维护合作模式下的单价或分成比例，并追溯历史变更
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            新增配置
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-foreground">卡型成本</h2>
            <p className="text-sm text-muted-foreground">按机房与卡型维护单价或分成比例</p>
          </div>
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            新增配置
          </Button>
        </div>
      )}

      {!embedded && (
      <div className="grid grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">配置条目</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.suppliers}</p>
            <p className="text-xs text-muted-foreground">覆盖供应商</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.dataCenters}</p>
            <p className="text-xs text-muted-foreground">覆盖机房</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.cardTime}</p>
            <p className="text-xs text-muted-foreground">卡时计价</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.revenueShare}</p>
            <p className="text-xs text-muted-foreground">分成计价</p>
          </CardContent>
        </Card>
      </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pricing">机房卡型单价</TabsTrigger>
          <TabsTrigger value="card-types">系统卡型</TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索供应商、机房、卡型..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {!lockedSupplierId && (
                  <Select
                    value={supplierFilter}
                    onValueChange={(v) => {
                      setSupplierFilter(v)
                      setDataCenterFilter('all')
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
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
                )}
                <Select value={dataCenterFilter} onValueChange={setDataCenterFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="机房" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部机房</SelectItem>
                    {dataCenterOptions.map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        {dc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="卡型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部卡型</SelectItem>
                    {activeCardTypes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={modeFilter} onValueChange={setModeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="合作模式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部模式</SelectItem>
                    <SelectItem value="card_time">卡时模式</SelectItem>
                    <SelectItem value="revenue_share">分成模式</SelectItem>
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
                  <TableHead className="text-muted-foreground">计价方式</TableHead>
                  <TableHead className="text-muted-foreground">单价 / 分成</TableHead>
                  <TableHead className="text-muted-foreground">生效日期</TableHead>
                  <TableHead className="text-muted-foreground">最近更新</TableHead>
                  <TableHead className="text-muted-foreground w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPricing.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      暂无匹配的配置
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPricing.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-border cursor-pointer"
                      onClick={() => openDetail(row.id)}
                    >
                      <TableCell>
                        <Link
                          href={`/supplier/${row.supplierId}`}
                          className="text-sm text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.supplierName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-foreground">{row.dataCenterName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">{row.cardTypeName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <PricingModeBadge mode={getRecordPricingMode(row)} />
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {pricingValueLabel(row)}
                      </TableCell>
                      <TableCell className="text-foreground">{formatDate(row.effectiveFrom)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(row.updatedAt)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(row.id)}>
                              查看详情与历史
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(row)}>
                              调整单价 / 分成
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="card-types" className="space-y-4 mt-4">
          <CardTypesPanel
            cardTypes={cardTypes}
            pricingRecords={pricingRecords}
            onCardTypesChange={setCardTypes}
          />
        </TabsContent>
      </Tabs>

      <CreateCardPricingDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        existingRecords={pricingRecords}
        cardTypes={activeCardTypes}
        onCreated={(record) => {
          setPricingRecords((prev) => [record, ...prev])
          setCreateDialogOpen(false)
        }}
      />

      <EditPricingDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        record={selectedRecord}
        unitPrice={editUnitPrice}
        setUnitPrice={setEditUnitPrice}
        sharePercent={editSharePercent}
        setSharePercent={setEditSharePercent}
        effectiveFrom={editEffectiveFrom}
        setEffectiveFrom={setEditEffectiveFrom}
        reason={editReason}
        setReason={setEditReason}
        onConfirm={confirmEdit}
      />
    </div>
  )
}

function PricingModeBadge({ mode }: { mode: ContractPricingMode }) {
  const isCardTime = mode === 'card_time' || mode === 'tiered_card_time'
  return (
    <Badge
      variant="outline"
      className={
        isCardTime
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
          : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
      }
    >
      {contractPricingModeNames[mode]}
    </Badge>
  )
}

function CooperationModeBadge({ mode }: { mode: CooperationMode }) {
  return (
    <Badge
      variant="outline"
      className={
        mode === 'card_time'
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
          : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
      }
    >
      {contractPricingModeNames[mode]}
    </Badge>
  )
}


function EditPricingDialog({
  open,
  onOpenChange,
  record,
  unitPrice,
  setUnitPrice,
  sharePercent,
  setSharePercent,
  effectiveFrom,
  setEffectiveFrom,
  reason,
  setReason,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: SupplierPricingRecord | null
  unitPrice: string
  setUnitPrice: (v: string) => void
  sharePercent: string
  setSharePercent: (v: string) => void
  effectiveFrom: string
  setEffectiveFrom: (v: string) => void
  reason: string
  setReason: (v: string) => void
  onConfirm: () => void
}) {
  if (!record) return null
  const isCardTime = record.cooperationMode === 'card_time'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>调整单价 / 分成</DialogTitle>
          <DialogDescription>
            {record.supplierName} · {record.dataCenterName} · {record.cardTypeName}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>计价方式</Label>
            <PricingModeBadge mode={getRecordPricingMode(record)} />
          </div>
          {isCardTime ? (
            <div className="grid gap-2">
              <Label>卡时单价（元/小时）</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-9"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>供应商分成比例（%）</Label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  className="pl-9"
                  min={0}
                  max={100}
                  value={sharePercent}
                  onChange={(e) => setSharePercent(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>生效日期</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>变更备注</Label>
            <Textarea
              placeholder="如：季度调价、合同补充协议..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm}>保存并记录历史</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UnitCostDetailView(props: {
  record: SupplierPricingRecord
  recordHistory: SupplierPricingHistory[]
  onBack: () => void
  onEdit: () => void
  editDialogOpen: boolean
  setEditDialogOpen: (open: boolean) => void
  editUnitPrice: string
  setEditUnitPrice: (v: string) => void
  editSharePercent: string
  setEditSharePercent: (v: string) => void
  editEffectiveFrom: string
  setEditEffectiveFrom: (v: string) => void
  editReason: string
  setEditReason: (v: string) => void
  onConfirmEdit: () => void
}) {
  const {
    record,
    recordHistory,
    onBack,
    onEdit,
    editDialogOpen,
    setEditDialogOpen,
    editUnitPrice,
    setEditUnitPrice,
    editSharePercent,
    setEditSharePercent,
    editEffectiveFrom,
    setEditEffectiveFrom,
    editReason,
    setEditReason,
    onConfirmEdit,
  } = props

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="mt-1" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-foreground">{record.cardTypeName}</h1>
              <PricingModeBadge mode={getRecordPricingMode(record)} />
            </div>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1">
                <Factory className="w-4 h-4" />
                {record.supplierName}
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {record.dataCenterName}
              </span>
            </p>
          </div>
        </div>
        <Button onClick={onEdit}>调整单价 / 分成</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">当前单价 / 分成</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{pricingValueLabel(record)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">生效日期</p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              {formatDate(record.effectiveFrom)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">历史变更次数</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{recordHistory.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">配置详情</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">配置 ID</span>
            <code className="text-foreground">{record.id}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">供应商</span>
            <Link href={`/supplier/${record.supplierId}`} className="text-primary hover:underline">
              {record.supplierName}
            </Link>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">机房</span>
            <span className="text-foreground">{record.dataCenterName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">卡型</span>
            <span className="text-foreground">{record.cardTypeName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">最近更新</span>
            <span className="text-foreground">{formatDateTime(record.updatedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">更新人</span>
            <span className="text-foreground">{record.updatedBy ?? '—'}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" />
            变更历史
          </CardTitle>
          <CardDescription>该机房卡型下的全部单价 / 分成调整记录</CardDescription>
        </CardHeader>
        <CardContent>
          {recordHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">暂无历史变更</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">变更时间</TableHead>
                  <TableHead className="text-muted-foreground">变更前</TableHead>
                  <TableHead className="text-muted-foreground">变更后</TableHead>
                  <TableHead className="text-muted-foreground">操作人</TableHead>
                  <TableHead className="text-muted-foreground">备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordHistory.map((row) => {
                  const { prev, next, unit } = historyChangeLabel(row)
                  return (
                    <TableRow key={row.id} className="border-border">
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(row.changedAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {prev}
                        {unit}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {next}
                        {unit}
                      </TableCell>
                      <TableCell>{row.changedBy}</TableCell>
                      <TableCell className="text-muted-foreground">{row.reason ?? '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditPricingDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        record={record}
        unitPrice={editUnitPrice}
        setUnitPrice={setEditUnitPrice}
        sharePercent={editSharePercent}
        setSharePercent={setEditSharePercent}
        effectiveFrom={editEffectiveFrom}
        setEffectiveFrom={setEditEffectiveFrom}
        reason={editReason}
        setReason={setEditReason}
        onConfirm={onConfirmEdit}
      />
    </div>
  )
}

function CardTypeStatusBadge({ status }: { status: GPUCardTypeStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === 'active'
          ? 'bg-green-500/10 text-green-400 border-green-500/30'
          : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
      }
    >
      {cardTypeStatusNames[status]}
    </Badge>
  )
}

type CardTypeFormMode = 'create' | 'edit'

function CardTypeFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  existingIds,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CardTypeFormMode
  initial: GPUCardType | null
  existingIds: string[]
  onSave: (card: GPUCardType) => void
}) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState<GPUCardTypeManufacturer>('NVIDIA')
  const [memoryGB, setMemoryGB] = useState('')
  const [tdpWatts, setTdpWatts] = useState('')
  const [computeCapability, setComputeCapability] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && initial) {
      setId(initial.id)
      setName(initial.name)
      setManufacturer(initial.manufacturer)
      setMemoryGB(String(initial.memoryGB))
      setTdpWatts(String(initial.tdpWatts))
      setComputeCapability(initial.computeCapability ?? '')
    } else {
      setId('')
      setName('')
      setManufacturer('NVIDIA')
      setMemoryGB('')
      setTdpWatts('')
      setComputeCapability('')
    }
    setSubmitError(null)
  }, [open, mode, initial])

  const handleSubmit = () => {
    const trimmedId = id.trim()
    const trimmedName = name.trim()
    if (!trimmedId) {
      setSubmitError('请填写卡型 ID')
      return
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmedId)) {
      setSubmitError('卡型 ID 需以字母开头，仅可包含字母、数字、下划线与连字符')
      return
    }
    if (mode === 'create' && existingIds.includes(trimmedId)) {
      setSubmitError('卡型 ID 已存在')
      return
    }
    if (!trimmedName) {
      setSubmitError('请填写卡型名称')
      return
    }
    const memory = parseInt(memoryGB, 10)
    const tdp = parseInt(tdpWatts, 10)
    if (Number.isNaN(memory) || memory <= 0) {
      setSubmitError('请填写有效的显存容量（GB）')
      return
    }
    if (Number.isNaN(tdp) || tdp <= 0) {
      setSubmitError('请填写有效的 TDP（W）')
      return
    }

    const now = new Date().toISOString()
    onSave({
      id: trimmedId,
      name: trimmedName,
      manufacturer,
      memoryGB: memory,
      tdpWatts: tdp,
      computeCapability: computeCapability.trim() || undefined,
      status: initial?.status ?? 'active',
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增系统卡型' : '编辑系统卡型'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '录入平台标准 GPU 卡型，供机房单价配置时关联选用'
              : '修改卡型规格信息，已关联的机房配置将同步展示新名称'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>卡型 ID *</Label>
            <Input
              placeholder="如 card9"
              value={id}
              disabled={mode === 'edit'}
              onChange={(e) => {
                setId(e.target.value)
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>卡型名称 *</Label>
            <Input
              placeholder="如 NVIDIA A100 80GB"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>厂商 *</Label>
            <Select
              value={manufacturer}
              onValueChange={(v) => setManufacturer(v as GPUCardTypeManufacturer)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gpuManufacturers.map((m) => (
                  <SelectItem key={m} value={m}>
                    {manufacturerNames[m] ?? m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>显存（GB）*</Label>
              <Input
                type="number"
                min={1}
                value={memoryGB}
                onChange={(e) => setMemoryGB(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>TDP（W）*</Label>
              <Input
                type="number"
                min={1}
                value={tdpWatts}
                onChange={(e) => setTdpWatts(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>算力版本</Label>
            <Input
              placeholder="如 8.0（选填）"
              value={computeCapability}
              onChange={(e) => setComputeCapability(e.target.value)}
            />
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>{mode === 'create' ? '创建' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CardTypesPanel({
  cardTypes,
  pricingRecords,
  onCardTypesChange,
}: {
  cardTypes: GPUCardType[]
  pricingRecords: SupplierPricingRecord[]
  onCardTypesChange: Dispatch<SetStateAction<GPUCardType[]>>
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | GPUCardTypeStatus>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<CardTypeFormMode>('create')
  const [editingCard, setEditingCard] = useState<GPUCardType | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const usageByCardId = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of pricingRecords) {
      map.set(r.cardTypeId, (map.get(r.cardTypeId) ?? 0) + 1)
    }
    return map
  }, [pricingRecords])

  const filteredCards = cardTypes.filter((card) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      card.id.toLowerCase().includes(q) ||
      card.name.toLowerCase().includes(q) ||
      card.manufacturer.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || card.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const openCreate = () => {
    setFormMode('create')
    setEditingCard(null)
    setFormOpen(true)
    setActionError(null)
  }

  const openEdit = (card: GPUCardType) => {
    setFormMode('edit')
    setEditingCard(card)
    setFormOpen(true)
    setActionError(null)
  }

  const handleSave = (card: GPUCardType) => {
    if (formMode === 'create') {
      onCardTypesChange((prev) => [card, ...prev])
    } else {
      onCardTypesChange((prev) => prev.map((c) => (c.id === card.id ? card : c)))
    }
    setActionError(null)
  }

  const toggleStatus = (card: GPUCardType) => {
    const usageCount = usageByCardId.get(card.id) ?? 0
    if (card.status === 'active' && usageCount > 0) {
      setActionError(`卡型「${card.name}」已被 ${usageCount} 条机房单价配置引用，无法禁用`)
      return
    }
    const nextStatus: GPUCardTypeStatus = card.status === 'active' ? 'disabled' : 'active'
    onCardTypesChange((prev) =>
      prev.map((c) =>
        c.id === card.id
          ? { ...c, status: nextStatus, updatedAt: new Date().toISOString() }
          : c,
      ),
    )
    setActionError(null)
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">系统卡型列表</CardTitle>
          <CardDescription>
            平台维护的标准 GPU 卡型字典，机房配置单价时需关联以下卡型
          </CardDescription>
        </div>
        <Button className="gap-2 shrink-0" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          新增卡型
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索 ID、名称、厂商..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as 'all' | GPUCardTypeStatus)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">启用</SelectItem>
              <SelectItem value="disabled">已禁用</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">卡型 ID</TableHead>
              <TableHead className="text-muted-foreground">名称</TableHead>
              <TableHead className="text-muted-foreground">厂商</TableHead>
              <TableHead className="text-muted-foreground">显存</TableHead>
              <TableHead className="text-muted-foreground">TDP</TableHead>
              <TableHead className="text-muted-foreground">算力版本</TableHead>
              <TableHead className="text-muted-foreground">状态</TableHead>
              <TableHead className="text-muted-foreground">已配置机房数</TableHead>
              <TableHead className="text-muted-foreground w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCards.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  暂无匹配的卡型
                </TableCell>
              </TableRow>
            ) : (
              filteredCards.map((card) => {
                const usageCount = usageByCardId.get(card.id) ?? 0
                const isDisabled = card.status === 'disabled'
                return (
                  <TableRow
                    key={card.id}
                    className={`border-border ${isDisabled ? 'opacity-60' : ''}`}
                  >
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{card.id}</code>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-muted-foreground" />
                        {card.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {manufacturerNames[card.manufacturer] ?? card.manufacturer}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground">{card.memoryGB} GB</TableCell>
                    <TableCell className="text-foreground">{card.tdpWatts} W</TableCell>
                    <TableCell className="text-muted-foreground">
                      {card.computeCapability ?? '—'}
                    </TableCell>
                    <TableCell>
                      <CardTypeStatusBadge status={card.status} />
                    </TableCell>
                    <TableCell className="text-foreground">{usageCount}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(card)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {card.status === 'active' ? (
                            <DropdownMenuItem
                              onClick={() => toggleStatus(card)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              禁用
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => toggleStatus(card)}>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              启用
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <CardTypeFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          mode={formMode}
          initial={editingCard}
          existingIds={cardTypes.map((c) => c.id)}
          onSave={handleSave}
        />
      </CardContent>
    </Card>
  )
}
