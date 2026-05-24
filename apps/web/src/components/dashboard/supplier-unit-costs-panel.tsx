'use client'

import { useMemo, useState } from 'react'
import { Cpu, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
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
import { CreateCardPricingDialog } from '@/components/dashboard/create-card-pricing-dialog'
import { PricingConfigStatusBadge } from '@/components/dashboard/pricing-config-status-badge'
import {
  isPricingRecordUnavailable,
  pricingRecordRowClassName,
  pricingValueClassName,
} from '@/lib/supplier/pricing-record-status'
import type { DataCenter, Supplier, SupplierPricingRecord } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { EditPricingDialog } from '@/app/[locale]/(protected)/supplier/components/edit-pricing-dialog'
import { PricingModeBadge } from '@/app/[locale]/(protected)/supplier/components/pricing-mode-badge'
import {
  formatDateTime,
  formatEffectiveRange,
  getRecordPricingMode,
  pricingValueLabel,
} from '@/app/[locale]/(protected)/supplier/components/unit-costs-utils'

interface SupplierUnitCostsPanelProps {
  supplier: Pick<Supplier, 'id' | 'name' | 'shortName'>
  /** 锁定到指定机房（用于机房详情页） */
  dataCenter?: Pick<DataCenter, 'id' | 'name'>
}

export function SupplierUnitCostsPanel({ supplier, dataCenter }: SupplierUnitCostsPanelProps) {
  const listInput = { supplierId: supplier.id }
  const utils = trpc.useUtils()
  const lockedDataCenter = dataCenter ?? null

  const { data: pricingRecords = [], isLoading: recordsLoading } =
    trpc.supplier.unitCosts.listRecords.useQuery(listInput)
  const { data: dataCenterOptions = [] } = trpc.supplier.listDataCenters.useQuery({
    supplierId: supplier.id,
  })
  const { data: activeCardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<SupplierPricingRecord | null>(null)

  const scopedPricing = useMemo(() => {
    if (lockedDataCenter) {
      return pricingRecords.filter((row) => row.dataCenterId === lockedDataCenter.id)
    }
    return pricingRecords
  }, [pricingRecords, lockedDataCenter])

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
                        <DropdownMenuItem onClick={() => setEditRecord(row)}>
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

      <CreateCardPricingDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        supplier={supplier}
        listInput={listInput}
        existingRecords={pricingRecords}
        cardTypes={activeCardTypes}
        dataCenters={dataCenterOptions}
        lockedDataCenter={lockedDataCenter ?? undefined}
        onSuccess={async () => {
          if (lockedDataCenter) {
            await utils.supplier.getDataCenterDetail.invalidate({
              dataCenterId: lockedDataCenter.id,
            })
            await utils.supplier.listGpuInventory.invalidate()
          }
        }}
      />

      <EditPricingDialog
        open={editRecord != null}
        onOpenChange={(open) => {
          if (!open) setEditRecord(null)
        }}
        record={editRecord}
        listInput={listInput}
        onSuccess={async () => {
          if (lockedDataCenter) {
            await utils.supplier.getDataCenterDetail.invalidate({ dataCenterId: lockedDataCenter.id })
            await utils.supplier.listGpuInventory.invalidate()
          }
        }}
      />
    </div>
  )
}
