'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Textarea } from '@workspace/ui/components/textarea'
import type { DataCenter } from '@/lib/data/types'
import {
  DATACENTER_SCALE_OPTIONS,
  type DatacenterScale,
} from '@/lib/types/datacenter-create'
import { trpc } from '@/lib/trpc/client'

export type EditDatacenterFormValues = {
  name: string
  address: string
  description: string
  location: string
  containerInstanceRegion: string
  bareMetalRegion: string
  scale: DatacenterScale | ''
  publicIpCount: string
  internalNetworkCidr: string
  networkFee: string
  managementNodeFee: string
  externalOnboardingId: string
}

function dataCenterToFormValues(dc: DataCenter): EditDatacenterFormValues {
  return {
    name: dc.name,
    address: dc.address ?? '',
    description: dc.description ?? '',
    location: dc.location ?? '',
    containerInstanceRegion: dc.containerInstanceRegion ?? '',
    bareMetalRegion: dc.bareMetalRegion ?? '',
    scale: (dc.scale as DatacenterScale | undefined) ?? '',
    publicIpCount: dc.publicIpCount != null ? String(dc.publicIpCount) : '',
    internalNetworkCidr: dc.internalNetworkCidr ?? '',
    networkFee: String(dc.networkFee ?? 0),
    managementNodeFee: String(dc.managementNodeFee ?? 0),
    externalOnboardingId: dc.externalOnboardingId ?? '',
  }
}

function validateForm(values: EditDatacenterFormValues): string | null {
  const name = values.name.trim()
  if (!name) return '请填写机房名称'

  if (!values.scale) return '请选择规模'

  if (values.publicIpCount.trim()) {
    if (!/^\d+$/.test(values.publicIpCount.trim())) {
      return '公网 IP 数量须为非负整数'
    }
  }

  for (const [label, raw] of [
    ['网络费用', values.networkFee],
    ['管控节点费用', values.managementNodeFee],
  ] as const) {
    const s = raw.trim()
    if (!s) continue
    const n = Number(s)
    if (!Number.isFinite(n) || n < 0) return `${label}须为非负数`
  }

  return null
}

function formValuesToInput(dataCenterId: string, values: EditDatacenterFormValues) {
  return {
    dataCenterId,
    name: values.name.trim(),
    address: values.address.trim() || undefined,
    description: values.description.trim() || undefined,
    location: values.location.trim() || undefined,
    containerInstanceRegion: values.containerInstanceRegion.trim() || undefined,
    bareMetalRegion: values.bareMetalRegion.trim() || undefined,
    scale: values.scale as DatacenterScale,
    publicIpCount: values.publicIpCount.trim()
      ? Number(values.publicIpCount.trim())
      : undefined,
    internalNetworkCidr: values.internalNetworkCidr.trim() || undefined,
    networkFee: Number(values.networkFee.trim() || '0'),
    managementNodeFee: Number(values.managementNodeFee.trim() || '0'),
    externalOnboardingId: values.externalOnboardingId.trim() || undefined,
  }
}

export type EditDatacenterDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataCenter: DataCenter | null
  onUpdated?: () => void
}

