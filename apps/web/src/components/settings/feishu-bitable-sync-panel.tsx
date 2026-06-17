'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconRefresh, IconTable } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
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
import { Switch } from '@workspace/ui/components/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { trpc } from '@/lib/trpc/client'
import {
  FEISHU_BITABLE_SYNC_KIND_LABELS,
  type FeishuBitableSyncConfigDto,
  type FeishuBitableSyncKind,
} from '@/lib/types/feishu-bitable-sync'

function formatDt(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

function statusBadge(status: string) {
  const labels: Record<string, string> = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    skipped: '跳过',
    partial: '部分成功',
  }
  const variant =
    status === 'success'
      ? 'default'
      : status === 'failed'
        ? 'destructive'
        : status === 'running'
          ? 'outline'
          : 'secondary'
  return <Badge variant={variant}>{labels[status] ?? status}</Badge>
}

type ConfigDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: FeishuBitableSyncConfigDto | null
  lockSupplierId?: string
  lockDataCenterId?: string
  lockDataCenterName?: string
  onSaved: () => void
}

function FeishuBitableSyncConfigDialog({
  open,
  onOpenChange,
  initial,
  lockSupplierId,
  lockDataCenterId,
  lockDataCenterName,
  onSaved,
}: ConfigDialogProps) {
  const utils = trpc.useUtils()
  const [supplierId, setSupplierId] = useState('')
  const [dataCenterId, setDataCenterId] = useState('')
  const [syncKind, setSyncKind] = useState<FeishuBitableSyncKind>('device_inventory')
  const [appToken, setAppToken] = useState('')
  const [tableId, setTableId] = useState('')
  const [viewId, setViewId] = useState('')
  const [filterFormula, setFilterFormula] = useState('')
  const [cronExpr, setCronExpr] = useState('15 * * * *')
  const [autoCommit, setAutoCommit] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [excelHeaders, setExcelHeaders] = useState<string[]>([])
  const [bitableFields, setBitableFields] = useState<
    Array<{ fieldId: string; fieldName: string; suggestedExcelHeader: string | null }>
  >([])
  const [fieldsLoading, setFieldsLoading] = useState(false)

  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, {
    enabled: open && !lockSupplierId,
  })
  const effectiveSupplierId = lockSupplierId ?? supplierId
  const { data: dataCenters = [] } = trpc.supplier.listDataCenters.useQuery(
    { supplierId: effectiveSupplierId },
    { enabled: open && Boolean(effectiveSupplierId) && !lockDataCenterId },
  )

  const listFieldsMutation = trpc.integration.feishu.bitableSync.listTableFields.useMutation()
  const upsertMutation = trpc.integration.feishu.bitableSync.upsertConfig.useMutation({
    onSuccess: () => {
      toast.success('同步配置已保存')
      void utils.integration.feishu.bitableSync.listConfigs.invalidate()
      onSaved()
      onOpenChange(false)
    },
    onError: (error) => toast.error(error.message),
  })

  useEffect(() => {
    if (!open) return
    setSupplierId(initial?.supplierId ?? lockSupplierId ?? '')
    setDataCenterId(initial?.dataCenterId ?? lockDataCenterId ?? '')
    setSyncKind(initial?.syncKind ?? 'device_inventory')
    setAppToken(initial?.appToken ?? '')
    setTableId(initial?.tableId ?? '')
    setViewId(initial?.viewId ?? '')
    setFilterFormula(initial?.filterFormula ?? '')
    setCronExpr(initial?.cronExpr ?? '15 * * * *')
    setAutoCommit(initial?.autoCommit ?? false)
    setEnabled(initial?.enabled ?? true)
    setFieldMapping(initial?.fieldMappingJson ?? {})
    setExcelHeaders([])
    setBitableFields([])
    setFieldsLoading(false)
  }, [open, initial, lockSupplierId, lockDataCenterId])

  const loadBitableFields = async (preserveMapping: boolean) => {
    if (!appToken.trim() || !tableId.trim()) {
      if (!preserveMapping) {
        toast.error('请先填写 app_token 与 table_id')
      }
      return
    }
    setFieldsLoading(true)
    try {
      const result = await listFieldsMutation.mutateAsync({
        appToken: appToken.trim(),
        tableId: tableId.trim(),
        syncKind,
      })
      setExcelHeaders(result.excelHeaders)
      setBitableFields(result.fields)
      if (!preserveMapping) {
        setFieldMapping(result.suggestedMapping)
        toast.success(
          `已拉取 ${result.fields.length} 个字段，自动匹配 ${Object.keys(result.suggestedMapping).length} 列`,
        )
      }
    } catch (error) {
      if (!preserveMapping) {
        toast.error(error instanceof Error ? error.message : '拉取字段失败')
      }
    } finally {
      setFieldsLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !initial?.id) return
    if (!appToken.trim() || !tableId.trim()) return
    void loadBitableFields(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在编辑弹窗打开时按已保存 token 拉字段名
  }, [open, initial?.id, appToken, tableId, syncKind])

  const onFetchFields = async () => {
    await loadBitableFields(false)
  }

  const onSave = () => {
    const sid = lockSupplierId ?? supplierId
    const dcId = lockDataCenterId ?? dataCenterId
    if (!sid || !dcId) {
      toast.error('请选择供应商与机房')
      return
    }
    upsertMutation.mutate({
      id: initial?.id || undefined,
      supplierId: sid,
      dataCenterId: dcId,
      syncKind,
      appToken: appToken.trim(),
      tableId: tableId.trim(),
      viewId: viewId.trim() || null,
      fieldMappingJson: fieldMapping,
      filterFormula: filterFormula.trim() || null,
      cronExpr: cronExpr.trim() || '15 * * * *',
      autoCommit,
      enabled,
    })
  }

  const mappingRows = useMemo(() => {
    if (bitableFields.length > 0) {
      return bitableFields.map((field) => ({
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        excelHeader:
          Object.entries(fieldMapping).find(([, id]) => id === field.fieldId)?.[0] ??
          field.suggestedExcelHeader ??
          '',
      }))
    }
    const fieldIds = [...new Set(Object.values(fieldMapping).filter(Boolean))]
    if (fieldIds.length === 0) return []
    return fieldIds.map((fieldId) => ({
      fieldId,
      fieldName: fieldsLoading ? '加载中…' : fieldId,
      excelHeader: Object.entries(fieldMapping).find(([, id]) => id === fieldId)?.[0] ?? '',
    }))
  }, [bitableFields, fieldMapping, fieldsLoading])

  const updateMappingForField = (fieldId: string, excelHeader: string) => {
    setFieldMapping((prev) => {
      const next = { ...prev }
      for (const [key, value] of Object.entries(next)) {
        if (value === fieldId) delete next[key]
      }
      if (excelHeader && excelHeader !== '__none__') {
        next[excelHeader] = fieldId
      }
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl min-w-[40vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? '编辑' : '新建'}飞书多维表格同步</DialogTitle>
          <DialogDescription>
            将飞书 Bitable 映射为设备导入表头；Bitable 字段名保持不变，仅在 CRM 侧绑定 Excel 标准列。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {!lockSupplierId ? (
            <div className="space-y-2">
              <Label>供应商</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {!lockDataCenterId ? (
            <div className="space-y-2">
              <Label>机房</Label>
              <Select value={dataCenterId} onValueChange={setDataCenterId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择机房" />
                </SelectTrigger>
                <SelectContent>
                  {dataCenters.map((dc) => (
                    <SelectItem key={dc.id} value={dc.id}>
                      {dc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : lockDataCenterName ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>机房</Label>
              <Input value={lockDataCenterName} disabled />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>同步类型</Label>
            <Select
              value={syncKind}
              onValueChange={(v) => setSyncKind(v as FeishuBitableSyncKind)}
              disabled={Boolean(initial?.id)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="device_inventory">设备主数据</SelectItem>
                <SelectItem value="device_changelog">设备变更</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cron 表达式</Label>
            <Input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>app_token</Label>
            <Input value={appToken} onChange={(e) => setAppToken(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>table_id</Label>
            <Input value={tableId} onChange={(e) => setTableId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>view_id（可选）</Label>
            <Input value={viewId} onChange={(e) => setViewId(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>filter 公式（可选）</Label>
            <Input
              value={filterFormula}
              onChange={(e) => setFilterFormula(e.target.value)}
              placeholder="飞书 filter 表达式"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="bitable-enabled" />
            <Label htmlFor="bitable-enabled">启用定时同步</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={autoCommit} onCheckedChange={setAutoCommit} id="bitable-auto-commit" />
            <Label htmlFor="bitable-auto-commit">自动入库（默认仅解析）</Label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void onFetchFields()}
            disabled={listFieldsMutation.isPending || fieldsLoading}
          >
            {listFieldsMutation.isPending || fieldsLoading ? (
              <IconLoader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <IconRefresh className="mr-1 h-4 w-4" />
            )}
            拉取字段并自动匹配
          </Button>
        </div>

        {mappingRows.length > 0 ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bitable 字段名</TableHead>
                  <TableHead>field_id</TableHead>
                  <TableHead>映射 Excel 列</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappingRows.map((row) => (
                  <TableRow key={row.fieldId}>
                    <TableCell className="font-medium">{row.fieldName}</TableCell>
                    <TableCell>
                      <code className="text-xs">{row.fieldId}</code>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={row.excelHeader || '__none__'}
                        onValueChange={(v) => updateMappingForField(row.fieldId, v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="不映射" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">不映射</SelectItem>
                          {(excelHeaders.length
                            ? excelHeaders
                            : Object.keys(FEISHU_BITABLE_SYNC_KIND_LABELS)
                          ).length > 0
                            ? (excelHeaders.length
                                ? excelHeaders
                                : [
                                    '设备ID',
                                    '内网IP地址',
                                    '内网IP',
                                    '设备标识',
                                    '显卡型号',
                                    '显卡数量',
                                    '设备状态',
                                    '维修中',
                                    '操作时间',
                                    '变更动作',
                                    '变更内容',
                                    '详细说明',
                                    '工单',
                                  ]
                              ).map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))
                            : null}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onSave} disabled={upsertMutation.isPending}>
            {upsertMutation.isPending ? <IconLoader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type FeishuBitableSyncPanelProps = {
  supplierId?: string
  dataCenterId?: string
  dataCenterName?: string
  compact?: boolean
  onSyncSuccess?: () => void
}

export function FeishuBitableSyncPanel({
  supplierId,
  dataCenterId,
  dataCenterName,
  compact = false,
  onSyncSuccess,
}: FeishuBitableSyncPanelProps) {
  const utils = trpc.useUtils()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FeishuBitableSyncConfigDto | null>(null)
  const [jobConfigId, setJobConfigId] = useState<string | null>(null)

  const { data: configs = [], isLoading, refetch } =
    trpc.integration.feishu.bitableSync.listConfigs.useQuery({
      supplierId,
      dataCenterId,
    })

  const { data: jobRuns } = trpc.integration.feishu.bitableSync.listJobRuns.useQuery(
    { configId: jobConfigId ?? undefined, limit: 5 },
    { enabled: Boolean(jobConfigId) },
  )

  const previewMutation = trpc.integration.feishu.bitableSync.preview.useMutation({
    onSuccess: (result) => {
      toast.success(
        `试跑完成：${result.parsedRowCount} 行，成功 ${result.okCount}，警告 ${result.warningCount}，错误 ${result.errorCount}`,
      )
    },
    onError: (error) => toast.error(error.message),
  })

  const runMutation = trpc.integration.feishu.bitableSync.runNow.useMutation({
    onSuccess: (result) => {
      toast.success(result.message ?? `同步完成：${result.status}`)
      void utils.integration.feishu.bitableSync.listConfigs.invalidate()
      void utils.integration.feishu.bitableSync.listJobRuns.invalidate()
      if (result.status === 'success' && result.commit) {
        onSyncSuccess?.()
      }
    },
    onError: (error) => toast.error(error.message),
  })

  const deleteMutation = trpc.integration.feishu.bitableSync.deleteConfig.useMutation({
    onSuccess: () => {
      toast.success('已删除')
      void refetch()
    },
    onError: (error) => toast.error(error.message),
  })

  const openCreate = (kind: FeishuBitableSyncKind) => {
    setEditing({
      id: '',
      supplierId: supplierId ?? '',
      supplierName: '',
      dataCenterId: dataCenterId ?? '',
      dataCenterName: dataCenterName ?? '',
      dataCenterCode: '',
      syncKind: kind,
      appToken: '',
      tableId: '',
      viewId: null,
      fieldMappingJson: {},
      filterFormula: null,
      cronExpr: '15 * * * *',
      autoCommit: false,
      cursorJson: {},
      enabled: true,
      lastRunAt: null,
      lastSuccessAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setDialogOpen(true)
  }

  const content = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compact ? (
          <div>
            <p className="text-sm text-muted-foreground">
              定时从飞书多维表格同步设备主数据与变更记录，复用 Excel 导入解析与入库逻辑
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {dataCenterId ? (
            <>
              <Button size="sm" variant="outline" onClick={() => openCreate('device_inventory')}>
                新建主数据同步
              </Button>
              <Button size="sm" variant="outline" onClick={() => openCreate('device_changelog')}>
                新建变更同步
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => openCreate('device_inventory')}>
              新建同步配置
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">加载中…</p>
      ) : configs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">暂无同步配置</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!dataCenterId ? <TableHead>机房</TableHead> : null}
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>自动入库</TableHead>
                <TableHead>上次成功</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.map((config) => (
                <TableRow key={config.id}>
                  {!dataCenterId ? (
                    <TableCell>
                      {config.dataCenterName}
                      <div className="text-xs text-muted-foreground">{config.supplierName}</div>
                    </TableCell>
                  ) : null}
                  <TableCell>{FEISHU_BITABLE_SYNC_KIND_LABELS[config.syncKind]}</TableCell>
                  <TableCell>
                    <Badge variant={config.enabled ? 'default' : 'secondary'}>
                      {config.enabled ? '启用' : '禁用'}
                    </Badge>
                  </TableCell>
                  <TableCell>{config.autoCommit ? '是' : '否（仅解析）'}</TableCell>
                  <TableCell className="text-xs">{formatDt(config.lastSuccessAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(config)
                          setDialogOpen(true)
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => previewMutation.mutate({ configId: config.id })}
                        disabled={previewMutation.isPending}
                      >
                        试跑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setJobConfigId(config.id)
                          runMutation.mutate({ configId: config.id })
                        }}
                        disabled={runMutation.isPending}
                      >
                        立即同步
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('确定删除该同步配置？')) {
                            deleteMutation.mutate({ id: config.id })
                          }
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {jobConfigId && jobRuns?.items.length ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">最近任务</p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>摘要</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobRuns.items.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-xs">{formatDt(run.startedAt)}</TableCell>
                    <TableCell>{statusBadge(run.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                      {run.errorMessage ??
                        (run.responseSummary?.message as string | undefined) ??
                        '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <FeishuBitableSyncConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        lockSupplierId={supplierId}
        lockDataCenterId={dataCenterId}
        lockDataCenterName={dataCenterName}
        onSaved={() => void refetch()}
      />
    </>
  )

  if (compact) {
    return <div className="space-y-4">{content}</div>
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <IconTable className="h-4 w-4" />
          飞书多维表格同步
        </CardTitle>
        <CardDescription>按机房配置 Bitable 与 Excel 列映射，支持定时与手动同步</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{content}</CardContent>
    </Card>
  )
}
