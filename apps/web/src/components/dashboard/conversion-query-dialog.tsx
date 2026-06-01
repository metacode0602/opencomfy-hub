'use client'

import * as React from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
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
import { Textarea } from '@workspace/ui/components/textarea'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { IconAlertTriangle, IconLoader2, IconSearch } from '@tabler/icons-react'
import { toast } from 'sonner'

import { PLATFORM_TENANT_IMPORT_MAX_IDS } from '@/lib/crm/platform-tenant-import-utils'
import { trpc } from '@/lib/trpc/client'
import type { ConversionQueryResult, ConversionQueryRow } from '@/lib/types/conversion-query'
import { StatusBadge } from '@/components/dashboard/status-badge'

type Phase = 'idle' | 'querying' | 'results' | 'committing' | 'done'

function formatMoney(value: number) {
  return `¥${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function isSelectable(row: ConversionQueryRow) {
  return Boolean(row.projectId) && !row.isConverted
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ConversionQueryDialog({ open, onOpenChange, onSuccess }: Props) {
  const queryMutation = trpc.crm.projects.queryConversion.useMutation()
  const commitMutation = trpc.crm.projects.commitConversion.useMutation()

  const [phase, setPhase] = React.useState<Phase>('idle')
  const [rawTenantIds, setRawTenantIds] = React.useState('')
  const [result, setResult] = React.useState<ConversionQueryResult | null>(null)
  const [selectedProjectIds, setSelectedProjectIds] = React.useState<string[]>([])
  const [conversionDate, setConversionDate] = React.useState('')

  const loading = phase === 'querying' || phase === 'committing' || queryMutation.isPending || commitMutation.isPending

  const reset = React.useCallback(() => {
    setPhase('idle')
    setRawTenantIds('')
    setResult(null)
    setSelectedProjectIds([])
    setConversionDate('')
  }, [])

  React.useEffect(() => {
    if (open) return
    reset()
  }, [open, reset])

  const selectableRows = React.useMemo(
    () => result?.rows.filter(isSelectable) ?? [],
    [result],
  )

  const allSelectableChecked =
    selectableRows.length > 0 && selectableRows.every((r) => selectedProjectIds.includes(r.projectId!))

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedProjectIds(selectableRows.map((r) => r.projectId!))
    } else {
      setSelectedProjectIds([])
    }
  }

  const toggleRow = (projectId: string, checked: boolean) => {
    setSelectedProjectIds((prev) =>
      checked ? (prev.includes(projectId) ? prev : [...prev, projectId]) : prev.filter((id) => id !== projectId),
    )
  }

  const onQuery = async () => {
    if (!rawTenantIds.trim()) {
      toast.error('请输入至少一个平台租户 ID')
      return
    }

    setPhase('querying')
    try {
      const data = await queryMutation.mutateAsync({ rawTenantIds })
      setResult(data)
      setSelectedProjectIds(data.rows.filter(isSelectable).map((r) => r.projectId!))
      setPhase('results')

      const { summary } = data
      toast.success(
        `查询完成：共 ${summary.total} 个租户，${summary.withProject} 个有项目，${summary.convertible} 个可转正`,
      )
    } catch (e) {
      setPhase('idle')
      toast.error(e instanceof Error ? e.message : '查询失败，请稍后重试')
    }
  }

  const onConfirmConversion = async () => {
    if (selectedProjectIds.length === 0) {
      toast.error('请至少选择一个可转正的项目')
      return
    }
    if (!conversionDate) {
      toast.error('请选择转正日期')
      return
    }

    setPhase('committing')
    try {
      const commitResult = await commitMutation.mutateAsync({
        projectIds: selectedProjectIds,
        conversionDate,
      })
      setPhase('done')

      if (commitResult.errors.length > 0) {
        toast.warning(
          `转正完成：成功 ${commitResult.converted} 个，失败 ${commitResult.errors.length} 个`,
          {
            description: commitResult.errors
              .slice(0, 2)
              .map((e) => `${e.projectId}: ${e.message}`)
              .join('\n'),
          },
        )
      } else {
        toast.success(`已成功转正 ${commitResult.converted} 个项目`)
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (e) {
      setPhase('results')
      toast.error(e instanceof Error ? e.message : '转正失败')
    }
  }

  const onTenantIdsChange = (value: string) => {
    setRawTenantIds(value)
    if (result) {
      setResult(null)
      setSelectedProjectIds([])
      setPhase('idle')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>转正查询</DialogTitle>
          <DialogDescription>
            输入多个平台租户 ID，查询租户信息、项目转正状态、账户余额与充值情况，并批量设置转正日期。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="conversion-query-tenant-ids">平台租户 ID</Label>
            <Textarea
              id="conversion-query-tenant-ids"
              placeholder={`输入租户 ID，支持逗号、空格或换行分隔，单次最多 ${PLATFORM_TENANT_IMPORT_MAX_IDS} 个`}
              value={rawTenantIds}
              disabled={loading}
              rows={3}
              onChange={(e) => onTenantIdsChange(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
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
                  共 {result.summary.total} 个租户 · 有项目 {result.summary.withProject} · 已转正{' '}
                  {result.summary.converted} · 可转正 {result.summary.convertible}
                </AlertDescription>
              </Alert>

              {result.summary.convertible === 0 && result.summary.total > 0 && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>当前查询结果中没有可转正的项目</AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelectableChecked}
                          disabled={loading || selectableRows.length === 0}
                          onCheckedChange={(checked) => toggleAll(checked === true)}
                          aria-label="全选可转正项目"
                        />
                      </TableHead>
                      <TableHead className="w-28">租户 ID</TableHead>
                      <TableHead>租户信息</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>阶段</TableHead>
                      <TableHead className="text-right">账户余额</TableHead>
                      <TableHead className="text-right">充值次数</TableHead>
                      <TableHead className="text-right">充值总额</TableHead>
                      <TableHead>客户转正日</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map((row) => {
                      const selectable = isSelectable(row)
                      const checked = row.projectId ? selectedProjectIds.includes(row.projectId) : false
                      return (
                        <TableRow key={row.platformTenantId}>
                          <TableCell>
                            <Checkbox
                              checked={checked}
                              disabled={loading || !selectable}
                              onCheckedChange={(value) => {
                                if (row.projectId) toggleRow(row.projectId, value === true)
                              }}
                              aria-label={`选择 ${row.platformTenantId}`}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.platformTenantId}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{row.tenantName}</div>
                              {row.companyName && row.companyName !== row.tenantName ? (
                                <div className="text-muted-foreground text-xs">{row.companyName}</div>
                              ) : null}
                              {row.customerName ? (
                                <div className="text-muted-foreground text-xs">客户：{row.customerName}</div>
                              ) : null}
                              {row.contactPhone ? (
                                <div className="text-muted-foreground text-xs">{row.contactPhone}</div>
                              ) : null}
                              {row.errors.length > 0 ? (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {row.errors.map((err) => (
                                    <Badge key={err} variant="destructive" className="font-normal">
                                      {err}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.projectName ? (
                              <span className="text-sm">{row.projectName}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.projectStage ? (
                              <StatusBadge status={row.projectStage} />
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(row.balance)}
                            {row.balanceSource === 'platform' ? (
                              <div className="text-muted-foreground text-xs font-normal">平台实时</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">{row.rechargeCount}</TableCell>
                          <TableCell className="text-right">{formatMoney(row.rechargeTotal)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {row.customerConversionDate ?? '—'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="grid max-w-xs gap-2">
                <Label htmlFor="conversion-query-date">转正日期</Label>
                <Input
                  id="conversion-query-date"
                  type="date"
                  value={conversionDate}
                  disabled={loading || selectableRows.length === 0}
                  onChange={(e) => setConversionDate(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {result && result.summary.convertible > 0 ? (
            <Button
              type="button"
              disabled={loading || selectedProjectIds.length === 0 || !conversionDate}
              onClick={() => void onConfirmConversion()}
            >
              {phase === 'committing' ? (
                <>
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                  处理中…
                </>
              ) : (
                `确认转正（${selectedProjectIds.length}）`
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
