'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Network,
  Server,
  Shield,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import { LIFECYCLE_STATUS_COLORS, onboardingBatchDetailPath } from '@/lib/supplier/onboarding-batch-utils'
import {
  useAssigneeLabel,
  useBatchCode,
  useContractNo,
  useSupplierLabel,
} from '@/lib/supplier/supplier-domain-lookups'
import type { SupplierActivity, SupplierDevice } from '@/lib/types/supplier-domain'

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const reasonLabels: Record<string, string> = {
  BATCH_COMMITTED: '批次入库',
  ONBOARDING_DONE: '接入完成',
  SUBSTAGE_RACKING: '子阶段推进',
  OPS_STATUS_CHANGE: '运营变更',
}

const activityTypeLabels: Record<string, string> = {
  device_online: '上线',
  device_onboarding: '接入',
  ops_import: '导入',
  internal_test_hold: '测试',
  fault_opened: '故障',
  fault_closed: '故障',
}

function ChangeLogItem({
  fromState,
  toState,
  reasonCode,
  operatorId,
  occurredAt,
}: {
  fromState: string
  toState: string
  reasonCode: string
  operatorId: string
  occurredAt: string
}) {
  const operator = useAssigneeLabel(operatorId)
  return (
    <li className="p-4 flex gap-4">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Activity className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {fromState} → {toState}
          </span>
          <Badge variant="outline" className="text-xs">
            {reasonLabels[reasonCode] ?? reasonCode}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {operator} · {formatDt(occurredAt)}
        </p>
      </div>
    </li>
  )
}

function TaskRelationItem({
  taskType,
  assigneeId,
  taskStatus,
}: {
  taskType: string
  assigneeId: string
  taskStatus: string
}) {
  const assignee = useAssigneeLabel(assigneeId)
  return (
    <div className="flex justify-between items-start gap-4 p-3 rounded-md border border-border">
      <span className="font-medium text-sm">{taskType}</span>
      <span className="text-xs text-muted-foreground">{assignee} · {taskStatus}</span>
    </div>
  )
}