export function EditDatacenterDialog({
  open,
  onOpenChange,
  dataCenter,
  onUpdated,
}: EditDatacenterDialogProps) {
  const [values, setValues] = useState<EditDatacenterFormValues>(() =>
    dataCenter ? dataCenterToFormValues(dataCenter) : {
      name: '',
      address: '',
      description: '',
      location: '',
      containerInstanceRegion: '',
      bareMetalRegion: '',
      scale: '',
      publicIpCount: '',
      internalNetworkCidr: '',
      networkFee: '0',
      managementNodeFee: '0',
      externalOnboardingId: '',
    },
  )
  const [submitError, setSubmitError] = useState<string | null>(null)

  const updateMutation = trpc.supplier.updateDataCenter.useMutation({
    onSuccess: (result) => {
      toast.success(`机房「${result.dataCenter.name}」已更新`)
      onUpdated?.()
      onOpenChange(false)
    },
    onError: (error) => setSubmitError(error.message),
  })

  useEffect(() => {
    if (open && dataCenter) {
      setValues(dataCenterToFormValues(dataCenter))
      setSubmitError(null)
    }
  }, [open, dataCenter])

  const patch = (next: Partial<EditDatacenterFormValues>) => {
    setValues((prev) => ({ ...prev, ...next }))
    setSubmitError(null)
  }

  const handleSubmit = () => {
    if (!dataCenter) return
    const error = validateForm(values)
    if (error) {
      setSubmitError(error)
      return
    }

    updateMutation.mutate(formValuesToInput(dataCenter.id, values))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>编辑机房信息</DialogTitle>
          <DialogDescription>
            {dataCenter
              ? `修改「${dataCenter.name}」的基本信息与配套配置`
              : '修改机房基本信息'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          <section className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">基本信息</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-dc-name">
                  机房名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-dc-name"
                  value={values.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="如 北京亦庄数据中心"
                />
                {dataCenter && (
                  <p className="text-xs text-muted-foreground">
                    编码：<code className="rounded bg-muted px-1">{dataCenter.code}</code>（不可修改）
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dc-external-id">入驻系统 ID</Label>
                <Input
                  id="edit-dc-external-id"
                  value={values.externalOnboardingId}
                  onChange={(e) => patch({ externalOnboardingId: e.target.value })}
                  placeholder="可选，用于与算算力系统对齐"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-dc-address">地址</Label>
                <Input
                  id="edit-dc-address"
                  value={values.address}
                  onChange={(e) => patch({ address: e.target.value })}
                  placeholder="详细地址（可选）"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-dc-description">描述</Label>
                <Textarea
                  id="edit-dc-description"
                  value={values.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="机房说明、备注等"
                  rows={2}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">区域配置</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-dc-location">容器区域</Label>
                <Input
                  id="edit-dc-location"
                  value={values.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  placeholder="如 华北-北京-亦庄"
                />
                <p className="text-xs text-muted-foreground">
                  可选。若填写，须全局唯一，在弹性服务部署等容器应用中展示给用户的名称。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dc-container-region">容器实例区域</Label>
                <Input
                  id="edit-dc-container-region"
                  value={values.containerInstanceRegion}
                  onChange={(e) => patch({ containerInstanceRegion: e.target.value })}
                  placeholder="如 beijing-yizhuang"
                />
                <p className="text-xs text-muted-foreground">
                  可选。若填写，须全局唯一，将作为 Karmada 集群标签值（label value）使用。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dc-bare-metal-region">裸金属区域</Label>
                <Input
                  id="edit-dc-bare-metal-region"
                  value={values.bareMetalRegion}
                  onChange={(e) => patch({ bareMetalRegion: e.target.value })}
                  placeholder="如 华北-北京-亦庄"
                />
                <p className="text-xs text-muted-foreground">
                  可选。若填写，须全局唯一。
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">基础设施</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-dc-scale">
                  规模 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={values.scale || undefined}
                  onValueChange={(value) => patch({ scale: value as DatacenterScale })}
                >
                  <SelectTrigger id="edit-dc-scale">
                    <SelectValue placeholder="选择规模" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATACENTER_SCALE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dc-public-ip">公网 IP 数量</Label>
                <Input
                  id="edit-dc-public-ip"
                  type="number"
                  min={0}
                  value={values.publicIpCount}
                  onChange={(e) => patch({ publicIpCount: e.target.value })}
                  placeholder="非负整数"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-dc-cidr">内网网段</Label>
                <Input
                  id="edit-dc-cidr"
                  value={values.internalNetworkCidr}
                  onChange={(e) => patch({ internalNetworkCidr: e.target.value })}
                  placeholder="如 10.0.0.0/16"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">配套费用（月）</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-dc-network-fee">网络费用</Label>
                <Input
                  id="edit-dc-network-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.networkFee}
                  onChange={(e) => patch({ networkFee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dc-mgmt-fee">管控节点费用</Label>
                <Input
                  id="edit-dc-mgmt-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.managementNodeFee}
                  onChange={(e) => patch({ managementNodeFee: e.target.value })}
                />
              </div>
            </div>
          </section>
        </div>

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending || !dataCenter}>
            {updateMutation.isPending ? '保存中…' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
