'use client'

import * as React from 'react'
import { Button } from '@workspace/ui/components/button'
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
import { IconDownload, IconLoader2, IconSearch } from '@tabler/icons-react'
import { toast } from 'sonner'

import { CopyToClipboard } from '@/components/shared/copy-to-clipboard'
import { TENANT_PROJECT_QUERY_MAX_IDS } from '@/lib/crm/tenant-project-query-utils'
import { downloadTenantProjectQueryExcel } from '@/lib/crm/tenant-project-query-export'
import { OPPORTUNITY_SOURCE_LABELS } from '@/lib/crm/commission-constants'
import { trpc } from '@/lib/trpc/client'
import type { TenantProjectQueryResult } from '@/lib/types/tenant-project-query'

type Phase = 'idle' | 'querying' | 'results'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TenantProjectQueryDialog({ open, onOpenChange }: Props) {
  const queryMutation = trpc.crm.projects.queryTenantProjects.useMutation()

  const [phase, setPhase] = React.useState<Phase>('idle')
  const [rawTenantIds, setRawTenantIds] = React.useState('')
  const [result, setResult] = React.useState<TenantProjectQueryResult | null>(null)

  const loading = phase === 'querying' || queryMutation.isPending

  const reset = React.useCallback(() => {
    setPhase('idle')
    setRawTenantIds('')
    setResult(null)
  }, [])

  React.useEffect(() => {
    if (open) return
    reset()
  }, [open, reset])

  const onQuery = async () => {
    if (!rawTenantIds.trim()) {
      toast.error('请输入至少一个平台租户 ID')
      return
    }

    setPhase('querying')
    try {
      const data = await queryMutation.mutateAsync({ rawTenantIds })
      setResult(data)
      setPhase('results')

      const { summary } = data
      if (summary.withProject === 0) {
        toast.info(`查询完成：输入 ${summary.total} 个租户，未找到关联项目`)
      } else {
        toast.success(
          `查询完成：输入 ${summary.total} 个租户，匹配 ${summary.matchedTenants} 个，共 ${summary.withProject} 条项目记录`,
        )
      }
    } catch (e) {
      setPhase('idle')
      toast.error(e instanceof Error ? e.message : '查询失败，请稍后重试')
    }
  }

  const onTenantIdsChange = (value: string) => {
    setRawTenantIds(value)
    if (result) {
      setResult(null)
      setPhase('idle')
    }
  }

  const multiProjectCopyText = React.useMemo(() => {
    if (!result?.summary.multiProjectTenants.length) return ''
    return result.summary.multiProjectTenants.map((t) => t.platformTenantId).join('\n')
  }, [result])

  const onDownloadExcel = () => {
    if (!result || result.rows.length === 0) {
      toast.error('暂无数据可导出')
      return
    }
    const ok = downloadTenantProjectQueryExcel(result.rows)
    if (ok) {
      toast.success('Excel 已下载')
    } else {
      toast.error('导出失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>租户项目查询</DialogTitle>
          <DialogDescription>
            输入多个平台租户 ID，仅展示已关联项目的租户及其客户经理、交付、售前、项目经理、商机来源与成交锚定月等信息。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-project-query-ids">平台租户 ID</Label>
            <Textarea
              id="tenant-project-query-ids"
              placeholder={`输入租户 ID，支持逗号、空格或换行分隔，单次最多 ${TENANT_PROJECT_QUERY_MAX_IDS} 个`}
              value={rawTenantIds}
              disabled={loading}
              rows={3}
              onChange={(e) => onTenantIdsChange(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            {result && result.rows.length > 0 ? (
              <Button type="button" variant="outline" disabled={loading} onClick={onDownloadExcel}>
                <IconDownload className="mr-2 size-4" />
                下载 Excel
              </Button>
            ) : null}
            <Button type="button" disabled={loading} onClick={() => void onQuery()}>
              {phase === 'querying' ? (
                <IconLoader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <IconSearch className="mr-2 size-4" />
              )}
              查询
            </Button>
          </div>

          {result && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription className="text-sm">
                  输入 {result.summary.total} 个租户 · 匹配 {result.summary.matchedTenants} 个 · 项目记录{' '}
                  {result.summary.withProject} 条
                  {result.summary.withProject > result.summary.matchedTenants
                    ? `（差异 ${result.summary.withProject - result.summary.matchedTenants} 条，来自多项目租户）`
                    : null}
                </AlertDescription>
              </Alert>

              {result.summary.multiProjectTenants.length > 0 ? (
                <div className="rounded-md border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      关联多个项目的租户（{result.summary.multiProjectTenants.length} 个）
                    </p>
                    <CopyToClipboard
                      text={multiProjectCopyText}
                      tooltip="复制租户 ID"
                      successMessage="租户 ID 已复制到剪贴板"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.summary.multiProjectTenants.map((tenant) => (
                      <span
                        key={tenant.platformTenantId}
                        className="bg-background inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs"
                      >
                        {tenant.platformTenantId}
                        <span className="text-muted-foreground">×{tenant.projectCount}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {result.rows.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">未找到关联项目的租户</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">平台租户 ID</TableHead>
                        <TableHead>租户名称</TableHead>
                        <TableHead>项目名称</TableHead>
                        <TableHead>客户经理</TableHead>
                        <TableHead>交付</TableHead>
                        <TableHead>售前</TableHead>
                        <TableHead>项目经理</TableHead>
                        <TableHead>商机来源</TableHead>
                        <TableHead>成交锚定月</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((row) => (
                        <TableRow key={`${row.platformTenantId}-${row.projectId}`}>
                          <TableCell className="font-mono text-sm">{row.platformTenantId}</TableCell>
                          <TableCell>{row.tenantName}</TableCell>
                          <TableCell className="text-sm">{row.projectName}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.accountManager || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.deliveryManager || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.preSalesManager || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.projectManager || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.opportunitySource
                              ? OPPORTUNITY_SOURCE_LABELS[row.opportunitySource]
                              : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.dealClosedMonth ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