export function PhysicalDeviceDetailContent({ deviceId }: { deviceId: string }) {
  const device = useSupplierDomainMockStore((s) => s.devices.find((d) => d.id === deviceId))
  const computeNodes = useSupplierDomainMockStore((s) => s.computeNodes)
  const poolBindings = useSupplierDomainMockStore((s) => s.resourcePoolBindings)
  const transitionLogs = useSupplierDomainMockStore((s) => s.entityStateTransitionLogs)
  const deviceChangeLogs = useSupplierDomainMockStore((s) => s.deviceChangeLogs)
  const activities = useSupplierDomainMockStore((s) => s.supplierActivities)
  const faultIncidents = useSupplierDomainMockStore((s) => s.faultIncidents)
  const testHolds = useSupplierDomainMockStore((s) => s.internalTestHolds)
  const onboardingTasks = useSupplierDomainMockStore((s) => s.onboardingTasks)
  const upsertDevice = useSupplierDomainMockStore((s) => s.upsertDevice)
  const upsertEntityStateTransitionLog = useSupplierDomainMockStore((s) => s.upsertEntityStateTransitionLog)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const supplierName = useSupplierLabel(device?.supplier_id ?? '')
  const contractNo = useContractNo(device?.contract_id ?? '')
  const batchCode = useBatchCode(device?.onboarding_batch_id ?? '')
  const onboardingBatch = useSupplierDomainMockStore((s) =>
    device?.onboarding_batch_id
      ? s.onboardingBatches.find((b) => b.id === device.onboarding_batch_id)
      : undefined,
  )

  const detailNodes = useMemo(
    () => (device ? computeNodes.filter((n) => n.device_id === device.id) : []),
    [computeNodes, device],
  )
  const detailPool = useMemo(
    () => (device ? poolBindings.find((p) => p.device_id === device.id) : undefined),
    [poolBindings, device],
  )
  const changeLogs = useMemo(
    () =>
      transitionLogs
        .filter((log) => log.entity_type === 'device' && log.entity_id === deviceId)
        .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)),
    [transitionLogs, deviceId],
  )
  const importedChangeLogs = useMemo(
    () =>
      deviceChangeLogs
        .filter((log) => log.supplier_device_id === deviceId)
        .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)),
    [deviceChangeLogs, deviceId],
  )
  const relatedActivities = useMemo(
    () =>
      activities
        .filter((a) => a.ref_domain === 'device' && a.ref_id === deviceId)
        .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)),
    [activities, deviceId],
  )
  const relatedFaults = useMemo(
    () => faultIncidents.filter((f) => f.device_id === deviceId),
    [faultIncidents, deviceId],
  )
  const relatedHolds = useMemo(
    () =>
      device
        ? testHolds.filter(
            (h) =>
              h.data_center_id === device.data_center_id && h.card_type === device.card_type,
          )
        : [],
    [testHolds, device],
  )
  const relatedTasks = useMemo(
    () => onboardingTasks.filter((t) => t.device_id === deviceId),
    [onboardingTasks, deviceId],
  )

  const markOnline = (target: SupplierDevice) => {
    if (target.lifecycle_status === '在线') {
      toast.info('设备已在线')
      return
    }
    const now = new Date().toISOString()
    const from = target.lifecycle_status
    upsertDevice({
      ...target,
      lifecycle_status: '在线',
      onboarding_substage: '已完成',
      platform_resource_id: target.platform_resource_id ?? `res-${target.sn.toLowerCase()}`,
    })
    upsertEntityStateTransitionLog({
      id: createId('esl'),
      entity_type: 'device',
      entity_id: target.id,
      from_state: from,
      to_state: '在线',
      operator_id: 'staff-mock-01',
      reason_code: 'ONBOARDING_DONE',
      occurred_at: now,
    })
    const activity: SupplierActivity = {
      id: createId('act'),
      supplier_id: target.supplier_id,
      type: 'device_online',
      title: `设备 ${target.sn} 已上线`,
      description: `机房 ${target.idc_code}`,
      author_name: '运营（mock）',
      author_role: 'ops',
      ref_domain: 'device',
      ref_id: target.id,
      occurred_at: now,
    }
    upsertSupplierActivity(activity)
    toast.success('已标记上线')
  }

  if (!device) {
    return (
      <div className="space-y-4">
        <Link href="/supplier/devices">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回设备管理
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            未找到该物理机，可能尚未入库或 ID 无效
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/supplier/devices">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold font-mono">{device.sn}</h1>
              <Badge variant="outline" className={LIFECYCLE_STATUS_COLORS[device.lifecycle_status] ?? ''}>
                {device.lifecycle_status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {device.asset_no} · {device.idc_code} · {device.card_type}
            </p>
          </div>
        </div>
        {device.lifecycle_status !== '在线' && (
          <Button className="gap-2" onClick={() => markOnline(device)}>
            <CheckCircle2 className="w-4 h-4" />
            确认上线
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">GPU</p>
            <p className="text-xl font-semibold mt-1">{device.gpu_count} × {device.card_type}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">接入子阶段</p>
            <p className="text-xl font-semibold mt-1">{device.onboarding_substage}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">计算节点</p>
            <p className="text-xl font-semibold mt-1">{detailNodes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">变更记录</p>
            <p className="text-xl font-semibold mt-1">{changeLogs.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">基本信息</TabsTrigger>
          <TabsTrigger value="changes">变更记录 ({changeLogs.length})</TabsTrigger>
          <TabsTrigger value="relations">关联资源</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">设备标识</CardTitle>
                <CardDescription>SN 级物理机台账字段</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="设备 ID" value={<code>{device.id}</code>} />
                <InfoRow label="资产号" value={device.asset_no} />
                <InfoRow label="序列号 SN" value={<span className="font-mono">{device.sn}</span>} />
                <InfoRow
                  label="供应商"
                  value={
                    <Link href={`/supplier/suppliers/${device.supplier_id}`} className="text-primary hover:underline">
                      {supplierName}
                    </Link>
                  }
                />
                <InfoRow label="商务合同" value={contractNo} />
                <InfoRow
                  label="接入批次"
                  value={
                    <Link
                      href={
                        onboardingBatch
                          ? onboardingBatchDetailPath(onboardingBatch)
                          : '/supplier/online-tasks'
                      }
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      {batchCode}
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">网络与部署</CardTitle>
                <CardDescription>机房、IP 与平台资源映射</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="机房编码" value={device.idc_code} />
                <InfoRow label="区域" value={device.idc_region} />
                <InfoRow label="公网 IP" value={<span className="font-mono">{device.external_ip}</span>} />
                <InfoRow label="内网 IP" value={<span className="font-mono">{device.internal_ip}</span>} />
                <InfoRow
                  label="平台资源 ID"
                  value={device.platform_resource_id ? <code>{device.platform_resource_id}</code> : '—'}
                />
                {detailPool && (
                  <InfoRow label="资源池" value={detailPool.pool_code ?? detailPool.resource_pool_id ?? '—'} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4" />
                计算节点 ({detailNodes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detailNodes.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无节点</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>角色</TableHead>
                      <TableHead>管理 IP</TableHead>
                      <TableHead>集群</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailNodes.map((node) => (
                      <TableRow key={node.id}>
                        <TableCell>{node.node_role}</TableCell>
                        <TableCell className="font-mono text-xs">{node.mgmt_ip}</TableCell>
                        <TableCell>{node.cluster_id}</TableCell>
                        <TableCell>{node.lifecycle_status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changes" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                状态变更审计
              </CardTitle>
              <CardDescription>来自 entity_state_transition_log，不可修改</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {changeLogs.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">暂无状态变更记录</p>
              ) : (
                <ul className="divide-y divide-border">
                  {changeLogs.map((log) => (
                    <ChangeLogItem
                      key={log.id}
                      fromState={log.from_state}
                      toState={log.to_state}
                      reasonCode={log.reason_code}
                      operatorId={log.operator_id}
                      occurredAt={log.occurred_at}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Excel 变更导入审计</CardTitle>
              <CardDescription>来自 supplier_device_change_log（设备变更表批次）</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {importedChangeLogs.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground text-sm">暂无导入变更记录</p>
              ) : (
                <ul className="divide-y divide-border">
                  {importedChangeLogs.map((log) => (
                    <li key={log.id} className="p-4 text-sm space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{log.change_action}</span>
                        {log.ticket_no && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {log.ticket_no}
                          </Badge>
                        )}
                      </div>
                      {log.change_content && (
                        <p className="text-muted-foreground">{log.change_content}</p>
                      )}
                      {(log.previous_ops_status || log.new_ops_status) && (
                        <p className="text-xs text-muted-foreground">
                          状态 {log.previous_ops_status ?? '—'} → {log.new_ops_status ?? '—'}
                          {log.new_lifecycle_status ? ` · 生命周期 → ${log.new_lifecycle_status}` : ''}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDt(log.occurred_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {relatedActivities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">运营活动时间线</CardTitle>
                <CardDescription>用户可见事件投影</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {relatedActivities.map((a) => (
                    <li key={a.id} className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{a.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {activityTypeLabels[a.type] ?? a.type}
                        </Badge>
                      </div>
                      {a.description && (
                        <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {a.author_name} · {formatDt(a.occurred_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="relations" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">接入任务</CardTitle>
            </CardHeader>
            <CardContent>
              {relatedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无设备级任务</p>
              ) : (
                <div className="space-y-2">
                  {relatedTasks.map((task) => (
                    <TaskRelationItem
                      key={task.id}
                      taskType={task.task_type}
                      assigneeId={task.assignee_id}
                      taskStatus={task.task_status}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">故障事件</CardTitle>
            </CardHeader>
            <CardContent>
              {relatedFaults.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无关联故障</p>
              ) : (
                <div className="space-y-2">
                  {relatedFaults.map((fault) => (
                    <Link
                      key={fault.id}
                      href="/supplier/fault-incidents"
                      className="block hover:bg-muted/30 rounded-md transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4 p-3 rounded-md border border-border">
                        <span className="font-medium text-sm">{fault.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {fault.severity} · {fault.incident_status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">测试占用</CardTitle>
            </CardHeader>
            <CardContent>
              {relatedHolds.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无测试占用</p>
              ) : (
                <div className="space-y-2">
                  {relatedHolds.map((hold) => (
                    <Link
                      key={hold.id}
                      href="/supplier/test-holds"
                      className="block hover:bg-muted/30 rounded-md transition-colors"
                    >
                      <div className="flex justify-between items-start gap-4 p-3 rounded-md border border-border">
                        <span className="font-medium text-sm">
                          {hold.user_name} · {hold.card_type} × {hold.unit_count}台
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDt(hold.hold_from)} — {formatDt(hold.hold_until)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {detailPool && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Network className="w-4 h-4" />
                  资源池绑定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="池编码" value={detailPool.pool_code ?? '—'} />
                <InfoRow label="Workload" value={detailPool.workload_profile} />
                <InfoRow label="独占池" value={detailPool.is_exclusive_pool ? '是' : '否'} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  )
}
