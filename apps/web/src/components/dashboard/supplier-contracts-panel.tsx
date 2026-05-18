'use client'

import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { CreateSupplierContractDialog } from '@/components/dashboard/create-supplier-contract-dialog'
import { getSupplierContractsBySupplierId } from '@/lib/data/mock-data'
import type { Supplier, SupplierContract } from '@/lib/data/types'
import { contractPricingModeNames, statusColors } from '@/lib/data/types'
import { statusNames } from '@/components/dashboard/supplier-detail-constants'

interface SupplierContractsPanelProps {
  supplier: Supplier
}

export function SupplierContractsPanel({ supplier }: SupplierContractsPanelProps) {
  const [contracts, setContracts] = useState<SupplierContract[]>(() =>
    getSupplierContractsBySupplierId(supplier.id),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">合同管理</h2>
          <p className="text-sm text-muted-foreground">管理与供应商签署的合作合同</p>
        </div>
        <CreateSupplierContractDialog
          supplier={supplier}
          onCreated={(contract) => setContracts((prev) => [contract, ...prev])}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {contracts.map((contract) => (
          <Card key={contract.id} className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{contract.contractNo}</CardTitle>
                    <Badge variant="outline" className={statusColors[contract.status]}>
                      {statusNames[contract.status]}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">
                    {contract.type === 'cooperation'
                      ? '合作协议'
                      : contract.type === 'supplement'
                        ? '补充协议'
                        : '续签协议'}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>查看合同</DropdownMenuItem>
                    <DropdownMenuItem>下载合同</DropdownMenuItem>
                    <DropdownMenuItem>编辑合同</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    contract.cooperationMode === 'card_time'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  }
                >
                  {contractPricingModeNames[contract.pricingMode]}
                </Badge>
                {contract.revenueShareRatio && (
                  <span className="text-sm text-foreground">
                    分成比例: {contract.revenueShareRatio}%
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border text-sm">
                <div>
                  <p className="text-muted-foreground">合同期限</p>
                  <p className="text-foreground">
                    {contract.startDate} ~ {contract.endDate}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">签署日期</p>
                  <p className="text-foreground">{contract.signedAt || '待签署'}</p>
                </div>
              </div>

              {contract.signerName && (
                <div className="pt-3 border-t border-border text-sm">
                  <p className="text-muted-foreground">签署人</p>
                  <p className="text-foreground">{contract.signerName}</p>
                </div>
              )}

              <div className="pt-3 border-t border-border text-sm">
                <p className="text-muted-foreground">合同条款</p>
                <p className="text-foreground">{contract.terms}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
