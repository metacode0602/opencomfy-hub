'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Download,
  ExternalLink,
  Factory,
  FileText,
  Layers,
  MoreHorizontal,
  Percent,
  Search,
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
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import type { ContractPricingTier, ContractPricingMode, CooperationMode, SupplierContract } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import {
  contractPricingModeNames,
  isSharePricingMode,
  statusColors,
} from '@/lib/data/types'

const contractStatusNames: Record<SupplierContract['status'], string> = {
  draft: '草稿',
  pending: '待签署',
  active: '生效中',
  expired: '已过期',
  terminated: '已终止',
}

const contractTypeNames: Record<SupplierContract['type'], string> = {
  cooperation: '合作协议',
  supplement: '补充协议',
  renewal: '续签协议',
}

const settlementCycleNames = {
  monthly: '按月结算',
  quarterly: '按季结算',
} as const

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-CN')
}

function pricingModeBadgeClass(mode: ContractPricingMode) {
  if (mode === 'card_time' || mode === 'tiered_card_time') {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  }
  return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
}

function pricingSummary(contract: SupplierContract) {
  const mode = contract.pricingMode
  if (mode === 'card_time' && contract.unitPricePerHour != null) {
    return `¥${contract.unitPricePerHour}/小时`
  }
  if (mode === 'revenue_share' && contract.revenueShareRatio != null) {
    return `${contract.revenueShareRatio}% 分成`
  }
  if (mode === 'tiered_card_time' || mode === 'tiered_revenue_share') {
    const tiers = contract.pricingTiers?.length ?? 0
    return `${tiers} 档阶梯`
  }
  return '—'
}

const ACCEPT_CONTRACT_FILE = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const emptyTier = (order: number): ContractPricingTier => ({
  tierOrder: order,
  thresholdFromHours: order === 1 ? 0 : 0,
  thresholdToHours: null,
  unitPricePerHour: undefined,
  revenueSharePercent: undefined,
})

type CreateContractForm = {
  contractNo: string
  supplierId: string
  type: SupplierContract['type']
  status: SupplierContract['status']
  pricingMode: ContractPricingMode
  startDate: string
  endDate: string
  terms: string
  unitPricePerHour: string
  revenueShareRatio: string
  minCommitHours: string
  settlementCycle: '' | 'monthly' | 'quarterly'
  signerName: string
  signedAt: string
}

const defaultCreateForm = (): CreateContractForm => ({
  contractNo: '',
  supplierId: '',
  type: 'cooperation',
  status: 'draft',
  pricingMode: 'card_time',
  startDate: '',
  endDate: '',
  terms: '',
  unitPricePerHour: '',
  revenueShareRatio: '',
  minCommitHours: '',
  settlementCycle: '',
  signerName: '',
  signedAt: '',
})

function cooperationModeFromPricing(pricingMode: ContractPricingMode): CooperationMode {
  return isSharePricingMode(pricingMode) ? 'revenue_share' : 'card_time'
}

