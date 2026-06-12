'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Cpu,
  Edit,
  Factory,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Server,
  Tag,
  User,
  Users,
} from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Progress } from '@workspace/ui/components/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { LocaleLink } from '@/lib/i18n/navigation'
import { trpc } from '@/lib/trpc/client'
import {
  DOCKING_SCOPE_COLORS,
  DOCKING_SCOPE_LABELS,
  getAuthorRoleLabel,
  LEAD_PRIORITY_COLORS,
  LEAD_PRIORITY_LABELS,
  LEAD_STAGE_STEPS,
  LEAD_STATUS_COLORS,
  LEAD_STATUS_LABELS,
  LEAD_TYPE_LABELS,
} from '@/lib/supply-chain-leads/constants'
import type { SupplyChainLeadContactDto } from '@/lib/types/supply-chain-lead-api'
import type { SupplyChainLeadStatus } from '@/lib/supply-chain-leads/types'
import { SupplyChainLeadEditDialog } from './supply-chain-lead-edit-dialog'
import { SupplyChainLeadTimelinePanel } from './supply-chain-lead-timeline-panel'
import { cn } from '@workspace/ui/lib/utils'
import { toast } from 'sonner'
import { getActivityIcon } from '@/components/dashboard/project-detail-utils'

interface SupplyChainLeadDetailContentProps {
  leadId: string
}

