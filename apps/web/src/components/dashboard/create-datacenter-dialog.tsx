'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
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
import type { DataCenter, Supplier } from '@/lib/data/types'
import {
  DATACENTER_SCALE_OPTIONS,
  type DatacenterScale,
} from '@/lib/types/datacenter-create'
import {
  deriveDatacenterCode,
  normalizeDatacenterName,
} from '@/lib/supplier/datacenter-import-utils'
import type { DatacenterImportParsedRow } from '@/lib/types/datacenter-import'
import { trpc } from '@/lib/trpc/client'

export type CreateDatacenterFormValues = {
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

function emptyFormValues(): CreateDatacenterFormValues {
  return {
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
  }
}

function previewCode(name: string, externalOnboardingId: string, existingCodes: Set<string>): string {
  const row: DatacenterImportParsedRow = {
    row_no: 0,
    name: name.trim(),
    external_onboarding_id: externalOnboardingId.trim() || undefined,
    field_warnings: [],
  }
  return deriveDatacenterCode(row, existingCodes)
}

function validateForm(
  values: CreateDatacenterFormValues,
  existingNames: Set<string>,
  allDataCenters: Pick<
    DataCenter,
    'name' | 'location' | 'containerInstanceRegion' | 'bareMetalRegion'
  >[],
): string | null {
  const name = values.name.trim()
  if (!name) return '请填写机房名称'

  const normName = normalizeDatacenterName(name)
  if (existingNames.has(normName)) return '机房名称已存在，请使用唯一名称'

  const location = values.location.trim()
  if (location) {
    const hit = allDataCenters.find((dc) => dc.location?.trim() === location)
    if (hit) {
      return `容器区域「${location}」已被机房「${hit.name}」使用，请填写唯一名称`
    }
  }

  const containerRegion = values.containerInstanceRegion.trim()
  if (containerRegion) {
    const hit = allDataCenters.find((dc) => dc.containerInstanceRegion?.trim() === containerRegion)
    if (hit) {
      return `容器实例区域「${containerRegion}」已被机房「${hit.name}」使用，请填写唯一的 Karmada 标签值`
    }
  }

  const bareMetalRegion = values.bareMetalRegion.trim()
  if (bareMetalRegion) {
    const hit = allDataCenters.find((dc) => dc.bareMetalRegion?.trim() === bareMetalRegion)
    if (hit) {
      return `裸金属区域「${bareMetalRegion}」已被机房「${hit.name}」使用，请填写唯一名称`
    }
  }

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

function formValuesToInput(values: CreateDatacenterFormValues, supplierId: string) {
  return {
    supplierId,
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

export type CreateDatacenterDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Pick<Supplier, 'id' | 'name' | 'shortName'>
  existingDataCenters?: Pick<DataCenter, 'name' | 'code'>[]
  onCreated?: () => void
}

export function CreateDatacenterDialog({
  open,
  onOpenChange,
  supplier,
  existingDataCenters = [],
  onCreated,
}: CreateDatacenterDialogProps) {
  const [values, setValues] = useState(emptyFormValues)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: allDataCenters = [] } = trpc.supplier.listAllDataCenters.useQuery({}, {
    enabled: open,
  })

  const createMutation = trpc.supplier.createDataCenter.useMutation({
    onSuccess: (result) => {
      toast.success(`机房「${result.dataCenter.name}」已创建`, {
        description: `编码 ${result.dataCenter.code}`,
      })
      onCreated?.()
      onOpenChange(false)
    },
    onError: (error) => setSubmitError(error.message),
  })

  const existingCodes = useMemo(
    () => new Set(existingDataCenters.map((dc) => dc.code)),
    [existingDataCenters],
  )
  const existingNames = useMemo(
    () => new Set(existingDataCenters.map((dc) => normalizeDatacenterName(dc.name))),
    [existingDataCenters],
  )

  const derivedCodePreview = useMemo(
    () =>
      values.name.trim()
        ? previewCode(values.name, values.externalOnboardingId, existingCodes)
        : '',
    [values.name, values.externalOnboardingId, existingCodes],
  )

  useEffect(() => {
    if (open) {
      setValues(emptyFormValues())
      setSubmitError(null)
    }
  }, [open])

  const patch = (next: Partial<CreateDatacenterFormValues>) => {
    setValues((prev) => ({ ...prev, ...next }))
    setSubmitError(null)
  }

  const handleSubmit = () => {
    const error = validateForm(values, existingNames, allDataCenters)
    if (error) {
      setSubmitError(error)
      return
    }

    createMutation.mutate(formValuesToInput(values, supplier.id))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-[40vw] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>新增机房</DialogTitle>
          <DialogDescription>
            为供应商「{supplier.shortName || supplier.name}」创建数据中心
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-1">
          <section className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">基本信息</h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="create-dc-name">
                  机房名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="create-dc-name"
                  value={values.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="如 北京亦庄数据中心"
                />
                {derivedCodePreview && (
                  <p className="text-xs text-muted-foreground">
                    预览编码：<code className="rounded bg-muted px-1">{derivedCodePreview}</code>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-dc-external-id">入驻系统 ID</Label>
                <Input
                  id="create-dc-external-id"
                  value={values.externalOnboardingId}
                  onChange={(e) => patch({ externalOnboardingId: e.target.value })}
                  placeholder="可选，用于与算算力系统对齐"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-dc-address">地址</Label>
                <Input
                  id="create-dc-address"
                  value={values.address}
                  onChange={(e) => patch({ address: e.target.value })}
                  placeholder="详细地址（可选）"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-dc-description">描述</Label>
                <Textarea
                  id="create-dc-description"
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
                <Label htmlFor="create-dc-location">容器区域</Label>
                <Input
                  id="create-dc-location"
                  value={values.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  placeholder="如 华北-北京-亦庄"
                />
                <p className="text-xs text-muted-foreground">
                  可选。若填写，须全局唯一，在弹性服务部署等容器应用中展示给用户的名称。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-dc-container-region">容器实例区域</Label>
                <Input
                  id="create-dc-container-region"
                  value={values.containerInstanceRegion}
                  onChange={(e) => patch({ containerInstanceRegion: e.target.value })}
                  placeholder="如 beijing-yizhuang"
                />
                <p className="text-xs text-muted-foreground">
                  可选。若填写，须全局唯一，将作为 Karmada 集群标签值（label value）使用。
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-dc-bare-metal-region">裸金属区域</Label>
                <Input
                  id="create-dc-bare-metal-region"
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
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="create-dc-scale">
                  规模 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={values.scale || undefined}
                  onValueChange={(value) => patch({ scale: value as DatacenterScale })}
                >
                  <SelectTrigger id="create-dc-scale" className="w-full">
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
                <Label htmlFor="create-dc-public-ip">公网 IP 数量</Label>
                <Input
                  id="create-dc-public-ip"
                  type="number"
                  min={0}
                  value={values.publicIpCount}
                  onChange={(e) => patch({ publicIpCount: e.target.value })}
                  placeholder="非负整数"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-dc-cidr">内网网段</Label>
                <Input
                  id="create-dc-cidr"
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
                <Label htmlFor="create-dc-network-fee">网络费用</Label>
                <Input
                  id="create-dc-network-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.networkFee}
                  onChange={(e) => patch({ networkFee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-dc-mgmt-fee">管控节点费用</Label>
                <Input
                  id="create-dc-mgmt-fee"
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
            disabled={createMutation.isPending}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? '创建中…' : '创建机房'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CreateDatacenterTrigger({
  supplier,
  existingDataCenters,
  onCreated,
  className,
}: {
  supplier: Pick<Supplier, 'id' | 'name' | 'shortName'>
  existingDataCenters?: Pick<DataCenter, 'name' | 'code'>[]
  onCreated?: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button className={className ?? 'gap-2'} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        新增机房
      </Button>
      <CreateDatacenterDialog
        open={open}
        onOpenChange={setOpen}
        supplier={supplier}
        existingDataCenters={existingDataCenters}
        onCreated={onCreated}
      />
    </>
  )
}
