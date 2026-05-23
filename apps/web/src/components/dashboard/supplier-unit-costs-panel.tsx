'use client'

import { useMemo, useState } from 'react'
import { Cpu, DollarSign, MoreHorizontal, Percent, Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Badge } from '@workspace/ui/components/badge'
import { Card } from '@workspace/ui/components/card'
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
import { PricingConfigStatusBadge } from '@/components/dashboard/pricing-config-status-badge'
import {
  isPricingRecordUnavailable,
  pricingRecordRowClassName,
  pricingValueClassName,
} from '@/lib/supplier/pricing-record-status'
import type {
  ContractPricingMode,
  DataCenter,
  Supplier,
  SupplierPricingRecord,
} from '@/lib/data/types'
import { contractPricingModeNames } from '@/lib/data/types'
import {
  formatPlatformPeriodDateTime,
  formatPlatformPeriodRange,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '@/lib/platform-pricing/datetime'
import { trpc } from '@/lib/trpc/client'

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
  supplier: Pick<Supplier, 'id' | 'name' | 'shortName'>
  /** 锁定到指定机房（用于机房详情页） */
  dataCenter?: Pick<DataCenter, 'id' | 'name'>
}

export function SupplierUnitCostsPanel({ supplier, dataCenter }: SupplierUnitCostsPanelProps) {
  const listInput = { supplierId: supplier.id }
  const utils = trpc.useUtils()
  const lockedDataCenter = dataCenter ?? null

  const invalidatePricingQueries = async () => {
    await utils.supplier.unitCosts.listRecords.invalidate(listInput)
    await utils.supplier.unitCosts.listHistory.invalidate(listInput)
    if (lockedDataCenter) {
      await utils.supplier.getDataCenterDetail.invalidate({ dataCenterId: lockedDataCenter.id })
      await utils.supplier.listGpuInventory.invalidate()
    }
  }

  const { data: pricingRecords = [], isLoading: recordsLoading } =
    trpc.supplier.unitCosts.listRecords.useQuery(listInput)
  const { data: dataCenterOptions = [] } = trpc.supplier.listDataCenters.useQuery({
    supplierId: supplier.id,
  })
  const { data: activeCardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery()

  const createMutation = trpc.supplier.unitCosts.create.useMutation({
    onSuccess: async () => {
      await invalidatePricingQueries()
      setCreateDialogOpen(false)
    },
  })
  const updateMutation = trpc.supplier.unitCosts.update.useMutation({
    onSuccess: async () => {
      await invalidatePricingQueries()
      setEditDialogOpen(false)
    },
  })

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editUnitPrice, setEditUnitPrice] = useState('')
  const [editSharePercent, setEditSharePercent] = useState('')
  const [editEffectiveFrom, setEditEffectiveFrom] = useState('')
  const [editEffectiveTo, setEditEffectiveTo] = useState('')
  const [editReason, setEditReason] = useState('')

  const scopedPricing = useMemo(() => {
    if (lockedDataCenter) {
      return pricingRecords.filter((row) => row.dataCenterId === lockedDataCenter.id)
    }
    return pricingRecords
  }, [pricingRecords, lockedDataCenter])

  const selectedRecord = useMemo(
    () => pricingRecords.find((r) => r.id === selectedId) ?? null,
    [pricingRecords, selectedId],
  )

  const openEdit = (record: SupplierPricingRecord) => {
    setSelectedId(record.id)
    setEditUnitPrice(record.unitPricePerHour?.toString() ?? '')
    setEditSharePercent(record.revenueSharePercent?.toString() ?? '')
    setEditEffectiveFrom(toDatetimeLocalValue(record.effectiveFrom))
    setEditEffectiveTo(record.effectiveTo ? toDatetimeLocalValue(record.effectiveTo) : '')
    setEditReason('')
    setEditDialogOpen(true)
  }

  const confirmEdit = () => {
    if (!selectedId || !selectedRecord) return

    const pricingMode = getRecordPricingMode(selectedRecord)
    const isCardTime = selectedRecord.cooperationMode === 'card_time'
    const newUnitPrice = isCardTime ? parseFloat(editUnitPrice) : undefined
    const newShare = !isCardTime ? parseFloat(editSharePercent) : undefined

    if (isCardTime && (newUnitPrice == null || Number.isNaN(newUnitPrice))) return
    if (!isCardTime && (newShare == null || Number.isNaN(newShare))) return

    updateMutation.mutate({
      recordId: selectedId,
      pricingMode,
      unitPricePerHour: newUnitPrice,
      revenueSharePercent: newShare,
      pricingTiers: selectedRecord.pricingTiers,
      effectiveFrom: fromDatetimeLocalValue(editEffectiveFrom),
      effectiveTo: editEffectiveTo.trim()
        ? fromDatetimeLocalValue(editEffectiveTo)
        : null,
      reason: editReason || undefined,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">卡型成本</h2>
          <p className="text-sm text-muted-foreground">
            {lockedDataCenter
              ? `本机房各卡型的单价或分成配置`
              : '该供应商下各机房各卡型的单价或分成配置'}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          新增配置
        </Button>
      </div>

      {recordsLoading && (
        <p className="text-sm text-muted-foreground">加载卡型成本配置…</p>
      )}

      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {!lockedDataCenter && (
                <TableHead className="text-muted-foreground">机房</TableHead>
              )}
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
            {scopedPricing.length === 0 ? (
              <TableRow className="border-border">
                <TableCell
                  colSpan={lockedDataCenter ? 7 : 8}
                  className="text-center text-muted-foreground py-12"
                >
                  暂无配置，点击「新增配置」添加机房卡型单价
                </TableCell>
              </TableRow>
            ) : (
              scopedPricing.map((row) => (
                <TableRow key={row.id} className={`border-border ${pricingRecordRowClassName(row)}`}>
                  {!lockedDataCenter && (
                    <TableCell className="text-foreground">{row.dataCenterName}</TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{row.cardTypeName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PricingModeBadge mode={getRecordPricingMode(row)} />
                  </TableCell>
                  <TableCell>
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
        dataCenters={dataCenterOptions}
        lockedDataCenter={lockedDataCenter ?? undefined}
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
            <Label>生效时间</Label>
            <Input
              type="datetime-local"
              step={1}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>结束时间（可选）</Label>
            <Input
              type="datetime-local"
              step={1}
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
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
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? '保存中…' : '保存并记录历史'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
