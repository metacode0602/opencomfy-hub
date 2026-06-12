'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
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
import { DOCKING_SCOPE_LABELS } from '@/lib/supply-chain-leads/constants'
import type { DatacenterDockingScope } from '@/lib/supply-chain-leads/types'
import type { SupplyChainLeadListItemDto } from '@/lib/types/supply-chain-lead-api'
import { trpc } from '@/lib/trpc/client'

interface SupplyChainLeadEditDialogProps {
  lead: SupplyChainLeadListItemDto
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

type GpuRow = {
  cardType: string
  total: string
  idle: string
  availableTime: string
}

const emptyGpuRow = (): GpuRow => ({
  cardType: '',
  total: '',
  idle: '',
  availableTime: '',
})

function leadToFormState(lead: SupplyChainLeadListItemDto) {
  const gpuRows =
    lead.gpuResources.length > 0
      ? lead.gpuResources.map((r) => ({
          cardType: r.cardType,
          total: String(r.total),
          idle: String(r.idle),
          availableTime: r.availableTime ?? '',
        }))
      : [emptyGpuRow()]

  return {
    name: lead.name,
    supplierName: lead.supplierName ?? '',
    dockingScope: (lead.dockingScope ?? 'normal') as DatacenterDockingScope,
    location: lead.location ?? '',
    province: lead.province ?? '',
    city: lead.city ?? '',
    source: lead.source ?? '',
    priority: lead.priority,
    description: lead.description ?? '',
    estimatedOnlineDate: lead.estimatedOnlineDate ?? '',
    contactName: lead.resourceContact.name,
    contactTitle: lead.resourceContact.title ?? '资源对接人',
    contactPhone: lead.resourceContact.phone ?? '',
    contactEmail: lead.resourceContact.email ?? '',
    businessName: lead.businessContact?.name ?? '',
    businessTitle: lead.businessContact?.title ?? '',
    businessPhone: lead.businessContact?.phone ?? '',
    businessEmail: lead.businessContact?.email ?? '',
    tagsText: lead.tags.join('、'),
    gpuRows,
  }
}

export function SupplyChainLeadEditDialog({
  lead,
  open,
  onOpenChange,
  onUpdated,
}: SupplyChainLeadEditDialogProps) {
  const utils = trpc.useUtils()
  const updateMutation = trpc.supplier.supplyChainLeads.update.useMutation()

  const [name, setName] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [dockingScope, setDockingScope] = useState<DatacenterDockingScope>('normal')
  const [location, setLocation] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [source, setSource] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [description, setDescription] = useState('')
  const [estimatedOnlineDate, setEstimatedOnlineDate] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('资源对接人')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [businessTitle, setBusinessTitle] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [gpuRows, setGpuRows] = useState<GpuRow[]>([emptyGpuRow()])

  useEffect(() => {
    if (!open) return
    const s = leadToFormState(lead)
    setName(s.name)
    setSupplierName(s.supplierName)
    setDockingScope(s.dockingScope)
    setLocation(s.location)
    setProvince(s.province)
    setCity(s.city)
    setSource(s.source)
    setPriority(s.priority)
    setDescription(s.description)
    setEstimatedOnlineDate(s.estimatedOnlineDate)
    setContactName(s.contactName)
    setContactTitle(s.contactTitle)
    setContactPhone(s.contactPhone)
    setContactEmail(s.contactEmail)
    setBusinessName(s.businessName)
    setBusinessTitle(s.businessTitle)
    setBusinessPhone(s.businessPhone)
    setBusinessEmail(s.businessEmail)
    setTagsText(s.tagsText)
    setGpuRows(s.gpuRows)
  }, [open, lead])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('请填写名称')
      return
    }
    if (!contactName.trim()) {
      toast.error('请填写资源对接人')
      return
    }

    const gpuSnapshots = gpuRows
      .filter((r) => r.cardType.trim() && r.total.trim())
      .map((r) => {
        const total = Number(r.total) || 0
        const idle = Number(r.idle) || 0
        return {
          cardType: r.cardType.trim(),
          total,
          idle,
          reserved: 0,
          inUse: Math.max(0, total - idle),
          availableTime: r.availableTime.trim() || undefined,
        }
      })

