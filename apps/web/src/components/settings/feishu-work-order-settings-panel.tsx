'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconLoader2, IconRefresh, IconTicket } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
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
  DEFAULT_FEISHU_WORK_ORDER_DEFAULTS,
  FEISHU_WORK_ORDER_FIELD_KEY_LABELS,
  FEISHU_WORK_ORDER_INBOUND_CHANNEL_LABELS,
  type FeishuWorkOrderBackend,
  type FeishuWorkOrderFieldKey,
  type FeishuWorkOrderInboundChannel,
} from '@/lib/types/feishu-work-order'

const FIELD_KEYS = Object.keys(FEISHU_WORK_ORDER_FIELD_KEY_LABELS) as FeishuWorkOrderFieldKey[]

export function FeishuWorkOrderSettingsPanel() {
  const utils = trpc.useUtils()
  const { data: config, isLoading } = trpc.integration.feishu.workOrder.getConfig.useQuery()
  const { data: clientConfig } = trpc.integration.feishu.getClientConfig.useQuery()

  const [appToken, setAppToken] = useState('')
  const [tableId, setTableId] = useState('')
  const [viewId, setViewId] = useState('')
  const [workOrderBackend, setWorkOrderBackend] = useState<FeishuWorkOrderBackend>('bitable')
  const [enabled, setEnabled] = useState(true)
  const [module, setModule] = useState(DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.module ?? '')
  const [priority, setPriority] = useState(DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.priority ?? '')
  const [category, setCategory] = useState(DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.category ?? '')
  const [initialStatus, setInitialStatus] = useState(
    DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.initial_status ?? '',
  )
  const [assigneeOpenIds, setAssigneeOpenIds] = useState('')
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [inboundChannel, setInboundChannel] = useState<FeishuWorkOrderInboundChannel>('bitable_automation')
  const [automationWebhookSecret, setAutomationWebhookSecret] = useState('')
  const [automationToken, setAutomationToken] = useState('')
  const [timelineOnEverySync, setTimelineOnEverySync] = useState(true)
  const [autoSyncInProgressStatus, setAutoSyncInProgressStatus] = useState(true)
  const [bitableFields, setBitableFields] = useState<
    Array<{ fieldId: string; fieldName: string; suggestedFieldKey: string | null }>
  >([])

  const listFieldsMutation = trpc.integration.feishu.workOrder.listTableFields.useMutation()
  const upsertMutation = trpc.integration.feishu.workOrder.upsertConfig.useMutation({
    onSuccess: () => {
      toast.success('飞书工单映射已保存')
      void utils.integration.feishu.workOrder.getConfig.invalidate()
      void utils.integration.feishu.getClientConfig.invalidate()
    },
    onError: (error) => toast.error(error.message),
  })

  useEffect(() => {
    if (!config) return
    setAppToken(config.appToken)
    setTableId(config.tableId)
    setViewId(config.viewId ?? '')
    setWorkOrderBackend(config.workOrderBackend)
    setEnabled(config.enabled)
    setModule(config.defaultsJson.module ?? DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.module ?? '')
    setPriority(config.defaultsJson.priority ?? DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.priority ?? '')
    setCategory(config.defaultsJson.category ?? DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.category ?? '')
    setInitialStatus(
      config.defaultsJson.initial_status ?? DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.initial_status ?? '',
    )
    setAssigneeOpenIds((config.defaultsJson.assignee_open_ids ?? []).join(', '))
    setFieldMapping(config.fieldMappingJson as Record<string, string>)
    setInboundChannel(config.inboundChannel)
    setAutomationWebhookSecret(config.automationWebhookSecret ?? '')
    setAutomationToken(config.automationToken ?? '')
    setTimelineOnEverySync(config.inboundPolicyJson.timeline_on_every_sync !== false)
    setAutoSyncInProgressStatus(config.inboundPolicyJson.auto_sync_in_progress_status !== false)
  }, [config])

  const onFetchFields = async () => {
    if (!appToken.trim() || !tableId.trim()) {
      toast.error('请先填写 app_token 与 table_id')
      return
    }
    try {
      const result = await listFieldsMutation.mutateAsync({
        appToken: appToken.trim(),
        tableId: tableId.trim(),
      })
      setBitableFields(result.fields)
      setFieldMapping(result.suggestedMapping)
      toast.success(
        `已拉取 ${result.fields.length} 个字段，自动匹配 ${Object.keys(result.suggestedMapping).length} 列`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '拉取字段失败')
    }
  }

  const onSave = () => {
    if (!appToken.trim() || !tableId.trim()) {
      toast.error('请填写 app_token 与 table_id')
      return
    }
    const mapping: Record<string, string> = {}
    for (const [key, fieldId] of Object.entries(fieldMapping)) {
      if (fieldId?.trim()) mapping[key] = fieldId.trim()
    }
    upsertMutation.mutate({
      appToken: appToken.trim(),
      tableId: tableId.trim(),
      viewId: viewId.trim() || null,
      workOrderBackend,
      enabled,
      fieldMappingJson: mapping,
      defaultsJson: {
        module: module.trim() || undefined,
        priority: priority.trim() || undefined,
        category: category.trim() || undefined,
        initial_status: initialStatus.trim() || undefined,
        assignee_open_ids: assigneeOpenIds
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      },
      inboundChannel,
      automationWebhookSecret: automationWebhookSecret.trim() || null,
      automationToken: automationToken.trim() || null,
      inboundPolicyJson: {
        timeline_on_every_sync: timelineOnEverySync,
        timeline_on_terminal_only: !timelineOnEverySync,
        auto_sync_in_progress_status: autoSyncInProgressStatus,
      },
    })
  }

  const mappingRows = useMemo(() => {
    return FIELD_KEYS.map((fieldKey) => ({
      fieldKey,
      label: FEISHU_WORK_ORDER_FIELD_KEY_LABELS[fieldKey],
      fieldId: fieldMapping[fieldKey] ?? '',
    }))
  }, [fieldMapping])

  const updateMapping = (fieldKey: FeishuWorkOrderFieldKey, fieldId: string) => {
    setFieldMapping((prev) => {
      const next = { ...prev }
      if (!fieldId || fieldId === '__none__') {
        delete next[fieldKey]
      } else {
        next[fieldKey] = fieldId
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <IconLoader2 className="h-4 w-4 animate-spin" />
        加载配置中…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <IconTicket className="h-5 w-5" />
            飞书工单映射
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            配置运营工单多维表格与 CRM 批次字段映射。建单后回填「工单ID编号」作为 work_order_no。
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          {clientConfig?.integrationConfigured ? (
            <Badge variant="outline">飞书凭证已配置</Badge>
          ) : (
            <Badge variant="destructive">飞书凭证未配置</Badge>
          )}
          {clientConfig?.workOrderConfigured && clientConfig.workOrderBackend === 'bitable' ? (
            <Badge>Bitable 工单已启用</Badge>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">多维表格连接</CardTitle>
          <CardDescription>与设备库存同步表独立；此处为运营工单表。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>app_token</Label>
              <Input value={appToken} onChange={(e) => setAppToken(e.target.value)} placeholder="多维表格 app_token" />
            </div>
            <div className="space-y-2">
              <Label>table_id</Label>
              <Input value={tableId} onChange={(e) => setTableId(e.target.value)} placeholder="数据表 table_id" />
            </div>
            <div className="space-y-2">
              <Label>view_id（可选）</Label>
              <Input value={viewId} onChange={(e) => setViewId(e.target.value)} placeholder="视图 ID" />
            </div>
            <div className="space-y-2">
              <Label>工单载体</Label>
              <Select value={workOrderBackend} onValueChange={(v) => setWorkOrderBackend(v as FeishuWorkOrderBackend)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bitable">多维表格（推荐）</SelectItem>
                  <SelectItem value="approval">飞书审批（兼容）</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">启用自动建单</p>
              <p className="text-xs text-muted-foreground">关闭后批次创建不会写入飞书工单表</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void onFetchFields()}
            disabled={listFieldsMutation.isPending}
          >
            {listFieldsMutation.isPending ? (
              <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <IconRefresh className="h-4 w-4 mr-2" />
            )}
            拉取表字段并自动匹配
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">建单默认值</CardTitle>
          <CardDescription>须与 Bitable 单选/人员字段选项完全一致（如「紧急-P0」「待审核」）。</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>所属模块</Label>
            <Input value={module} onChange={(e) => setModule(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>优先级</Label>
            <Input value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="紧急-P0" />
          </div>
          <div className="space-y-2">
            <Label>工单分类</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>初始状态</Label>
            <Input value={initialStatus} onChange={(e) => setInitialStatus(e.target.value)} placeholder="待审核" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>默认经办人 user_id / open_id</Label>
            <Input
              value={assigneeOpenIds}
              onChange={(e) => setAssigneeOpenIds(e.target.value)}
              placeholder="曲耀亮的飞书 user_id（u- 开头）或 open_id（ou_ 开头），多个用逗号分隔"
            />
            <p className="text-xs text-muted-foreground">
              需使用当前 CRM 飞书应用下的 ID；user_id 与 open_id 不可混用。可在飞书开放平台或通讯录 API 获取。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">入站同步（状态回写 CRM）</CardTitle>
          <CardDescription>
            默认使用多维表格自动化 HTTP。在自动化流程中，当「当前状态」变更时 POST 到下方 URL。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>入站通道</Label>
              <Select
                value={inboundChannel}
                onValueChange={(v) => setInboundChannel(v as FeishuWorkOrderInboundChannel)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(FEISHU_WORK_ORDER_INBOUND_CHANNEL_LABELS) as Array<
                      [FeishuWorkOrderInboundChannel, string]
                    >
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>自动化入站 URL</Label>
              <Input
                readOnly
                value={clientConfig?.automationInboundUrl ?? '请先配置 APP_BASE_URL 与 FEISHU_AUTOMATION_SECRET'}
              />
              <p className="text-xs text-muted-foreground">
                飞书自动化「发送 HTTP 请求」使用该地址；secret 来自下方配置或环境变量 FEISHU_AUTOMATION_SECRET。
              </p>
            </div>
            <div className="space-y-2">
              <Label>自动化 URL secret（可选）</Label>
              <Input
                value={automationWebhookSecret}
                onChange={(e) => setAutomationWebhookSecret(e.target.value)}
                placeholder="留空则使用 FEISHU_AUTOMATION_SECRET"
              />
            </div>
            <div className="space-y-2">
              <Label>Header Token（可选）</Label>
              <Input
                value={automationToken}
                onChange={(e) => setAutomationToken(e.target.value)}
                placeholder="X-Feishu-Automation-Token"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">每次同步写入时间线</p>
              <p className="text-xs text-muted-foreground">含全字段快照；关闭则仅终态（已结束/已终止）写入</p>
            </div>
            <Switch checked={timelineOnEverySync} onCheckedChange={setTimelineOnEverySync} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">「处理中」推进批次中间态</p>
              <p className="text-xs text-muted-foreground">映射为接入中 / 下架中 / 占用中（按批次类型）</p>
            </div>
            <Switch checked={autoSyncInProgressStatus} onCheckedChange={setAutoSyncInProgressStatus} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">字段映射</CardTitle>
          <CardDescription>CRM 字段键 → Bitable field_id。工单ID编号建单后由飞书自动编号并回填。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CRM 字段</TableHead>
                <TableHead>Bitable 列</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappingRows.map((row) => (
                <TableRow key={row.fieldKey}>
                  <TableCell className="text-sm">{row.label}</TableCell>
                  <TableCell>
                    <Select
                      value={row.fieldId || '__none__'}
                      onValueChange={(v) => updateMapping(row.fieldKey, v)}
                    >
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue placeholder="未映射" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— 未映射 —</SelectItem>
                        {bitableFields.map((f) => (
                          <SelectItem key={f.fieldId} value={f.fieldId}>
                            {f.fieldName} ({f.fieldId.slice(0, 8)}…)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {bitableFields.length === 0 ? (
            <p className="text-xs text-muted-foreground mt-3">
              请先点击「拉取表字段」加载 Bitable 列列表；已保存的映射在加载配置后也会显示 field_id。
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={upsertMutation.isPending}>
          {upsertMutation.isPending ? <IconLoader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          保存配置
        </Button>
      </div>
    </div>
  )
}
