'use client'

import * as React from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'

import type { DataCenter } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import type {
  PlatformDatacenterBindCommitResult,
  PlatformDatacenterBindSearchResult,
} from '@/lib/types/platform-datacenter-bind'

type Step = 'input' | 'select' | 'done'

function getTrpcErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function BindBadge({ bindable }: { bindable: boolean }) {
  return bindable ? (
    <Badge variant="outline">可绑定</Badge>
  ) : (
    <Badge variant="destructive">不可绑定</Badge>
  )
}

export function PlatformDatacenterBindDialog({
  open,
  onOpenChange,
  dataCenter,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataCenter: DataCenter | null
  onSuccess: () => void
}) {
  const [step, setStep] = React.useState<Step>('input')
  const [query, setQuery] = React.useState('')
  const [searchResult, setSearchResult] = React.useState<PlatformDatacenterBindSearchResult | null>(
    null,
  )
  const [selectedIdcId, setSelectedIdcId] = React.useState<string | null>(null)
  const [commitResult, setCommitResult] = React.useState<PlatformDatacenterBindCommitResult | null>(
    null,
  )
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  const searchMutation = trpc.supplier.platformDatacenterBind.search.useMutation()
  const bindMutation = trpc.supplier.platformDatacenterBind.bind.useMutation()

  const loading = searchMutation.isPending || bindMutation.isPending

  const reset = React.useCallback(() => {
    setStep('input')
    setQuery('')
    setSearchResult(null)
    setSelectedIdcId(null)
    setCommitResult(null)
    setFetchError(null)
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const bindableCandidates = React.useMemo(
    () => searchResult?.candidates.filter((c) => c.bindable) ?? [],
    [searchResult],
  )

  const onSearch = async () => {
    if (!dataCenter) return
    const trimmed = query.trim()
    if (!trimmed) {
      toast.error('请输入平台租户 ID、机房 ID 或名称')
      return
    }

    setFetchError(null)
    try {
      const result = await searchMutation.mutateAsync({
        dataCenterId: dataCenter.id,
        query: trimmed,
      })
      setSearchResult(result)
      setStep('select')

      const bindable = result.candidates.filter((c) => c.bindable)
      if (result.candidates.length === 0) {
        toast.error('平台未返回任何机房')
      } else if (bindable.length === 0) {
        toast.warning('找到平台机房，但均不可绑定')
      } else if (bindable.length === 1) {
        setSelectedIdcId(bindable[0]!.idcId)
        toast.success('找到 1 条可绑定记录')
      } else {
        toast.success(`找到 ${bindable.length} 条可绑定记录，请选择一条`)
      }
    } catch (e) {
      const message = getTrpcErrorMessage(e, '搜索平台机房失败')
      setFetchError(message)
      toast.error(message)
    }
  }

  const onBind = async () => {
    if (!dataCenter || !selectedIdcId) return

    try {
      const result = await bindMutation.mutateAsync({
        dataCenterId: dataCenter.id,
        idcId: selectedIdcId,
      })
      setCommitResult(result)
      setStep('done')
      onSuccess()
      toast.success(`已成功绑定平台机房 ${result.externalOnboardingId}`)
    } catch (e) {
      toast.error(getTrpcErrorMessage(e, '绑定失败，请稍后重试'))
    }
  }

  const handleClose = (next: boolean) => {
    onOpenChange(next)
  }

  if (!dataCenter) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === 'input' && '平台绑定'}
            {step === 'select' && '选择平台机房'}
            {step === 'done' && '绑定完成'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' &&
              `为「${dataCenter.name}」（${dataCenter.supplierName}）绑定平台机房。输入平台租户 ID、机房 ID 或名称进行搜索。`}
            {step === 'select' &&
              '核对平台数据后选择一条记录进行绑定。绑定后将写入 externalOnboardingId 及平台字段，保留当前编码与供应商归属。'}
            {step === 'done' && '平台绑定已完成，关闭后列表将刷新。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          {step === 'input' && (
            <div className="space-y-4 px-1">
              {dataCenter.externalOnboardingId || dataCenter.platformTenantId ? (
                <Alert>
                  <AlertDescription>
                    当前绑定：
                    {dataCenter.externalOnboardingId
                      ? ` 平台机房 ID ${dataCenter.externalOnboardingId}`
                      : ''}
                    {dataCenter.platformTenantId
                      ? `（租户 ${dataCenter.platformTenantId}）`
                      : ''}
                    。重新绑定将覆盖现有平台关联。
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="platform-datacenter-bind-query">平台租户 ID、机房 ID 或名称 *</Label>
                <Input
                  id="platform-datacenter-bind-query"
                  placeholder="例如 16462 或 北京机房"
                  value={query}
                  disabled={loading}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void onSearch()
                    }
                  }}
                />
                <p className="text-muted-foreground text-xs">
                  纯数字将同时按机房 ID 与租户 ID 查询；否则按名称模糊匹配。所属供应商须已绑定平台。
                </p>
              </div>

              {fetchError ? (
                <Alert variant="destructive">
                  <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}

          {step === 'select' && searchResult && (
            <div className="space-y-4 px-1">
              {bindableCandidates.length === 0 && (
                <Alert variant="destructive">
                  <AlertDescription>未找到可绑定的平台机房，请调整搜索条件后重试。</AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead className="w-24">机房 ID</TableHead>
                      <TableHead className="w-24">租户 ID</TableHead>
                      <TableHead className="w-28">容器区域</TableHead>
                      <TableHead className="w-20">状态</TableHead>
                      <TableHead className="min-w-[120px]">说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResult.candidates.map((row) => (
                      <TableRow
                        key={row.idcId}
                        className={
                          !row.bindable
                            ? 'bg-destructive/5'
                            : selectedIdcId === row.idcId
                              ? 'bg-primary/5'
                              : undefined
                        }
                        onClick={() => {
                          if (row.bindable) setSelectedIdcId(row.idcId)
                        }}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            name="platform-datacenter-bind-candidate"
                            checked={selectedIdcId === row.idcId}
                            disabled={!row.bindable}
                            onChange={() => setSelectedIdcId(row.idcId)}
                          />
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.idcId}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.platformTenantId ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs">
                          {row.containerInstanceRegion ?? '—'}
                        </TableCell>
                        <TableCell>
                          <BindBadge bindable={row.bindable} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.bindable ? (
                            <span className="text-muted-foreground">可绑定到当前机房</span>
                          ) : (
                            <span className="text-destructive">{row.bindMessage ?? '—'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {step === 'done' && commitResult && (
            <div className="space-y-3 px-1 text-sm">
              <p>
                机房「{commitResult.dataCenterName}」已成功绑定平台机房 ID{' '}
                <span className="font-medium">{commitResult.externalOnboardingId}</span>
                {commitResult.platformTenantId
                  ? `（租户 ${commitResult.platformTenantId}）`
                  : ''}
                。
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          {step === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button type="button" disabled={loading} onClick={() => void onSearch()}>
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    正在搜索…
                  </>
                ) : (
                  '搜索平台机房'
                )}
              </Button>
            </>
          )}
          {step === 'select' && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setStep('input')
                  setSearchResult(null)
                  setSelectedIdcId(null)
                }}
              >
                上一步
              </Button>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={loading || !selectedIdcId}
                onClick={() => void onBind()}
              >
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    绑定中…
                  </>
                ) : (
                  '确认绑定'
                )}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button type="button" onClick={() => handleClose(false)}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
