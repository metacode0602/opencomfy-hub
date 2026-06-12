'use client'

import { useState } from 'react'
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
import type { DatacenterDockingScope, SupplyChainLeadType } from '@/lib/supply-chain-leads/types'
import { trpc } from '@/lib/trpc/client'
import { useLocaleRouter } from '@/lib/i18n/navigation'

interface SupplyChainLeadCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: SupplyChainLeadType
  onCreated?: () => void
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

export function SupplyChainLeadCreateDialog({
  open,
  onOpenChange,
  defaultType = 'datacenter',
  onCreated,
}: SupplyChainLeadCreateDialogProps) {
  const router = useLocaleRouter()
  const utils = trpc.useUtils()
  const createMutation = trpc.supplier.supplyChainLeads.create.useMutation()

  const [type, setType] = useState<SupplyChainLeadType>(defaultType)
  const [name, setName] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [dockingScope, setDockingScope] = useState<DatacenterDockingScope>('normal')
  const [location, setLocation] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [source, setSource] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [description, setDescription] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('资源对接人')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [gpuRows, setGpuRows] = useState<GpuRow[]>([emptyGpuRow()])

  const reset = () => {
    setType(defaultType)
    setName('')
    setSupplierName('')
    setDockingScope('normal')
    setLocation('')
    setProvince('')
    setCity('')
    setSource('')
    setPriority('medium')
    setDescription('')
    setContactName('')
    setContactTitle('资源对接人')
    setContactPhone('')
    setContactEmail('')
    setGpuRows([emptyGpuRow()])
  }

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

    try {
      const lead = await createMutation.mutateAsync({
        type,
        name: name.trim(),
        priority,
        supplierNameText: type === 'datacenter' ? supplierName.trim() || undefined : undefined,
        dockingScope: type === 'datacenter' ? dockingScope : undefined,
        address: location.trim() || undefined,
        province: province.trim() || undefined,
        city: city.trim() || undefined,
        source: source.trim() || undefined,
        description: description.trim() || undefined,
        resourceContact: {
          name: contactName.trim(),
          title: contactTitle.trim() || undefined,
          phone: contactPhone.trim() || undefined,
          email: contactEmail.trim() || undefined,
        },
        gpuSnapshots: gpuSnapshots.length > 0 ? gpuSnapshots : undefined,
      })

      toast.success('线索登记成功')
      reset()
      onOpenChange(false)
      onCreated?.()
      void utils.supplier.supplyChainLeads.getById.invalidate({ id: lead.id })
      router.push(`/supplier/leads/${lead.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '登记失败')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-6xl min-w-[50vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>登记供应链线索</DialogTitle>
          <DialogDescription>
            登记供应商或机房线索，记录资源对接人与初步卡型库存信息。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>线索类型</Label>
              <Select value={type} onValueChange={(v) => setType(v as SupplyChainLeadType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">供应商</SelectItem>
                  <SelectItem value="datacenter">机房</SelectItem>
                </SelectContent>
              </Select>
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
            <Label>{type === 'supplier' ? '供应商名称' : '机房名称'} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：华东 A 区智算机房" />
          </div>

          {type === 'datacenter' && (
            <>
              <div className="space-y-2">
                <Label>所属供应商</Label>
                <Input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="如：星云算力科技"
                />
              </div>
              <div className="space-y-2">
                <Label>对接范围</Label>
                <Select
                  value={dockingScope}
                  onValueChange={(v) => setDockingScope(v as DatacenterDockingScope)}
                >
                  <SelectTrigger className="w-full">
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
              <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="江苏" />
            </div>
            <div className="space-y-2">
              <Label>城市</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="苏州" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>详细地址</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="工业园区星湖街 328 号" />
          </div>

          <div className="space-y-2">
            <Label>来源渠道</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="行业峰会 / 合作伙伴引荐" />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">资源对接人 *</p>
            <div className="grid grid-cols-2 gap-3">
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>卡型库存（可选）</Label>
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
                    placeholder="H800"
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
                    placeholder="7×24 / 工作日 9:00-18:00"
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
              placeholder="机房特点、合作意向、注意事项..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={createMutation.isPending}>
            登记线索
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
