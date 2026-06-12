'use client'

import { useEffect, useState } from 'react'
import {
  Building2,
  ChevronDown,
  Cpu,
  Edit,
  Eye,
  Factory,
  Loader2,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Server,
  User,
} from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Progress } from '@workspace/ui/components/progress'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { LocaleLink } from '@/lib/i18n/navigation'
import { ListPagination } from '@/components/shared/list-pagination'
import { trpc } from '@/lib/trpc/client'
import {
  DOCKING_SCOPE_COLORS,
  DOCKING_SCOPE_LABELS,
  LEAD_PRIORITY_COLORS,
  LEAD_PRIORITY_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  LEAD_TYPE_LABELS,
} from '@/lib/supply-chain-leads/constants'
import type { SupplyChainLeadListItemDto } from '@/lib/types/supply-chain-lead-api'
import type { SupplyChainLeadType } from '@/lib/supply-chain-leads/types'
import { SupplyChainLeadCreateDialog } from './supply-chain-lead-create-dialog'
import { SupplyChainLeadEditDialog } from './supply-chain-lead-edit-dialog'
import { cn } from '@workspace/ui/lib/utils'

function sumGpuStats(lead: SupplyChainLeadListItemDto) {
  return lead.gpuResources.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      idle: acc.idle + r.idle,
    }),
    { total: 0, idle: 0 },
  )
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return new Date(iso).toLocaleDateString('zh-CN')
}

function maskPhone(phone?: string | null) {
  if (!phone) return '—'
  if (phone.length >= 11) return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  return phone
}

