'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { Textarea } from '@workspace/ui/components/textarea'
import { CreateCardPricingDialog } from '@/components/dashboard/create-card-pricing-dialog'
import {
  formatPlatformPeriodDateTime,
  formatPlatformPeriodRange,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/lib/platform-pricing/datetime'
import { PricingConfigStatusBadge } from '@/components/dashboard/pricing-config-status-badge'
import {
  isPricingRecordUnavailable,
  pricingRecordRowClassName,
  pricingValueClassName,
} from '@/lib/supplier/pricing-record-status'
import { trpc } from '@/lib/trpc/client'
import type {
  ContractPricingMode,
  ContractPricingTier,
  CooperationMode,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
import {
  contractPricingModeNames,
  isSharePricingMode,
  manufacturerNames,
} from '@/lib/data/types'

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return formatPlatformPeriodDateTime(value)
}

function formatEffectiveRange(from: string, to?: string | null) {
  return formatPlatformPeriodRange(from, to ?? null)
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

export interface UnitCostsContentProps {
  /** 锁定为指定供应商（用于供应商详情页嵌入） */
  supplierId?: string
  /** 嵌入模式：隐藏页面级标题与统计卡片 */
  embedded?: boolean
}

export function UnitCostsContent({ supplierId: lockedSupplierId, embedded }: UnitCostsContentProps = {}) {
  const utils = trpc.useUtils()
  const listInput = lockedSupplierId ? { supplierId: lockedSupplierId } : undefined

  const { data: pricingRecords = [], isLoading: recordsLoading } =
    trpc.supplier.unitCosts.listRecords.useQuery(listInput)
  const { data: history = [] } = trpc.supplier.unitCosts.listHistory.useQuery(listInput)
  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, {
    enabled: !lockedSupplierId,
  })
  const { data: activeCardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery()

  const [searchTerm, setSearchTerm] = useState('')
  const [supplierFilter, setSupplierFilter] = useState(lockedSupplierId ?? 'all')
  const [dataCenterFilter, setDataCenterFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState<string>('all')
  const [cardTypeFilter, setCardTypeFilter] = useState('all')

  const scopeSupplierId =
    lockedSupplierId ?? (supplierFilter !== 'all' ? supplierFilter : undefined)
  const { data: scopedDataCenters = [] } = trpc.supplier.listDataCenters.useQuery(
    { supplierId: scopeSupplierId! },
    { enabled: Boolean(scopeSupplierId) },
  )

  const createMutation = trpc.supplier.unitCosts.create.useMutation({
    onSuccess: async () => {
      await utils.supplier.unitCosts.listRecords.invalidate(listInput)
      await utils.supplier.unitCosts.listHistory.invalidate(listInput)
      setCreateDialogOpen(false)
    },
  })
  const updateMutation = trpc.supplier.unitCosts.update.useMutation({
    onSuccess: async () => {
      await utils.supplier.unitCosts.listRecords.invalidate(listInput)
      await utils.supplier.unitCosts.listHistory.invalidate(listInput)
      setEditDialogOpen(false)
    },
  })

  const [historySearch, setHistorySearch] = useState('')
  const [historySupplierFilter, setHistorySupplierFilter] = useState('all')

  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editUnitPrice, setEditUnitPrice] = useState('')
  const [editSharePercent, setEditSharePercent] = useState('')
  const [editEffectiveFrom, setEditEffectiveFrom] = useState('')
  const [editEffectiveTo, setEditEffectiveTo] = useState('')
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
    if (scopedDataCenters.length > 0) return scopedDataCenters
    const seen = new Map<string, { id: string; name: string }>()
    for (const row of pricingRecords) {
      if (!seen.has(row.dataCenterId)) {
        seen.set(row.dataCenterId, { id: row.dataCenterId, name: row.dataCenterName })
      }
    }
    return [...seen.values()]
  }, [scopedDataCenters, pricingRecords])

  const openEdit = (record: SupplierPricingRecord) => {
    setSelectedId(record.id)
    setEditUnitPrice(record.unitPricePerHour?.toString() ?? '')
    setEditSharePercent(record.revenueSharePercent?.toString() ?? '')
    setEditEffectiveFrom(toDatetimeLocalValue(record.effectiveFrom))
    setEditEffectiveTo(record.effectiveTo ? toDatetimeLocalValue(record.effectiveTo) : '')
    setEditReason('')
    setEditDialogOpen(true)
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
    setView('detail')
  }

  const backToList = () => {
    setView('list')
    setSelectedId(null)
  }

  const confirmEdit = () => {
    if (!selectedId || !selectedRecord) return

    const pricingMode = getRecordPricingMode(selectedRecord)
    const isCardTime = selectedRecord.cooperationMode === 'card_time'
    const newUnitPrice = isCardTime ? parseFloat(editUnitPrice) : undefined
    const newShare = !isCardTime ? parseFloat(editSharePercent) : undefined

    if (isCardTime && (newUnitPrice == null || Number.isNaN(newUnitPrice))) return
    if (!isCardTime && (newShare == null || Number.isNaN(newShare))) return

    const effectiveFrom = fromDatetimeLocalValue(editEffectiveFrom)
    const effectiveTo = editEffectiveTo.trim()
      ? fromDatetimeLocalValue(editEffectiveTo)
      : null

    updateMutation.mutate({
      recordId: selectedId,
      pricingMode,
      unitPricePerHour: newUnitPrice,
      revenueSharePercent: newShare,
      pricingTiers: selectedRecord.pricingTiers,
      effectiveFrom,
      effectiveTo,
      reason: editReason || undefined,
    })
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
        editEffectiveTo={editEffectiveTo}
        setEditEffectiveTo={setEditEffectiveTo}
        editReason={editReason}
        setEditReason={setEditReason}
        isSubmitting={updateMutation.isPending}
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
              按供应商 × 机房 × 卡型维护计价模式下的单价或分成比例，并追溯历史变更
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

      <div className="space-y-4 mt-4">
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
                      {suppliers.map((s) => (
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
                    <SelectValue placeholder="计价模式" />
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
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground">单价 / 分成</TableHead>
                  <TableHead className="text-muted-foreground">生效时间</TableHead>
                  <TableHead className="text-muted-foreground">最近更新</TableHead>
                  <TableHead className="text-muted-foreground w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recordsLoading ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : filteredPricing.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                      暂无匹配的配置
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPricing.map((row) => (
                    <TableRow
                      key={row.id}
                      className={`border-border cursor-pointer ${pricingRecordRowClassName(row)}`}
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <PricingConfigStatusBadge record={row} />
                        {!isPricingRecordUnavailable(row) ? (
                          <span className="text-xs text-muted-foreground">可用</span>
                        ) : null}
                      </TableCell>
                      <TableCell className={pricingValueClassName(row)}>
                        {pricingValueLabel(row)}
                      </TableCell>
                      <TableCell className="text-foreground text-sm whitespace-nowrap">
                        {formatEffectiveRange(row.effectiveFrom, row.effectiveTo)}
                      </TableCell>
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
                              {isPricingRecordUnavailable(row)
                                ? '完善单价 / 分成'
                                : '调整单价 / 分成'}
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
      </div>

      <CreateCardPricingDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        existingRecords={pricingRecords}
        cardTypes={activeCardTypes}
        suppliers={suppliers}
        dataCenters={scopedDataCenters}
        lockedSupplierId={lockedSupplierId}
        isSubmitting={createMutation.isPending}
        onCreated={(record) => {
          const pricingMode = record.pricingMode ?? 'card_time'
          createMutation.mutate({
            supplierId: record.supplierId,
            dataCenterId: record.dataCenterId,
            gpuCardTypeId: record.cardTypeId,
            pricingMode,
            unitPricePerHour: record.unitPricePerHour,
            revenueSharePercent: record.revenueSharePercent,
            pricingTiers: record.pricingTiers,
            effectiveFrom: record.effectiveFrom,
            effectiveTo: record.effectiveTo ?? null,
          })
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
        effectiveTo={editEffectiveTo}
        setEffectiveTo={setEditEffectiveTo}
        reason={editReason}
        setReason={setEditReason}
        isSubmitting={updateMutation.isPending}
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
  effectiveTo,
  setEffectiveTo,
  reason,
  setReason,
  isSubmitting,
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
  effectiveTo: string
  setEffectiveTo: (v: string) => void
  reason: string
  setReason: (v: string) => void
  isSubmitting?: boolean
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
            <Label>生效时间</Label>
            <Input
              type="datetime-local"
              step={1}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">格式：yyyy-MM-dd HH:mm:ss</p>
          </div>
          <div className="grid gap-2">
            <Label>结束时间（可选）</Label>
            <Input
              type="datetime-local"
              step={1}
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">留空表示长期有效</p>
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
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? '保存中…' : '保存并记录历史'}
          </Button>
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
  editEffectiveTo: string
  setEditEffectiveTo: (v: string) => void
  editReason: string
  setEditReason: (v: string) => void
  isSubmitting?: boolean
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
    editEffectiveTo,
    setEditEffectiveTo,
    editReason,
    setEditReason,
    isSubmitting,
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
            <p className="text-sm text-muted-foreground">生效时间</p>
            <p className="text-lg font-semibold text-foreground mt-1 whitespace-nowrap">
              {formatEffectiveRange(record.effectiveFrom, record.effectiveTo)}
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
        effectiveTo={editEffectiveTo}
        setEffectiveTo={setEditEffectiveTo}
        reason={editReason}
        setReason={setEditReason}
        isSubmitting={isSubmitting}
        onConfirm={onConfirmEdit}
      />
    </div>
  )
}
