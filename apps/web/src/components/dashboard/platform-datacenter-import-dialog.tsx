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
  mockCommitPlatformDatacenterImport,
  mockPreviewPlatformDatacenterImport,
  PLATFORM_DATACENTER_IMPORT_MAX_IDS,
} from '@/lib/supplier/platform-datacenter-import-mock'
import { parsePlatformDatacenterIds } from '@/lib/supplier/platform-datacenter-import-utils'
import type {
  PlatformDatacenterImportCommitResult,
  PlatformDatacenterImportPreviewResult,
  PlatformDatacenterPreviewItem,
} from '@/lib/types/platform-datacenter-import'

type Step = 'input' | 'preview' | 'done'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function ActionBadge({ item }: { item: PlatformDatacenterPreviewItem }) {
  if (item.missingOnPlatform) {
    return <Badge variant="secondary">平台无数据</Badge>
  }
  if (item.action === 'create') {
    return <Badge>新建</Badge>
  }
  if (item.action === 'error') {
    return <Badge variant="destructive">错误</Badge>
  }
  return <Badge variant="outline">跳过</Badge>
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
  const [preview, setPreview] = React.useState<PlatformDatacenterImportPreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<PlatformDatacenterImportCommitResult | null>(
    null,
  )
  const [loading, setLoading] = React.useState(false)

  const reset = React.useCallback(() => {
    setStep('input')
    setIdsRaw('')
    setPreview(null)
    setCommitResult(null)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const actionableItems = React.useMemo(
    () => preview?.items.filter((i) => i.action === 'create') ?? [],
    [preview],
  )

  const previewSummary =
    preview &&
    `共 ${preview.items.length} 条，平台返回 ${preview.items.filter((i) => !i.missingOnPlatform).length} 条，可新建 ${actionableItems.length} 条`

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

    setLoading(true)
    try {
      const result = await mockPreviewPlatformDatacenterImport(ids)
      setPreview(result)
      setStep('preview')
      if (result.missingPlatformIds.length > 0) {
        toast.warning(`有 ${result.missingPlatformIds.length} 个 ID 平台未返回`)
      } else if (result.items.filter((i) => !i.missingOnPlatform).length === 0) {
        toast.error('平台未返回任何有效机房')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '拉取失败')
    } finally {
      setLoading(false)
    }
  }

  const onCommit = async () => {
    if (!preview) return
    if (actionableItems.length === 0) {
      toast.error('没有可导入的机房')
      return
    }

    setLoading(true)
    try {
      const result = await mockCommitPlatformDatacenterImport({
        items: actionableItems.map((i) => ({ externalOnboardingId: i.externalOnboardingId })),
      })
      setCommitResult(result)
      setStep('done')
      const fail = result.errors.length
      if (fail > 0) {
        toast.warning(`导入完成：新建 ${result.created}，${fail} 条失败`)
      } else {
        toast.success(`导入完成：新建 ${result.created} 条机房`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (next: boolean) => {
    if (!next && step === 'done') onSuccess()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
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
            {step === 'done' && '导入结果如下，关闭后将刷新列表。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
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
                支持半角/中文逗号、空格、换行分隔；仅保留纯数字 ID。Mock 示例：20001、20002、20003。
              </p>
            </div>
          )}

          {step === 'preview' && preview && !loading && (
            <div className="space-y-4 px-1">
              {preview.missingPlatformIds.length > 0 && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>
                    平台未返回：{preview.missingPlatformIds.join('、')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">机房 ID</TableHead>
                      <TableHead>机房名称</TableHead>
                      <TableHead>区域</TableHead>
                      <TableHead className="w-24">租户 ID</TableHead>
                      <TableHead>匹配供应商</TableHead>
                      <TableHead className="w-20">操作</TableHead>
                      <TableHead className="min-w-[140px]">说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.items.map((item) => (
                      <TableRow
                        key={item.externalOnboardingId}
                        className={item.missingOnPlatform ? 'bg-muted/40 opacity-60' : undefined}
                      >
                        <TableCell className="font-mono text-sm">
                          {item.externalOnboardingId}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate" title={item.platform.name}>
                          {item.platform.name}
                          {item.platform.sourceDeleted ? (
                            <Badge variant="secondary" className="ml-2">
                              源已删
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.platform.zoneName ?? item.platform.region ?? '—'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.platform.platformTenantId ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.resolvedSupplier?.supplierName ?? (
                            <span className="text-destructive">未匹配</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ActionBadge item={item} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.local ? (
                            <>
                              已存在：
                              <span className="text-foreground font-medium">
                                {item.local.dataCenterName}
                              </span>
                            </>
                          ) : item.errorMessage ? (
                            <span className="text-destructive">{item.errorMessage}</span>
                          ) : item.skipReason ? (
                            item.skipReason
                          ) : item.action === 'create' ? (
                            <span className="text-foreground">将新建</span>
                          ) : (
                            '—'
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
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="新建" value={commitResult.created} />
                <Stat label="跳过" value={commitResult.skipped} />
                <Stat label="失败" value={commitResult.errors.length} />
              </div>
              {commitResult.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>机房 ID</TableHead>
                        <TableHead>原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commitResult.errors.map((err) => (
                        <TableRow key={err.externalOnboardingId}>
                          <TableCell className="font-mono">{err.externalOnboardingId}</TableCell>
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

        <DialogFooter className="gap-2 sm:gap-0">
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
                disabled={loading || actionableItems.length === 0}
                onClick={() => void onCommit()}
              >
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    导入中…
                  </>
                ) : (
                  `确认导入${actionableItems.length > 0 ? `（${actionableItems.length} 条）` : ''}`
                )}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button
              type="button"
              onClick={() => {
                onSuccess()
                handleClose(false)
              }}
            >
              关闭并刷新列表
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
