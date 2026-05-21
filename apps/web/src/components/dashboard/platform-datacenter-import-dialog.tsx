'use client'

import * as React from 'react'
import { IconAlertTriangle, IconLoader2, IconPlus } from '@tabler/icons-react'
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
import { Label } from '@workspace/ui/components/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Textarea } from '@workspace/ui/components/textarea'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'

import {
  parsePlatformDatacenterIds,
  PLATFORM_DATACENTER_IMPORT_MAX_IDS,
} from '@/lib/supplier/platform-datacenter-import-utils'
import { trpc } from '@/lib/trpc/client'
import type { PlatformDatacenterImportPreviewResult } from '@/lib/types/platform-datacenter-import'
import type { DatacenterImportCommitResult } from '@/lib/types/datacenter-import'

type Step = 'input' | 'preview' | 'done'

const ACTION_LABEL = { create: '新建', skip: '跳过', error: '错误' } as const

const SKIP_REASON_LABEL = {
  already_exists: '已存在',
  source_deleted: '源已删',
  empty_name: '无名称',
  code_collision: '编码冲突',
} as const

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

export function PlatformDatacenterImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [step, setStep] = React.useState<Step>('input')
  const [idsRaw, setIdsRaw] = React.useState('')
  const [resolvedIds, setResolvedIds] = React.useState<string[]>([])
  const [preview, setPreview] = React.useState<PlatformDatacenterImportPreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<DatacenterImportCommitResult | null>(null)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  const previewMutation = trpc.supplier.platformDatacenterImport.preview.useMutation()
  const commitMutation = trpc.supplier.platformDatacenterImport.commit.useMutation()

  const loading = previewMutation.isPending || commitMutation.isPending

  const reset = React.useCallback(() => {
    setStep('input')
    setIdsRaw('')
    setResolvedIds([])
    setPreview(null)
    setCommitResult(null)
    setFetchError(null)
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const createCount = preview?.summary.create ?? 0

  const previewSummary = preview
    ? `平台返回 ${preview.summary.total} 条，可新建 ${createCount} 条${
        preview.missingPlatformIds.length > 0
          ? `，${preview.missingPlatformIds.length} 个 ID 平台未返回`
          : ''
      }`
    : null

  const onFetchPreview = async () => {
    const ids = parsePlatformDatacenterIds(idsRaw)
    if (ids.length === 0) {
      toast.error('请输入有效的平台机房 ID（纯数字）')
      return
    }
    if (ids.length > PLATFORM_DATACENTER_IMPORT_MAX_IDS) {
      toast.error(`单次最多 ${PLATFORM_DATACENTER_IMPORT_MAX_IDS} 个 ID`)
      return
    }

    setFetchError(null)
    try {
      const result = await previewMutation.mutateAsync({ externalOnboardingIds: ids })
      setResolvedIds(ids)
      setPreview(result)
      setStep('preview')

      if (result.missingPlatformIds.length > 0) {
        toast.warning(`有 ${result.missingPlatformIds.length} 个 ID 平台未返回`)
      }
      if (result.summary.total === 0) {
        toast.error('平台未返回任何有效机房')
      } else if (result.summary.error > 0) {
        toast.warning(
          `拉取完成：${result.summary.create} 条可新建，${result.summary.error} 条存在错误`,
        )
      } else if (createCount === 0) {
        toast.message('拉取完成：没有可新建的机房（可能均已存在或源已删除）')
      } else {
        toast.success(`拉取完成：${createCount} 条可新建`)
      }
    } catch (e) {
      const message = getTrpcErrorMessage(e, '拉取平台机房失败')
      setFetchError(message)
      toast.error(message)
    }
  }

  const onCommit = async () => {
    if (!preview || resolvedIds.length === 0) return
    if (createCount === 0) {
      toast.error('没有可导入的机房')
      return
    }

    try {
      const result = await commitMutation.mutateAsync({ externalOnboardingIds: resolvedIds })
      setCommitResult(result)
      setStep('done')
      onSuccess()

      if (result.errors.length > 0 || result.failed > 0) {
        toast.warning(`导入完成：新建 ${result.created}，失败 ${result.failed} 条`)
      } else {
        toast.success(`导入完成：新建 ${result.created} 条机房`)
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
            {step === 'input' && '从平台导入机房'}
            {step === 'preview' && '确认导入机房'}
            {step === 'done' && '导入完成'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' &&
              `输入平台机房 ID，多个可用逗号或换行分隔（最多 ${PLATFORM_DATACENTER_IMPORT_MAX_IDS} 个）。系统将按租户 ID 匹配本地供应商。`}
            {step === 'preview' &&
              (previewSummary ?? '核对平台数据；未匹配到供应商或已存在的机房将跳过。')}
            {step === 'done' && '导入结果如下，关闭后列表已刷新。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          {step === 'input' && (
            <div className="space-y-3 px-1">
              <Label htmlFor="platform-datacenter-ids">平台机房 ID</Label>
              <Textarea
                id="platform-datacenter-ids"
                placeholder={'20001\n20002, 20003'}
                rows={6}
                value={idsRaw}
                disabled={loading}
                onChange={(e) => setIdsRaw(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                支持半角/中文逗号、空格、换行分隔；仅保留纯数字 ID。请先确保对应租户已导入本地供应商。
              </p>
              {fetchError ? (
                <Alert variant="destructive">
                  <AlertDescription>{fetchError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4 px-1">
              {preview.missingPlatformIds.length > 0 && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>
                    平台未返回：{preview.missingPlatformIds.join('、')}
                  </AlertDescription>
                </Alert>
              )}

              {preview.summary.error > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    有 {preview.summary.error} 行存在错误，将无法导入
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="平台返回" value={preview.summary.total} />
                <Stat label="可新建" value={preview.summary.create} />
                <Stat label="跳过" value={preview.summary.skip} />
                <Stat label="错误" value={preview.summary.error} />
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">行</TableHead>
                      <TableHead className="w-24">租户ID</TableHead>
                      <TableHead className="min-w-[100px]">供应商</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead className="w-20">源 ID</TableHead>
                      <TableHead className="w-16">动作</TableHead>
                      <TableHead className="w-28">code</TableHead>
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
                        <TableCell className="font-mono text-xs">
                          {row.platform_tenant_id ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs">
                          {row.resolved_supplier_name ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate font-medium">
                          {row.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.external_onboarding_id ?? '—'}
                        </TableCell>
                        <TableCell>
                          {row.action === 'skip' && row.skip_reason
                            ? SKIP_REASON_LABEL[row.skip_reason]
                            : ACTION_LABEL[row.action]}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.derived_code ?? '—'}
                        </TableCell>
                        <TableCell>
                          <ParseBadge status={row.parse_status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.parse_message ?? '—'}
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
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="新建" value={commitResult.created} />
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
                disabled={loading || createCount === 0}
                onClick={() => void onCommit()}
              >
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    导入中…
                  </>
                ) : (
                  `确认导入${createCount > 0 ? `（${createCount} 条）` : ''}`
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

export function PlatformDatacenterImportTrigger({
  onSuccess,
}: {
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
        导入机房
      </Button>
      {open ? (
        <PlatformDatacenterImportDialog open onOpenChange={setOpen} onSuccess={onSuccess} />
      ) : null}
    </>
  )
}
