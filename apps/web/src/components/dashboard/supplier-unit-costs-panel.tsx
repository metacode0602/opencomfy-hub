'use client'

import { useMemo, useState } from 'react'
import { Cpu, DollarSign, MoreHorizontal, Percent, Plus, Search } from 'lucide-react'
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
import { Textarea } from '@workspace/ui/components/textarea'
import { CreateCardPricingDialog } from '@/components/dashboard/create-card-pricing-dialog'
import {
  mockGPUCardTypes,
  mockDataCenters,
  mockSupplierPricingHistory,
  mockSupplierPricingRecords,
} from '@/lib/data/mock-data'
import type {
  ContractPricingMode,
  Supplier,
  SupplierPricingHistory,
  SupplierPricingRecord,
} from '@/lib/data/types'
import { contractPricingModeNames } from '@/lib/data/types'

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

interface SupplierUnitCostsPanelProps {
  supplier: Supplier
}

export function SupplierUnitCostsPanel({ supplier }: SupplierUnitCostsPanelProps) {
  const [pricingRecords, setPricingRecords] = useState<SupplierPricingRecord[]>(() =>
    mockSupplierPricingRecords.map((r) => ({ ...r })),
  )
  const [history, setHistory] = useState<SupplierPricingHistory[]>(() => [
    ...mockSupplierPricingHistory,
  ])

  const [searchTerm, setSearchTerm] = useState('')
  const [dataCenterFilter, setDataCenterFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  const [cardTypeFilter, setCardTypeFilter] = useState('all')

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editUnitPrice, setEditUnitPrice] = useState('')
  const [editSharePercent, setEditSharePercent] = useState('')
  const [editEffectiveFrom, setEditEffectiveFrom] = useState('')
  const [editReason, setEditReason] = useState('')

  const activeCardTypes = useMemo(
    () => mockGPUCardTypes.filter((c) => c.status === 'active'),
    [],
  )

  const supplierRecords = useMemo(
    () => pricingRecords.filter((r) => r.supplierId === supplier.id),
    [pricingRecords, supplier.id],
  )

  const dataCenterOptions = useMemo(
    () => mockDataCenters.filter((dc) => dc.supplierId === supplier.id),
    [supplier.id],
  )

  const filteredPricing = supplierRecords.filter((row) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      row.dataCenterName.toLowerCase().includes(q) ||
      row.cardTypeName.toLowerCase().includes(q)
    const matchesDc = dataCenterFilter === 'all' || row.dataCenterId === dataCenterFilter
    const matchesMode = modeFilter === 'all' || row.cooperationMode === modeFilter
    const matchesCard = cardTypeFilter === 'all' || row.cardTypeId === cardTypeFilter
    return matchesSearch && matchesDc && matchesMode && matchesCard
  })

  const selectedRecord = useMemo(
    () => pricingRecords.find((r) => r.id === selectedId) ?? null,
    [pricingRecords, selectedId],
  )

  const openEdit = (record: SupplierPricingRecord) => {
    setSelectedId(record.id)
    setEditUnitPrice(record.unitPricePerHour?.toString() ?? '')
    setEditSharePercent(record.revenueSharePercent?.toString() ?? '')
    setEditEffectiveFrom(record.effectiveFrom)
    setEditReason('')
    setEditDialogOpen(true)
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

  return (
    <div className="space-y-4">
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

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索机房、卡型..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  暂无配置，点击「新增配置」添加机房卡型单价
                </TableCell>
              </TableRow>
            ) : (
              filteredPricing.map((row) => (
                <TableRow key={row.id} className="border-border">
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
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
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

      <CreateCardPricingDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        supplier={supplier}
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
            {record.dataCenterName} · {record.cardTypeName}
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
