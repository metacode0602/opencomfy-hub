'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import type { MerchantSyncPreviewResult } from '@/lib/types/platform-merchant-sync'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'

type Step = 'loading' | 'preview' | 'committing'

const ACTION_LABEL = {
  create: '新建',
  update: '更新',
  unchanged: '无变化',
} as const

const ACTION_BADGE: Record<
  keyof typeof ACTION_LABEL,
  'default' | 'secondary' | 'outline'
> = {
  create: 'default',
  update: 'secondary',
  unchanged: 'outline',
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

export function MerchantPlatformSyncDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<Step>('loading')
  const [preview, setPreview] = useState<MerchantSyncPreviewResult | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const previewMutation = trpc.merchant.sync.preview.useMutation()
  const commitMutation = trpc.merchant.sync.commit.useMutation()

  const reset = useCallback(() => {
    setStep('loading')
    setPreview(null)
    setFetchError(null)
  }, [])

  const loadPreview = useCallback(async () => {
    setStep('loading')
    setFetchError(null)
    try {
      const result = await previewMutation.mutateAsync({})
      setPreview(result)
      setStep('preview')

      const { create, update, unchanged } = result.summary
      if (result.platformTotal === 0) {
        toast.info('平台未返回任何商户')
      } else if (create === 0 && update === 0) {
        toast.info(`已对比 ${result.platformTotal} 条，均已同步`)
      } else {
        toast.success(
          `拉取 ${result.platformTotal} 条：${create} 条新建、${update} 条更新、${unchanged} 条无变化`,
        )
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '拉取平台商户失败')
      setStep('preview')
      toast.error(e instanceof Error ? e.message : '拉取平台商户失败')
    }
  }, [previewMutation])

  useEffect(() => {
    if (!open) return
    reset()
    void loadPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在弹窗打开时拉取
  }, [open])

  const canCommit =
    preview != null && (preview.summary.create > 0 || preview.summary.update > 0)

  const handleCommit = async () => {
    if (!preview) return
    setStep('committing')
    try {
      const result = await commitMutation.mutateAsync({ previewId: preview.previewId })
      if (result.errors.length > 0) {
        toast.warning(
          `同步完成：新建 ${result.created}、更新 ${result.updated}，${result.errors.length} 条失败`,
          { description: result.errors.slice(0, 2).map((e) => e.message).join('；') },
        )
      } else {
        toast.success(`同步完成：新建 ${result.created}、更新 ${result.updated}`)
      }
      onSuccess()
      onOpenChange(false)
    } catch (e) {
      setStep('preview')
      toast.error(e instanceof Error ? e.message : '同步失败')
    }
  }

  const loading = step === 'loading' || step === 'committing'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl min-w-[50vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>同步平台商户</DialogTitle>
          <DialogDescription>
            从算算力平台拉取商户列表，预览差异后确认写入本地库。公司全称、统一社会信用代码、接入模式不会被平台覆盖。
          </DialogDescription>
        </DialogHeader>

        {fetchError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{fetchError}</span>
              <Button variant="outline" size="sm" onClick={() => void loadPreview()} disabled={loading}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {preview ? (
          <div className="grid grid-cols-4 gap-3">
            <Stat label="平台总数" value={preview.platformTotal} />
            <Stat label="新建" value={preview.summary.create} />
            <Stat label="更新" value={preview.summary.update} />
            <Stat label="无变化" value={preview.summary.unchanged} />
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-auto rounded-md border">
          {step === 'loading' ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              正在拉取平台商户…
            </div>
          ) : preview && preview.rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">平台 ID</TableHead>
                  <TableHead>Merchant Mark</TableHead>
                  <TableHead>平台名称</TableHead>
                  <TableHead className="text-center">关联租户</TableHead>
                  <TableHead>本地名称</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>变更 / 提示</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={row.platformMerchantId}>
                    <TableCell className="font-mono tabular-nums">{row.platformMerchantId}</TableCell>
                    <TableCell className="font-mono text-xs">{row.merchantMark ?? '—'}</TableCell>
                    <TableCell>{row.platformName}</TableCell>
                    <TableCell className="text-center tabular-nums">{row.tenantCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.localName ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACTION_BADGE[row.action]}>{ACTION_LABEL[row.action]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                      {row.changes.length > 0 ? row.changes.join('、') : '—'}
                      {row.warnings.length > 0 ? (
                        <span className="block text-amber-600 mt-0.5">{row.warnings.join('；')}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">暂无数据</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button
            variant="outline"
            onClick={() => void loadPreview()}
            disabled={loading}
          >
            重新拉取
          </Button>
          <Button onClick={() => void handleCommit()} disabled={loading || !canCommit}>
            {step === 'committing' ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                写入中…
              </>
            ) : (
              '确认同步'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