export function ContractsContent() {
  const { data: contracts = [], isLoading } = trpc.supplier.listAllContracts.useQuery()
  const { data: suppliers = [] } = trpc.supplier.list.useQuery()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [pricingModeFilter, setPricingModeFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedId) ?? null,
    [contracts, selectedId],
  )

  const filteredContracts = contracts.filter((c) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      c.contractNo.toLowerCase().includes(q) ||
      c.supplierName.toLowerCase().includes(q) ||
      c.terms.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    const matchesSupplier = supplierFilter === 'all' || c.supplierId === supplierFilter
    const matchesMode = pricingModeFilter === 'all' || c.pricingMode === pricingModeFilter
    const matchesType = typeFilter === 'all' || c.type === typeFilter
    return matchesSearch && matchesStatus && matchesSupplier && matchesMode && matchesType
  })

  const stats = useMemo(() => {
    return {
      total: contracts.length,
      active: contracts.filter((c) => c.status === 'active').length,
      pending: contracts.filter((c) => c.status === 'pending' || c.status === 'draft').length,
      tiered: contracts.filter(
        (c) => c.pricingMode === 'tiered_card_time' || c.pricingMode === 'tiered_revenue_share',
      ).length,
    }
  }, [contracts])

  const openDetail = (id: string) => {
    setSelectedId(id)
    setView('detail')
  }

  const backToList = () => {
    setView('list')
    setSelectedId(null)
  }

  if (view === 'detail' && selectedContract) {
    return <ContractDetailView contract={selectedContract} onBack={backToList} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">商务合同</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理供应商合作协议，约定卡时价、分成比例及阶梯计价条款
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">合同总数</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.active}</p>
            <p className="text-xs text-muted-foreground">生效中</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">草稿 / 待签署</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-semibold text-foreground">{stats.tiered}</p>
            <p className="text-xs text-muted-foreground">阶梯计价合同</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索合同编号、供应商、条款..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(contractStatusNames).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
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
            <Select value={pricingModeFilter} onValueChange={setPricingModeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="计价方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部计价</SelectItem>
                {Object.entries(contractPricingModeNames).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {Object.entries(contractTypeNames).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">合同编号</TableHead>
              <TableHead className="text-muted-foreground">供应商</TableHead>
              <TableHead className="text-muted-foreground">类型</TableHead>
              <TableHead className="text-muted-foreground">计价方式</TableHead>
              <TableHead className="text-muted-foreground">价格 / 分成</TableHead>
              <TableHead className="text-muted-foreground">合同期限</TableHead>
              <TableHead className="text-muted-foreground">状态</TableHead>
              <TableHead className="text-muted-foreground w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="border-border">
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  加载合同列表…
                </TableCell>
              </TableRow>
            ) : filteredContracts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                  暂无匹配的合同
                </TableCell>
              </TableRow>
            ) : (
              filteredContracts.map((contract) => (
                <TableRow
                  key={contract.id}
                  className="border-border cursor-pointer"
                  onClick={() => openDetail(contract.id)}
                >
                  <TableCell className="font-medium text-foreground">{contract.contractNo}</TableCell>
                  <TableCell>
                    <Link
                      href={`/supplier/${contract.supplierId}`}
                      className="text-sm text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contract.supplierName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-foreground">{contractTypeNames[contract.type]}</TableCell>
                  <TableCell>
                    <PricingModeBadge mode={contract.pricingMode} />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {pricingSummary(contract)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(contract.startDate)} ~ {formatDate(contract.endDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[contract.status]}>
                      {contractStatusNames[contract.status]}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetail(contract.id)}>
                          查看详情
                        </DropdownMenuItem>
                        {contract.contractFileUrl && (
                          <DropdownMenuItem asChild>
                            <a href={contract.contractFileUrl} target="_blank" rel="noreferrer">
                              <Download className="w-4 h-4 mr-2" />
                              下载合同
                            </a>
                          </DropdownMenuItem>
                        )}
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
  )
}

function PricingModeBadge({ mode }: { mode: ContractPricingMode }) {
  return (
    <Badge variant="outline" className={pricingModeBadgeClass(mode)}>
      {contractPricingModeNames[mode]}
    </Badge>
  )
}

function ContractDetailView({
  contract,
  onBack,
}: {
  contract: SupplierContract
  onBack: () => void
}) {
  const isTiered =
    contract.pricingMode === 'tiered_card_time' || contract.pricingMode === 'tiered_revenue_share'
  const isShare = isSharePricingMode(contract.pricingMode)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="mt-1" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold text-foreground">{contract.contractNo}</h1>
              <Badge variant="outline" className={statusColors[contract.status]}>
                {contractStatusNames[contract.status]}
              </Badge>
              <Badge variant="secondary">{contractTypeNames[contract.type]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <Factory className="w-4 h-4" />
              <Link href={`/supplier/${contract.supplierId}`} className="text-primary hover:underline">
                {contract.supplierName}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contract.contractFileUrl && (
            <Button variant="outline" asChild>
              <a href={contract.contractFileUrl} target="_blank" rel="noreferrer">
                <Download className="w-4 h-4 mr-2" />
                下载合同
              </a>
            </Button>
          )}
          <Button variant="outline" disabled>
            编辑合同
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">计价方式</p>
            <div className="mt-2">
              <PricingModeBadge mode={contract.pricingMode} />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">核心条款</p>
            <p className="text-xl font-semibold text-foreground mt-1">{pricingSummary(contract)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">合同期限</p>
            <p className="text-sm font-medium text-foreground mt-2 flex items-center gap-1">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">合同信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">合同 ID</span>
              <code className="text-foreground">{contract.id}</code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">签署日期</span>
              <span className="text-foreground">{formatDate(contract.signedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">签署人</span>
              <span className="text-foreground">{contract.signerName ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">结算周期</span>
              <span className="text-foreground">
                {contract.settlementCycle
                  ? settlementCycleNames[contract.settlementCycle]
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">最低承诺卡时</span>
              <span className="text-foreground">
                {contract.minCommitHours != null
                  ? `${contract.minCommitHours.toLocaleString()} 小时/月`
                  : '—'}
              </span>
            </div>
            {contract.contractFileUrl && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">合同附件</span>
                <a
                  href={contract.contractFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                >
                  查看 PDF
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {isTiered ? <Layers className="w-4 h-4" /> : isShare ? <Percent className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              计价条款
            </CardTitle>
            <CardDescription>
              {contractPricingModeNames[contract.pricingMode]}约定明细
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PricingTermsBody contract={contract} />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">合同条款摘要</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground leading-relaxed">{contract.terms}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function PricingTermsBody({ contract }: { contract: SupplierContract }) {
  const isTiered =
    contract.pricingMode === 'tiered_card_time' || contract.pricingMode === 'tiered_revenue_share'
  const isShare = isSharePricingMode(contract.pricingMode)

  if (isTiered && contract.pricingTiers && contract.pricingTiers.length > 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">档位</TableHead>
            <TableHead className="text-muted-foreground">累计卡时区间</TableHead>
            <TableHead className="text-muted-foreground">
              {isShare ? '分成比例' : '卡时单价'}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...contract.pricingTiers]
            .sort((a, b) => a.tierOrder - b.tierOrder)
            .map((tier) => (
              <TableRow key={tier.tierOrder} className="border-border">
                <TableCell className="font-medium">第 {tier.tierOrder} 档</TableCell>
                <TableCell className="text-foreground">
                  {(tier.thresholdFromHours ?? 0).toLocaleString()} 小时
                  {tier.thresholdToHours != null
                    ? ` ~ ${tier.thresholdToHours.toLocaleString()} 小时`
                    : ' 及以上'}
                </TableCell>
                <TableCell className="font-semibold text-foreground">
                  {isShare
                    ? `${tier.revenueSharePercent ?? '—'}%`
                    : tier.unitPricePerHour != null
                      ? `¥${tier.unitPricePerHour}/小时`
                      : '—'}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    )
  }

  if (contract.pricingMode === 'card_time') {
    return (
      <div className="rounded-lg border border-border p-4 bg-muted/20">
        <p className="text-sm text-muted-foreground">固定卡时单价</p>
        <p className="text-3xl font-semibold text-foreground mt-2">
          {contract.unitPricePerHour != null ? `¥${contract.unitPricePerHour}` : '—'}
          <span className="text-base font-normal text-muted-foreground ml-1">/ 小时</span>
        </p>
      </div>
    )
  }

  if (contract.pricingMode === 'revenue_share') {
    return (
      <div className="rounded-lg border border-border p-4 bg-muted/20">
        <p className="text-sm text-muted-foreground">供应商分成比例</p>
        <p className="text-3xl font-semibold text-foreground mt-2">
          {contract.revenueShareRatio != null ? `${contract.revenueShareRatio}%` : '—'}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          按客户实际消费金额 × 分成比例结算
        </p>
      </div>
    )
  }

  return <p className="text-sm text-muted-foreground">暂无计价条款配置</p>
}