export function SupplyChainLeadsContent() {
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [selectedCardTypes, setSelectedCardTypes] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [createType, setCreateType] = useState<SupplyChainLeadType>('datacenter')
  const [editingLead, setEditingLead] = useState<SupplyChainLeadListItemDto | null>(null)
  const pageSize = 20

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, typeFilter, statusFilter, priorityFilter, selectedCardTypes.join(',')])

  const { data: stats } = trpc.supplier.supplyChainLeads.stats.useQuery()
  const { data: cardTypeOptions = [] } =
    trpc.supplier.supplyChainLeads.listCardTypeFilterOptions.useQuery()

  const { data: listData, isLoading, isError } = trpc.supplier.supplyChainLeads.list.useQuery({
    search: debouncedSearch || undefined,
    type: typeFilter as 'supplier' | 'datacenter' | 'all',
    status: statusFilter as
      | 'new'
      | 'contacting'
      | 'evaluating'
      | 'negotiating'
      | 'converted'
      | 'lost'
      | 'all',
    priority: priorityFilter as 'high' | 'medium' | 'low' | 'all',
    cardTypeNames: selectedCardTypes.length > 0 ? selectedCardTypes : undefined,
    page,
    pageSize,
  })

  const items = listData?.items ?? []
  const totalItems = listData?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const cardTypeFilterLabel =
    selectedCardTypes.length === 0
      ? '全部卡型'
      : selectedCardTypes.length === 1
        ? selectedCardTypes[0]
        : `已选 ${selectedCardTypes.length} 种卡型`

  const toggleCardTypeFilter = (cardType: string, checked: boolean) => {
    setSelectedCardTypes((prev) =>
      checked ? [...prev, cardType] : prev.filter((t) => t !== cardType),
    )
  }

  const openCreate = (type: SupplyChainLeadType) => {
    setCreateType(type)
    setCreateOpen(true)
  }

  const handleCreated = () => {
    void utils.supplier.supplyChainLeads.list.invalidate()
    void utils.supplier.supplyChainLeads.stats.invalidate()
    void utils.supplier.supplyChainLeads.listCardTypeFilterOptions.invalidate()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">供应链线索</h1>
          <p className="text-muted-foreground mt-1">
            登记供应商与机房线索，实时掌握卡型库存、闲置资源与对接人信息
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCreate('supplier')}>
            <Factory className="w-4 h-4 mr-2" />
            登记供应商
          </Button>
          <Button onClick={() => openCreate('datacenter')}>
            <Plus className="w-4 h-4 mr-2" />
            登记机房
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">线索总数</p>
            <p className="text-2xl font-bold mt-1">{stats?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">跟进中</p>
            <p className="text-2xl font-bold mt-1 text-blue-400">{stats?.active ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">机房线索</p>
            <p className="text-2xl font-bold mt-1">{stats?.datacenters ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">供应商线索</p>
            <p className="text-2xl font-bold mt-1">{stats?.suppliers ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">机房 GPU 总量</p>
            <p className="text-2xl font-bold mt-1">
              {stats?.gpuTotal != null ? stats.gpuTotal.toLocaleString() : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">闲置 GPU</p>
            <p className="text-2xl font-bold mt-1 text-green-400">
              {stats?.gpuIdle != null ? stats.gpuIdle.toLocaleString() : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="搜索名称、供应商、城市..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-[130px]">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="datacenter">机房</SelectItem>
                <SelectItem value="supplier">供应商</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[130px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full lg:w-[120px]">
                <SelectValue placeholder="优先级" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部优先级</SelectItem>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full lg:w-auto justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <Cpu className="w-4 h-4 shrink-0" />
                    {cardTypeFilterLabel}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {cardTypeOptions.length === 0 ? (
                  <DropdownMenuItem disabled>暂无卡型数据</DropdownMenuItem>
                ) : (
                  cardTypeOptions.map((opt) => (
                    <DropdownMenuCheckboxItem
                      key={opt.name}
                      checked={selectedCardTypes.includes(opt.name)}
                      onCheckedChange={(checked) =>
                        toggleCardTypeFilter(opt.name, checked === true)
                      }
                      onSelect={(e) => e.preventDefault()}
                    >
                      {opt.name}
                    </DropdownMenuCheckboxItem>
                  ))
                )}
                {selectedCardTypes.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setSelectedCardTypes([])}>
                      清除筛选
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>线索</TableHead>
                  <TableHead>地区</TableHead>
                  <TableHead>对接范围</TableHead>
                  <TableHead>资源对接人</TableHead>
                  <TableHead>卡型 / 库存</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>跟进人</TableHead>
                  <TableHead>最近动态</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-destructive">
                      加载失败，请稍后重试
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      暂无线索，点击右上角登记
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((lead) => {
                    const gpu = sumGpuStats(lead)
                    const utilization =
                      gpu.total > 0 ? Math.round(((gpu.total - gpu.idle) / gpu.total) * 100) : 0

                    return (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              {lead.type === 'supplier' ? (
                                <Factory className="w-4 h-4 text-primary" />
                              ) : (
                                <Server className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <LocaleLink
                                href={`/supplier/leads/${lead.id}`}
                                className="font-medium hover:underline"
                              >
                                {lead.name}
                              </LocaleLink>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {LEAD_TYPE_LABELS[lead.type]}
                                </Badge>
                                {lead.supplierName && (
                                  <span className="text-xs text-muted-foreground truncate">
                                    {lead.supplierName}
                                  </span>
                                )}
                              </div>
                              {lead.tags.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {lead.tags.slice(0, 2).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span>
                              {[lead.province, lead.city].filter(Boolean).join(' ') || '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.type === 'datacenter' && lead.dockingScope ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'border font-medium text-xs whitespace-nowrap',
                                DOCKING_SCOPE_COLORS[lead.dockingScope],
                              )}
                            >
                              {DOCKING_SCOPE_LABELS[lead.dockingScope]}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              {lead.resourceContact.name}
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground text-xs mt-0.5">
                              <Phone className="w-3 h-3" />
                              {maskPhone(lead.resourceContact.phone)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {gpu.total > 0 ? (
                            <div className="space-y-1.5 min-w-[120px]">
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1">
                                  <Cpu className="w-3 h-3" />
                                  {lead.gpuResources.length} 种卡型
                                </span>
                                <span className="text-green-400">闲 {gpu.idle}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                共 {gpu.total} 卡 · 利用率 {utilization}%
                              </div>
                              <Progress value={utilization} className="h-1.5" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">待补充</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={cn('border font-medium', LEAD_STATUS_COLORS[lead.status])}
                            >
                              {LEAD_STATUS_LABELS[lead.status]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                'border font-medium text-xs',
                                LEAD_PRIORITY_COLORS[lead.priority],
                              )}
                            >
                              {LEAD_PRIORITY_LABELS[lead.priority]}优先
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{lead.ownerStaffName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatRelativeTime(lead.lastActivityAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <LocaleLink href={`/supplier/leads/${lead.id}`}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  查看详情
                                </LocaleLink>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <LocaleLink href={`/supplier/leads/${lead.id}?tab=timeline`}>
                                  <Building2 className="w-4 h-4 mr-2" />
                                  活动时间线
                                </LocaleLink>
                              </DropdownMenuItem>
                              {lead.status !== 'converted' && (
                                <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  编辑线索
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
          </div>

          <ListPagination
            className="mt-4"
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <SupplyChainLeadCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultType={createType}
        onCreated={handleCreated}
      />

      {editingLead && (
        <SupplyChainLeadEditDialog
          lead={editingLead}
          open={Boolean(editingLead)}
          onOpenChange={(open) => {
            if (!open) setEditingLead(null)
          }}
          onUpdated={handleCreated}
        />
      )}
    </div>
  )
}
