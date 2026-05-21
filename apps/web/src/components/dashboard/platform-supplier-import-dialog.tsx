'use client'

import * as React from 'react'
import { IconLoader2, IconPlus } from '@tabler/icons-react'
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
import { Alert, AlertDescription } from '@workspace/ui/components/alert'

import type { UserStaff } from '@/lib/types/crm'
import {
  PLATFORM_SUPPLIER_TYPE_LABEL,
  PLATFORM_SUPPLIER_TYPES,
  type PlatformSupplierType,
} from '@/lib/supplier/platform-supplier-import-utils'
import { trpc } from '@/lib/trpc/client'
import type {
  PlatformSupplierImportPreviewResult,
  PlatformSupplierImportSearchParams,
} from '@/lib/types/platform-supplier-import'
import type { SupplierImportCommitResult } from '@/lib/types/supplier-import'

type Step = 'input' | 'preview' | 'done'

const ONBOARDING_LABEL = { enterprise: '企业', individual: '个人' } as const
const ACTION_LABEL = { create: '新建', update: '更新', skip: '跳过' } as const

function ParseBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  if (status === 'ok') return <Badge variant="outline">通过</Badge>
  if (status === 'warning') return <Badge className="bg-amber-500/15 text-amber-700">告警</Badge>
  return <Badge variant="destructive">错误</Badge>
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

function getTrpcErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function PlatformSupplierImportDialog({
  open,
  onOpenChange,
  activeStaff,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeStaff: UserStaff[]
  onSuccess: () => void
}) {
  const [step, setStep] = React.useState<Step>('input')
  const [supplierType, setSupplierType] = React.useState<PlatformSupplierType>('Enterprise')
  const [supplierName, setSupplierName] = React.useState('')
  const [searchParams, setSearchParams] = React.useState<PlatformSupplierImportSearchParams | null>(
    null,
  )
  const [businessManagerStaffId, setBusinessManagerStaffId] = React.useState('')
  const [preview, setPreview] = React.useState<PlatformSupplierImportPreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<SupplierImportCommitResult | null>(null)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  const previewMutation = trpc.supplier.platformImport.preview.useMutation()
  const commitMutation = trpc.supplier.platformImport.commit.useMutation()

  const loading = previewMutation.isPending || commitMutation.isPending

  const reset = React.useCallback(() => {
    setStep('input')
    setSupplierType('Enterprise')
    setSupplierName('')
    setSearchParams(null)
    setBusinessManagerStaffId('')
    setPreview(null)
    setCommitResult(null)
    setFetchError(null)
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const importableCount = React.useMemo(
    () => preview?.rows.filter((r) => r.selectable).length ?? 0,
    [preview],
  )

  const previewSummary = preview
    ? `平台返回 ${preview.summary.total} 条，可导入 ${importableCount} 条（新建 ${preview.summary.create}，更新 ${preview.summary.update}）`
    : null

  const onFetchPreview = async () => {
    if (!businessManagerStaffId) {
      toast.error('请选择默认商务经理')
      return
    }

    const params: PlatformSupplierImportSearchParams = {
      types: supplierType,
      name: supplierName.trim(),
    }

    setFetchError(null)
    try {
      const result = await previewMutation.mutateAsync({
        ...params,
        defaultBusinessManagerStaffId: businessManagerStaffId,
      })
      setSearchParams(params)
      setPreview(result)
      setStep('preview')

      if (result.summary.total === 0) {
        toast.error('平台未返回任何有效供应商')
      } else if (result.summary.error > 0) {
        toast.warning(
          `拉取完成：${result.summary.create + result.summary.update} 条可导入，${result.summary.error} 条将跳过`,
        )
      } else if (result.summary.warn > 0) {
        toast.message(`拉取完成：${result.summary.total} 条，${result.summary.warn} 条含告警`)
      } else {
        toast.success(`拉取完成：共 ${result.summary.total} 条`)
      }
    } catch (e) {
      const message = getTrpcErrorMessage(e, '拉取平台供应商失败')
      setFetchError(message)
      toast.error(message)
    }
  }

  const onCommit = async () => {
    if (!preview || !businessManagerStaffId || !searchParams) return
    if (importableCount === 0) {
      toast.error('没有可导入的供应商')
      return
    }

    try {
      const result = await commitMutation.mutateAsync({
        ...searchParams,
        defaultBusinessManagerStaffId: businessManagerStaffId,
      })
      setCommitResult(result)
      setStep('done')
      onSuccess()

      if (result.errors.length > 0 || result.skipped > 0) {
        toast.warning(
          `导入完成：新建 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped} 行`,
        )
      } else {
        toast.success(`导入完成：新建 ${result.created}，更新 ${result.updated}`)
      }
    } catch (e) {
      toast.error(getTrpcErrorMessage(e, '导入失败，请稍后重试'))
    }
  }

  const handleClose = (next: boolean) => {
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === 'input' && '从平台导入供应商'}
            {step === 'preview' && '确认导入供应商'}
            {step === 'done' && '导入完成'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' &&
              '按类型与名称从平台筛选供应商。新建供应商将统一写入所选商务经理。'}
            {step === 'preview' &&
              (previewSummary ??
                '核对平台数据；已有本地供应商仅更新平台字段，不修改商务经理。')}
            {step === 'done' && '导入结果如下，关闭后列表已刷新。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          {step === 'input' && (
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="platform-default-business-manager">默认商务经理 *</Label>
                <Select
                  value={businessManagerStaffId || undefined}
                  onValueChange={setBusinessManagerStaffId}
                  disabled={loading}
                >
                  <SelectTrigger id="platform-default-business-manager">
                    <SelectValue placeholder="选择商务经理（新建供应商必填）" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {activeStaff.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        暂无在职员工
                      </SelectItem>
                    ) : (
                      activeStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.display_name}
                          {s.employee_no ? ` (${s.employee_no})` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  仅对本次导入中「新建」的供应商生效；已存在记录保留原商务经理。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform-supplier-type">类型 *</Label>
                <Select
                  value={supplierType}
                  onValueChange={(value) => setSupplierType(value as PlatformSupplierType)}
                  disabled={loading}
                >
                  <SelectTrigger id="platform-supplier-type">
                    <SelectValue placeholder="选择供应商类型" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {PLATFORM_SUPPLIER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {PLATFORM_SUPPLIER_TYPE_LABEL[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform-supplier-name">名称</Label>
                <Input
                  id="platform-supplier-name"
                  placeholder="输入供应商名称（可选，支持模糊匹配）"
                  value={supplierName}
                  disabled={loading}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  留空则按类型拉取全部审核通过的供应商；名称会在请求平台 API 时进行 URL 编码。
                </p>
              </div>

              {fetchError ? (
                <Alert variant="destructive">
                  <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4 px-1">
              {preview.summary.error > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    有 {preview.summary.error} 行存在错误将跳过；仍可导入其余 {importableCount} 行
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="平台返回" value={preview.summary.total} />
                <Stat label="可新建" value={preview.summary.create} />
                <Stat label="可更新" value={preview.summary.update} />
                <Stat label="错误" value={preview.summary.error} />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">行</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead className="w-16">类型</TableHead>
                      <TableHead className="w-28">证件号</TableHead>
                      <TableHead className="w-16">动作</TableHead>
                      <TableHead className="w-32">商务经理</TableHead>
                      <TableHead className="w-16">校验</TableHead>
                      <TableHead className="min-w-[120px]">说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow
                        key={row.row_no}
                        className={
                          row.parse_status === 'error'
                            ? 'bg-destructive/5'
                            : row.parse_status === 'warning'
                              ? 'bg-amber-500/5'
                              : undefined
                        }
                      >
                        <TableCell>{row.row_no}</TableCell>
                        <TableCell className="max-w-[160px] truncate font-medium">
                          {row.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          {row.onboarding_type
                            ? ONBOARDING_LABEL[row.onboarding_type]
                            : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.identity_no ?? '—'}
                        </TableCell>
                        <TableCell>{ACTION_LABEL[row.action]}</TableCell>
                        <TableCell className="text-xs">
                          {row.business_manager_note === 'will_set'
                            ? `→ ${row.business_manager_label ?? '—'}`
                            : '保留原值'}
                        </TableCell>
                        <TableCell>
                          <ParseBadge status={row.parse_status} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.parse_status === 'error' ? (
                            <span className="text-destructive">{row.parse_message ?? '—'}</span>
                          ) : (
                            <span className="text-muted-foreground">{row.parse_message ?? '—'}</span>
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
            <div className="space-y-4 px-1">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="新建" value={commitResult.created} />
                <Stat label="更新" value={commitResult.updated} />
                <Stat label="跳过" value={commitResult.skipped} />
                <Stat label="失败" value={commitResult.failed} />
              </div>
              {commitResult.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">行</TableHead>
                        <TableHead>原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commitResult.errors.map((err) => (
                        <TableRow key={`${err.row_no}-${err.message}`}>
                          <TableCell>{err.row_no}</TableCell>
                          <TableCell className="text-destructive text-xs">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          {step === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button type="button" disabled={loading} onClick={() => void onFetchPreview()}>
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    正在从平台拉取…
                  </>
                ) : (
                  '拉取并预览'
                )}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setStep('input')
                  setPreview(null)
                }}
              >
                上一步
              </Button>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={loading || importableCount === 0}
                onClick={() => void onCommit()}
              >
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    导入中…
                  </>
                ) : (
                  `确认导入${importableCount > 0 ? `（${importableCount} 条）` : ''}`
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

export function PlatformSupplierImportTrigger({
  activeStaff,
  onSuccess,
}: {
  activeStaff: UserStaff[]
  onSuccess: () => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        type="button"
        onClick={() => setOpen(true)}
      >
        <IconPlus className="size-4" />
        导入供应商
      </Button>
      {open ? (
        <PlatformSupplierImportDialog
          open
          onOpenChange={setOpen}
          activeStaff={activeStaff}
          onSuccess={onSuccess}
        />
      ) : null}
    </>
  )
}