function ContactCard({
  title,
  contact,
}: {
  title: string
  contact: SupplyChainLeadContactDto
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <User className="w-4 h-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="font-medium text-base">{contact.name}</p>
        {contact.title && <p className="text-muted-foreground">{contact.title}</p>}
        {contact.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-3.5 h-3.5" />
            {contact.phone}
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            {contact.email}
          </div>
        )}
        {contact.wechat && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tag className="w-3.5 h-3.5" />
            微信：{contact.wechat}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SupplyChainLeadDetailContent({ leadId }: SupplyChainLeadDetailContentProps) {
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const validTabs = new Set(['overview', 'resources', 'timeline'])
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && validTabs.has(tabFromUrl) ? tabFromUrl : 'overview',
  )
  const [editOpen, setEditOpen] = useState(false)

  const utils = trpc.useUtils()
  const { data: lead, isLoading, isError } = trpc.supplier.supplyChainLeads.getById.useQuery({
    id: leadId,
  })
  const { data: activities = [] } = trpc.supplier.supplyChainLeads.listActivities.useQuery({
    leadId,
    limit: 20,
  })

  const updateStatusMutation = trpc.supplier.supplyChainLeads.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.supplier.supplyChainLeads.getById.invalidate({ id: leadId })
      await utils.supplier.supplyChainLeads.listActivities.invalidate({ leadId })
      await utils.supplier.supplyChainLeads.list.invalidate()
      toast.success('状态已更新')
    },
    onError: (e) => toast.error(e.message),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        加载线索详情...
      </div>
    )
  }

  if (isError || !lead) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <p className="text-muted-foreground">线索不存在或加载失败</p>
        <Button variant="outline" asChild>
          <LocaleLink href="/supplier/leads">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回列表
          </LocaleLink>
        </Button>
      </div>
    )
  }

  const gpuTotal = lead.gpuResources.reduce((s, r) => s + r.total, 0)
  const gpuIdle = lead.gpuResources.reduce((s, r) => s + r.idle, 0)
  const gpuInUse = lead.gpuResources.reduce((s, r) => s + r.inUse, 0)
  const utilization = gpuTotal > 0 ? Math.round((gpuInUse / gpuTotal) * 100) : 0

  const currentStageIndex = LEAD_STAGE_STEPS.findIndex((s) => s.key === lead.status)

  const handleStatusChange = (status: SupplyChainLeadStatus) => {
    updateStatusMutation.mutate({ leadId, status })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <LocaleLink href="/supplier/leads">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </LocaleLink>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {lead.type === 'supplier' ? (
                <Factory className="w-5 h-5 text-primary" />
              ) : (
                <Server className="w-5 h-5 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-bold">{lead.name}</h1>
            <Badge variant="secondary">{LEAD_TYPE_LABELS[lead.type]}</Badge>
            <Badge
              variant="outline"
              className={cn('border font-medium', LEAD_STATUS_COLORS[lead.status])}
            >
              {LEAD_STATUS_LABELS[lead.status]}
            </Badge>
            <Badge
              variant="outline"
              className={cn('border font-medium', LEAD_PRIORITY_COLORS[lead.priority])}
            >
              {LEAD_PRIORITY_LABELS[lead.priority]}优先
            </Badge>
            {lead.code && (
              <Badge variant="outline" className="font-mono text-xs">
                {lead.code}
              </Badge>
            )}
            {lead.type === 'datacenter' && lead.dockingScope && (
              <Badge
                variant="outline"
                className={cn('border font-medium', DOCKING_SCOPE_COLORS[lead.dockingScope])}
              >
                {DOCKING_SCOPE_LABELS[lead.dockingScope]}
              </Badge>
            )}
          </div>
          {lead.supplierName && (
            <p className="text-muted-foreground mt-1">所属供应商：{lead.supplierName}</p>
          )}
          {lead.description && (
            <p className="text-muted-foreground mt-2 max-w-3xl">{lead.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {lead.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {lead.status !== 'converted' && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              编辑
            </Button>
          )}
          <Select value={lead.status} onValueChange={(v) => handleStatusChange(v as typeof lead.status)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <SupplyChainLeadEditDialog
        lead={lead}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={() => void utils.supplier.supplyChainLeads.getById.invalidate({ id: leadId })}
      />

      {/* 阶段进度 */}
      {lead.status !== 'lost' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
              {LEAD_STAGE_STEPS.map((step, index) => {
                const isActive = index <= currentStageIndex
                const isCurrent = step.key === lead.status
                return (
                  <div key={step.key} className="flex items-center flex-1 min-w-[80px]">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2',
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted text-muted-foreground border-border',
                          isCurrent && 'ring-2 ring-primary/30',
                        )}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={cn(
                          'text-xs mt-2 text-center',
                          isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {step.name}
                      </span>
                    </div>
                    {index < LEAD_STAGE_STEPS.length - 1 && (
                      <div
                        className={cn(
                          'h-0.5 flex-1 mx-1',
                          index < currentStageIndex ? 'bg-primary' : 'bg-border',
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 资源概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">GPU 总量</p>
            <p className="text-2xl font-bold mt-1">{gpuTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">闲置数量</p>
            <p className="text-2xl font-bold mt-1 text-green-400">{gpuIdle.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">使用中</p>
            <p className="text-2xl font-bold mt-1">{gpuInUse.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">利用率</p>
            <p className="text-2xl font-bold mt-1">{utilization}%</p>
            <Progress value={utilization} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="resources">卡型库存</TabsTrigger>
          <TabsTrigger value="timeline">活动时间线</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">基本信息</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">跟进人</p>
                    <p className="font-medium mt-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {lead.ownerStaffName}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">来源渠道</p>
                    <p className="font-medium mt-1">{lead.source ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">地区</p>
                    <p className="font-medium mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {[lead.province, lead.city].filter(Boolean).join(' ') || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">详细地址</p>
                    <p className="font-medium mt-1">{lead.location ?? '—'}</p>
                  </div>
                  {lead.type === 'datacenter' && lead.dockingScope && (
                    <div>
                      <p className="text-muted-foreground">对接范围</p>
                      <p className="font-medium mt-1">
                        {DOCKING_SCOPE_LABELS[lead.dockingScope]}
                      </p>
                    </div>
                  )}
                  {lead.estimatedOnlineDate && (
                    <div>
                      <p className="text-muted-foreground">预计上线</p>
                      <p className="font-medium mt-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {lead.estimatedOnlineDate}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">登记时间</p>
                    <p className="font-medium mt-1">
                      {new Date(lead.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {lead.gpuResources.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cpu className="w-4 h-4" />
                      卡型速览
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {lead.gpuResources.map((r) => {
                        const usedPct = r.total > 0 ? Math.round((r.inUse / r.total) * 100) : 0
                        return (
                          <div key={r.cardType} className="space-y-1">
                            <div className="flex items-center justify-between text-sm gap-2">
                              <span className="font-medium">{r.cardType}</span>
                              <span className="text-muted-foreground shrink-0">
                                闲 <span className="text-green-400">{r.idle}</span> / 共 {r.total}
                              </span>
                            </div>
                            {r.availableTime && (
                              <p className="text-xs text-muted-foreground">
                                可用时间：{r.availableTime}
                              </p>
                            )}
                            <Progress value={usedPct} className="h-2" />
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <ContactCard title="资源对接人" contact={lead.resourceContact} />
              {lead.businessContact && (
                <ContactCard title="商务对接人" contact={lead.businessContact} />
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">最近动态</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {activities.slice(0, 4).map((activity) => {
                      const Icon = getActivityIcon(activity.type)
                      return (
                        <div key={activity.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{activity.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {getAuthorRoleLabel(activity.authorRole)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {activity.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {activity.author} ·{' '}
                              {new Date(activity.createdAt).toLocaleDateString('zh-CN')}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                    {activities.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">暂无动态</p>
                    )}
                    {activities.length > 0 && (
                      <Button
                        variant="link"
                        className="w-full p-0 h-auto"
                        onClick={() => setActiveTab('timeline')}
                      >
                        查看全部动态
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">卡型库存明细</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.gpuResources.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">暂无卡型数据</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>卡型</TableHead>
                        <TableHead className="text-right">总数</TableHead>
                        <TableHead className="text-right">闲置</TableHead>
                        <TableHead className="text-right">预留</TableHead>
                        <TableHead className="text-right">使用中</TableHead>
                        <TableHead className="text-right">利用率</TableHead>
                        <TableHead className="text-right">参考单价</TableHead>
                        <TableHead>可用时间</TableHead>
                        <TableHead>备注</TableHead>
                        <TableHead>更新时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lead.gpuResources.map((r) => {
                        const pct = r.total > 0 ? Math.round((r.inUse / r.total) * 100) : 0
                        return (
                          <TableRow key={r.cardType}>
                            <TableCell className="font-medium">{r.cardType}</TableCell>
                            <TableCell className="text-right">{r.total}</TableCell>
                            <TableCell className="text-right text-green-400">{r.idle}</TableCell>
                            <TableCell className="text-right">{r.reserved}</TableCell>
                            <TableCell className="text-right">{r.inUse}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress value={pct} className="h-1.5 w-16" />
                                <span className="text-xs w-8">{pct}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {r.unitPrice != null ? `¥${r.unitPrice}/时` : '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {r.availableTime ?? '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate">
                              {r.notes ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(r.updatedAt).toLocaleDateString('zh-CN')}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <SupplyChainLeadTimelinePanel leadId={lead.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