    const tags = tagsText
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean)

    try {
      await updateMutation.mutateAsync({
        leadId: lead.id,
        name: name.trim(),
        priority,
        supplierNameText: lead.type === 'datacenter' ? supplierName.trim() || undefined : undefined,
        dockingScope: lead.type === 'datacenter' ? dockingScope : undefined,
        address: location.trim() || undefined,
        province: province.trim() || undefined,
        city: city.trim() || undefined,
        source: source.trim() || undefined,
        description: description.trim() || undefined,
        estimatedOnlineDate: estimatedOnlineDate.trim() || undefined,
        resourceContact: {
          name: contactName.trim(),
          title: contactTitle.trim() || undefined,
          phone: contactPhone.trim() || undefined,
          email: contactEmail.trim() || undefined,
        },
        businessContact: businessName.trim()
          ? {
              name: businessName.trim(),
              title: businessTitle.trim() || undefined,
              phone: businessPhone.trim() || undefined,
              email: businessEmail.trim() || undefined,
            }
          : undefined,
        gpuSnapshots: gpuSnapshots.length > 0 ? gpuSnapshots : undefined,
        tags: tags.length > 0 ? tags : [],
      })

      toast.success('线索已更新')
      onOpenChange(false)
      onUpdated?.()
      await utils.supplier.supplyChainLeads.getById.invalidate({ id: lead.id })
      await utils.supplier.supplyChainLeads.list.invalidate()
      await utils.supplier.supplyChainLeads.stats.invalidate()
      await utils.supplier.supplyChainLeads.listCardTypeFilterOptions.invalidate()
      await utils.supplier.supplyChainLeads.listActivities.invalidate({ leadId: lead.id })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败')
    }
  }

  const isConverted = lead.status === 'converted'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl min-w-[50vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑供应链线索</DialogTitle>
          <DialogDescription>
            修改线索基本信息、对接人与卡型库存。已转正线索不可编辑。
          </DialogDescription>
        </DialogHeader>

        {isConverted ? (
          <p className="text-sm text-muted-foreground py-4">该线索已转正，无法继续编辑。</p>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>线索类型</Label>
                <Input value={lead.type === 'supplier' ? '供应商' : '机房'} disabled />
              </div>
              <div className="space-y-2">
                <Label>优先级</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{lead.type === 'supplier' ? '供应商名称' : '机房名称'} *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {lead.type === 'datacenter' && (
              <>
                <div className="space-y-2">
                  <Label>所属供应商</Label>
                  <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>对接范围</Label>
                  <Select
                    value={dockingScope}
                    onValueChange={(v) => setDockingScope(v as DatacenterDockingScope)}
                  >
                    <SelectTrigger className="w-full" >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOCKING_SCOPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>省份</Label>
                <Input value={province} onChange={(e) => setProvince(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>城市</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>详细地址</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>来源渠道</Label>
                <Input value={source} onChange={(e) => setSource(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>预计上线</Label>
                <Input
                  type="date"
                  value={estimatedOnlineDate}
                  onChange={(e) => setEstimatedOnlineDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>标签</Label>
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                placeholder="多个标签用顿号或逗号分隔"
              />
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">资源对接人 *</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">姓名</Label>
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">职务</Label>
                  <Input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">手机</Label>
                  <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">邮箱</Label>
                  <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-medium">商务对接人（选填）</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">姓名</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">职务</Label>
                  <Input value={businessTitle} onChange={(e) => setBusinessTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">手机</Label>
                  <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">邮箱</Label>
                  <Input value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>卡型库存</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGpuRows((rows) => [...rows, emptyGpuRow()])}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加卡型
                </Button>
              </div>
              {gpuRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_72px_72px_1fr_32px] gap-2 items-end"
                >
                  <div className="space-y-1">
                    {idx === 0 && <Label className="text-xs text-muted-foreground">卡型</Label>}
                    <Input
                      value={row.cardType}
                      onChange={(e) =>
                        setGpuRows((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, cardType: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    {idx === 0 && <Label className="text-xs text-muted-foreground">总数</Label>}
                    <Input
                      type="number"
                      min={0}
                      value={row.total}
                      onChange={(e) =>
                        setGpuRows((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, total: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    {idx === 0 && <Label className="text-xs text-muted-foreground">闲置</Label>}
                    <Input
                      type="number"
                      min={0}
                      value={row.idle}
                      onChange={(e) =>
                        setGpuRows((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, idle: e.target.value } : r)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    {idx === 0 && (
                      <Label className="text-xs text-muted-foreground">可用时间（选填）</Label>
                    )}
                    <Input
                      value={row.availableTime}
                      onChange={(e) =>
                        setGpuRows((rows) =>
                          rows.map((r, i) =>
                            i === idx ? { ...r, availableTime: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={gpuRows.length <= 1}
                    onClick={() => setGpuRows((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>备注说明</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {!isConverted && (
            <Button onClick={() => void handleSubmit()} disabled={updateMutation.isPending}>
              保存
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
