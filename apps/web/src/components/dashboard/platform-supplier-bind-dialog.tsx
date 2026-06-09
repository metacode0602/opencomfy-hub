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

import type { Supplier } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import type {
  PlatformSupplierBindCommitResult,
  PlatformSupplierBindSearchResult,
} from '@/lib/types/platform-supplier-bind'

type Step = 'input' | 'select' | 'done'

const ONBOARDING_LABEL = { enterprise: '企业', individual: '个人' } as const

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

export function PlatformSupplierBindDialog({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier | null
  onSuccess: () => void
}) {
  const [step, setStep] = React.useState<Step>('input')
  const [query, setQuery] = React.useState('')
  const [searchResult, setSearchResult] = React.useState<PlatformSupplierBindSearchResult | null>(
    null,
  )
  const [selectedApplicationId, setSelectedApplicationId] = React.useState<string | null>(null)
  const [commitResult, setCommitResult] = React.useState<PlatformSupplierBindCommitResult | null>(
    null,
  )
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  const searchMutation = trpc.supplier.platformBind.search.useMutation()
  const bindMutation = trpc.supplier.platformBind.bind.useMutation()

  const loading = searchMutation.isPending || bindMutation.isPending

  const reset = React.useCallback(() => {
    setStep('input')
    setQuery('')
    setSearchResult(null)
    setSelectedApplicationId(null)
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
    if (!supplier) return
    const trimmed = query.trim()
    if (!trimmed) {
      toast.error('请输入平台租户 ID 或名称')
      return
    }

    setFetchError(null)
    try {
      const result = await searchMutation.mutateAsync({
        supplierId: supplier.id,
        query: trimmed,
      })
      setSearchResult(result)
      setStep('select')

      const bindable = result.candidates.filter((c) => c.bindable)
      if (result.candidates.length === 0) {
        toast.error('平台未返回任何供应商')
      } else if (bindable.length === 0) {
        toast.warning('找到平台供应商，但均不可绑定')
      } else if (bindable.length === 1) {
        setSelectedApplicationId(bindable[0]!.applicationId)
        toast.success('找到 1 条可绑定记录')
      } else {
        toast.success(`找到 ${bindable.length} 条可绑定记录，请选择一条`)
      }
    } catch (e) {
      const message = getTrpcErrorMessage(e, '搜索平台供应商失败')
      setFetchError(message)
      toast.error(message)
    }
  }

  const onBind = async () => {
    if (!supplier || !selectedApplicationId) return

    try {
      const result = await bindMutation.mutateAsync({
        supplierId: supplier.id,
        applicationId: selectedApplicationId,
      })
      setCommitResult(result)
      setStep('done')
      onSuccess()
      toast.success(`已成功绑定平台租户 ${result.externalTenantId}`)
    } catch (e) {
      toast.error(getTrpcErrorMessage(e, '绑定失败，请稍后重试'))
    }
  }

  const handleClose = (next: boolean) => {
    onOpenChange(next)
  }

  if (!supplier) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === 'input' && '平台绑定'}
            {step === 'select' && '选择平台供应商'}
            {step === 'done' && '绑定完成'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' &&
              `为「${supplier.name}」绑定平台租户。输入平台租户 ID 或名称，从平台搜索匹配记录。`}
            {step === 'select' &&
              '核对平台数据后选择一条记录进行绑定。绑定后将写入 externalTenantId 及平台字段，保留当前商务经理与简称。'}
            {step === 'done' && '平台绑定已完成，关闭后列表将刷新。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          {step === 'input' && (
            <div className="space-y-4 px-1">
              {(supplier.externalTenantId && !supplier.externalTenantId.startsWith('crm-manual-')) ||
              supplier.platformTenantId ? (
                <Alert>
                  <AlertDescription>
                    当前绑定：
                    {supplier.externalTenantId &&
                    !supplier.externalTenantId.startsWith('crm-manual-')
                      ? ` 租户 ID ${supplier.externalTenantId}`
                      : ''}
                    {supplier.platformTenantId ? `（平台租户 ${supplier.platformTenantId}）` : ''}
                    。重新绑定将覆盖现有平台关联。
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="platform-bind-query">平台租户 ID 或名称 *</Label>
                <Input
                  id="platform-bind-query"
                  placeholder="例如 16462 或 某某科技"
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
                  纯数字将按租户 ID 精确查询；否则按名称模糊匹配（企业/个人类型均会搜索）。
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
                  <AlertDescription>未找到可绑定的平台供应商，请调整搜索条件后重试。</AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead className="w-28">租户 ID</TableHead>
                      <TableHead className="w-16">类型</TableHead>
                      <TableHead className="w-28">证件号</TableHead>
                      <TableHead className="w-20">状态</TableHead>
                      <TableHead className="min-w-[120px]">说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResult.candidates.map((row) => (
                      <TableRow
                        key={row.applicationId}
                        className={
                          !row.bindable
                            ? 'bg-destructive/5'
                            : selectedApplicationId === row.applicationId
                              ? 'bg-primary/5'
                              : undefined
                        }
                        onClick={() => {
                          if (row.bindable) setSelectedApplicationId(row.applicationId)
                        }}
                      >
                        <TableCell>
                          <input
                            type="radio"
                            name="platform-bind-candidate"
                            checked={selectedApplicationId === row.applicationId}
                            disabled={!row.bindable}
                            onChange={() => setSelectedApplicationId(row.applicationId)}
                          />
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.platformTenantId ?? '—'}
                        </TableCell>
                        <TableCell>
                          {row.onboardingType ? ONBOARDING_LABEL[row.onboardingType] : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.identityNo ?? '—'}
                        </TableCell>
                        <TableCell>
                          <BindBadge bindable={row.bindable} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.bindable ? (
                            <span className="text-muted-foreground">可绑定到当前供应商</span>
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
                供应商「{commitResult.supplierName}」已成功绑定平台租户 ID{' '}
                <span className="font-medium">{commitResult.externalTenantId}</span>
                {commitResult.platformTenantId
                  ? `（平台租户 ${commitResult.platformTenantId}）`
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
                  '搜索平台供应商'
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
                  setSelectedApplicationId(null)
                }}
              >
                上一步
              </Button>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={loading || !selectedApplicationId}
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
