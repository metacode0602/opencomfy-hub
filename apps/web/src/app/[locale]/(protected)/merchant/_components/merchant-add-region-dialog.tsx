'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { MerchantRegionStatus } from '@/lib/types/merchant'
import { trpc } from '@/lib/trpc/client'
import {
  DatacenterSelect,
  preventDatacenterSelectOutsideDismiss,
} from './datacenter-select'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
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

export type MerchantAddRegionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string
  onAdded: (regionId: string) => void | Promise<void>
}

export function MerchantAddRegionDialog({
  open,
  onOpenChange,
  merchantId,
  onAdded,
}: MerchantAddRegionDialogProps) {
  const datacentersQuery = trpc.merchant.region.listAvailableDatacenters.useQuery(
    { merchantId },
    { enabled: open },
  )
  const createMutation = trpc.merchant.region.create.useMutation()

  const [dataCenterId, setDataCenterId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<MerchantRegionStatus>('open')
  const [quotaInput, setQuotaInput] = useState('')

  const available = datacentersQuery.data ?? []
  const isLoading = datacentersQuery.isLoading
  const isSubmitting = createMutation.isPending

  const reset = () => {
    setDataCenterId('')
    setEffectiveFrom('')
    setDisplayName('')
    setStatus('open')
    setQuotaInput('')
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  useEffect(() => {
    if (!open) reset()
  }, [open])

  const handleSubmit = async () => {
    if (!dataCenterId) {
      toast.error('请选择机房')
      return
    }
    if (!effectiveFrom.trim()) {
      toast.error('请指定生效开始时间')
      return
    }

    const quotaTrim = quotaInput.trim()
    let availableGpuQuota: number | null = null
    if (quotaTrim !== '') {
      const parsed = Number(quotaTrim)
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        toast.error('GPU 配额须为非负整数，或留空表示不限')
        return
      }
      availableGpuQuota = parsed
    }

    try {
      const region = await createMutation.mutateAsync({
        merchantId,
        dataCenterId,
        effectiveFrom,
        displayName: displayName.trim() || undefined,
        status,
        availableGpuQuota,
      })
      await onAdded(region.id)
      toast.success(`已添加机房区域：${region.displayName ?? region.dataCenterName}`)
      handleOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '添加区域失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md min-w-[30vw] max-w-5xl"
        onPointerDownOutside={preventDatacenterSelectOutsideDismiss}
        onInteractOutside={preventDatacenterSelectOutsideDismiss}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            添加机房区域
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">加载机房列表…</p>
        ) : datacentersQuery.isError ? (
          <p className="text-sm text-destructive py-4">
            {datacentersQuery.error.message || '加载机房列表失败'}
          </p>
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            该平台机房均已配置给本商户，暂无可添加项。
          </p>
        ) : (
          <div className="space-y-4">
            <DatacenterSelect
              id="merchant-add-region-dc"
              label="选择机房"
              value={dataCenterId}
              datacenters={available}
              onChange={setDataCenterId}
              placeholder="输入名称、编码、城市或区域码搜索"
            />

            <div className="space-y-2">
              <Label htmlFor="merchant-add-region-effective-from">
                生效开始时间 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="merchant-add-region-effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant-add-region-display-name">展示名（可选）</Label>
              <Input
                id="merchant-add-region-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="覆盖默认机房名"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>开放状态</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as MerchantRegionStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">开放</SelectItem>
                    <SelectItem value="closed">关闭</SelectItem>
                    <SelectItem value="maintenance">维护中</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchant-add-region-quota">GPU 配额</Label>
                <Input
                  id="merchant-add-region-quota"
                  type="number"
                  min={0}
                  step={1}
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(e.target.value)}
                  placeholder="留空表示不限"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || isSubmitting || available.length === 0}
          >
            {isSubmitting ? '提交中…' : '确认添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
