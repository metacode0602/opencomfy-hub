'use client'

import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  FileSpreadsheet,
  History,
  Loader2,
  Server,
  Upload,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Label } from '@workspace/ui/components/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import {
  parseDeviceChangelogCsv,
  parseDeviceInventoryCsv,
  parseFaultRecordsCsv,
} from '@/lib/supplier-ops/parse-device-import-csv'
import { IMPORT_STATUS_LABELS } from '@/lib/supplier/onboarding-batch-utils'
import {
  FAULT_IMPORT_STATUS_LABELS,
  buildChangeLogsFromChangelogImport,
  buildDevicesFromInventoryImport,
  buildFaultIncidentsFromRecordsImport,
  createFaultRecordsUploadBatch,
  createInventoryOnboardingBatch,
} from '@/lib/supplier/device-import-utils'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import type {
  DeviceChangelogParsedRow,
  DeviceInventoryParsedRow,
  FaultRecordsParsedRow,
  SupplierActivity,
} from '@/lib/types/supplier-domain'

export type DeviceImportKind = 'device_inventory' | 'device_changelog' | 'fault_records'

const IMPORT_META: Record<
  DeviceImportKind,
  {
    title: string
    description: string
    tableTarget: string
    batchTable: string
    columnsHint: string
    icon: typeof Server
  }
> = {
  device_inventory: {
    title: '设备主数据表',
    description: '导入 supplier_device、compute_node；含登录凭据（列表脱敏）',
    tableTarget: 'supplier_device + compute_node',
    batchTable: 'onboarding_batch（device_inventory）',
    columnsHint: '设备ID、内网IP、设备标识、显卡型号、设备状态、维修中、登录用户名/密码、K8s集群等',
    icon: Server,
  },
  device_changelog: {
    title: '设备变更表',
    description: '每次上传新建批次；仅写入 supplier_device_change_log，并刷新设备状态',
    tableTarget: 'supplier_device_change_log',
    batchTable: 'onboarding_batch（device_changelog）',
    columnsHint: '设备ID、内网IP、操作时间、变更动作、变更内容、工单',
    icon: History,
  },
  fault_records: {
    title: '故障记录表',
    description: '导入 fault_incident；容器为 supplier_ops_upload_batch',
    tableTarget: 'fault_incident',
    batchTable: 'supplier_ops_upload_batch（fault_records）',
    columnsHint: '记录时间、解决时间、故障类型、影响时长、影响范围、影响台数、故障复盘',
    icon: AlertTriangle,
  },
}

type WizardStep = 'meta' | 'upload' | 'preview'

interface SupplierDeviceImportPanelProps {
  supplierId: string
  defaultKind?: DeviceImportKind
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ParseStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'ok'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : status === 'warning'
        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
        : 'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <Badge variant="outline" className={cls}>
      {status === 'ok' ? '通过' : status === 'warning' ? '警告' : '失败'}
    </Badge>
  )
}

export function SupplierDeviceImportPanel({
  supplierId,
  defaultKind = 'device_inventory',
}: SupplierDeviceImportPanelProps) {
  const suppliers = useSupplierDomainMockStore((s) => s.suppliers)
  const dataCenters = useSupplierDomainMockStore((s) => s.dataCenters)
  const onboardingBatches = useSupplierDomainMockStore((s) => s.onboardingBatches)
  const opsUploadBatches = useSupplierDomainMockStore((s) => s.opsUploadBatches)
  const deviceChangeLogs = useSupplierDomainMockStore((s) => s.deviceChangeLogs)
  const devices = useSupplierDomainMockStore((s) => s.devices)

  const upsertOnboardingBatch = useSupplierDomainMockStore((s) => s.upsertOnboardingBatch)
  const upsertDevice = useSupplierDomainMockStore((s) => s.upsertDevice)
  const upsertComputeNode = useSupplierDomainMockStore((s) => s.upsertComputeNode)
  const upsertDeviceChangeLog = useSupplierDomainMockStore((s) => s.upsertDeviceChangeLog)
  const upsertOpsUploadBatch = useSupplierDomainMockStore((s) => s.upsertOpsUploadBatch)
  const upsertFaultIncident = useSupplierDomainMockStore((s) => s.upsertFaultIncident)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const supplier = suppliers.find((s) => s.id === supplierId)
  const supplierDcs = useMemo(
    () => dataCenters.filter((dc) => dc.supplier_id === supplierId),
    [dataCenters, supplierId],
  )
  const recentInventoryBatches = useMemo(
    () =>
      onboardingBatches
        .filter((b) => b.supplier_id === supplierId && b.batch_kind === 'device_inventory')
        .slice(0, 5),
    [onboardingBatches, supplierId],
  )
  const recentChangelogBatches = useMemo(
    () =>
      onboardingBatches
        .filter((b) => b.supplier_id === supplierId && b.batch_kind === 'device_changelog')
        .slice(0, 5),
    [onboardingBatches, supplierId],
  )
  const recentFaultBatches = useMemo(
    () =>
      opsUploadBatches
        .filter((b) => b.supplier_id === supplierId && b.kind === 'fault_records')
        .slice(0, 5),
    [opsUploadBatches, supplierId],
  )
  const changeLogCount = useMemo(
    () => deviceChangeLogs.filter((l) => devices.some((d) => d.id === l.supplier_device_id && d.supplier_id === supplierId)).length,
    [deviceChangeLogs, devices, supplierId],
  )

  const [activeKind, setActiveKind] = useState<DeviceImportKind>(defaultKind)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('meta')
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [dataCenterId, setDataCenterId] = useState('')
  const [fileName, setFileName] = useState('')
  const [inventoryRows, setInventoryRows] = useState<DeviceInventoryParsedRow[]>([])
  const [changelogRows, setChangelogRows] = useState<DeviceChangelogParsedRow[]>([])
  const [faultRows, setFaultRows] = useState<FaultRecordsParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [pendingBatchId, setPendingBatchId] = useState<string | null>(null)

  const meta = IMPORT_META[activeKind]

  const resetWizard = () => {
    setWizardStep('meta')
    setDataCenterId('')
    setFileName('')
    setInventoryRows([])
    setChangelogRows([])
    setFaultRows([])
    setParseError(null)
    setPendingBatchId(null)
    setParsing(false)
    setCommitting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const openWizard = (kind: DeviceImportKind) => {
    setActiveKind(kind)
    resetWizard()
    setWizardOpen(true)
  }

  const needsDc = activeKind !== 'fault_records'

  const onParseFile = async (file: File) => {
    setParseError(null)
    setParsing(true)
    const text = await file.text()
    setParsing(false)
    setFileName(file.name)

    if (activeKind === 'device_inventory') {
      const result = parseDeviceInventoryCsv(text)
      if (!result.ok) {
        setParseError(result.error)
        return
      }
      setInventoryRows(result.rows)
      setWizardStep('preview')
      toast.success(`解析 ${result.rows.length} 行`)
      return
    }

    if (activeKind === 'device_changelog') {
      const result = parseDeviceChangelogCsv(text)
      if (!result.ok) {
        setParseError(result.error)
        return
      }
      setChangelogRows(result.rows)
      setWizardStep('preview')
      toast.success(`解析 ${result.rows.length} 行`)
      return
    }

    const result = parseFaultRecordsCsv(text)
    if (!result.ok) {
      setParseError(result.error)
      return
    }
    setFaultRows(result.rows)
    setWizardStep('preview')
    toast.success(`解析 ${result.rows.length} 行`)
  }

  const saveParsedBatch = (): string | null => {
    if (!supplier) return null
    const dc = dataCenters.find((d) => d.id === dataCenterId)

    if (activeKind === 'fault_records') {
      const idc = dc?.code ?? supplierDcs[0]?.code ?? 'DEFAULT-DC'
      const batch = createFaultRecordsUploadBatch({
        supplierId,
        idcCode: idc,
        fileName,
        rows: faultRows,
        createId,
      })
      upsertOpsUploadBatch(batch)
      setPendingBatchId(batch.id)
      return batch.id
    }

    if (!dc) {
      toast.error('请选择机房')
      return null
    }

    const batch = createInventoryOnboardingBatch({
      batchKind: activeKind,
      supplier,
      dc,
      contractId: '',
      accessSheetId: '',
      fileName,
      rows: activeKind === 'device_inventory' ? inventoryRows : changelogRows,
      createId,
    })
    upsertOnboardingBatch(batch)
    setPendingBatchId(batch.id)
    return batch.id
  }

  const commitImport = () => {
    if (!supplier) return
    setCommitting(true)
    const now = new Date().toISOString()
    let batchId = pendingBatchId
    if (!batchId) batchId = saveParsedBatch()
    if (!batchId) {
      setCommitting(false)
      return
    }

    if (activeKind === 'device_inventory') {
      const batch = useSupplierDomainMockStore.getState().onboardingBatches.find((b) => b.id === batchId)
      const dc = dataCenters.find((d) => d.id === dataCenterId)
      if (!batch || !dc) {
        setCommitting(false)
        return
      }
      const { devices: newDevices, nodes } = buildDevicesFromInventoryImport({
        batchId,
        supplierId,
        contractId: null,
        dataCenterId: dc.id,
        idcCode: dc.code,
        idcRegion: dc.location,
        cardTypeDefault: 'A100-80G',
        rows: inventoryRows,
        createId,
      })
      for (const d of newDevices) upsertDevice(d)
      for (const n of nodes) upsertComputeNode(n)
      upsertOnboardingBatch({
        ...batch,
        import_status: 'committed',
        batch_status: '已完成',
        committed_device_count: newDevices.length,
        committed_at: now,
        updated_at: now,
      })
      const activity: SupplierActivity = {
        id: createId('act'),
        supplier_id: supplierId,
        type: 'ops_import',
        title: `设备主数据导入 ${batch.batch_code}`,
        description: `写入 ${newDevices.length} 台物理机（Mock）`,
        author_name: '运营（mock）',
        author_role: 'ops',
        ref_domain: 'batch',
        ref_id: batchId,
        occurred_at: now,
      }
      upsertSupplierActivity(activity)
      toast.success(`已入库 ${newDevices.length} 台设备`)
    } else if (activeKind === 'device_changelog') {
      const batch = useSupplierDomainMockStore.getState().onboardingBatches.find((b) => b.id === batchId)
      if (!batch) {
        setCommitting(false)
        return
      }
      const supplierDevices = useSupplierDomainMockStore.getState().devices.filter(
        (d) => d.supplier_id === supplierId,
      )
      const { logs, updatedDevices } = buildChangeLogsFromChangelogImport({
        batchId,
        rows: changelogRows,
        devices: supplierDevices,
        createId,
      })
      for (const log of logs) upsertDeviceChangeLog(log)
      for (const d of updatedDevices) upsertDevice(d)
      upsertOnboardingBatch({
        ...batch,
        import_status: 'committed',
        batch_status: '已完成',
        committed_device_count: logs.length,
        committed_at: now,
        updated_at: now,
      })
      const activity: SupplierActivity = {
        id: createId('act'),
        supplier_id: supplierId,
        type: 'device_change_imported',
        title: `设备变更导入 ${batch.batch_code}`,
        description: `追加 ${logs.length} 条变更审计（不写 entity_state_transition_log）`,
        author_name: '运营（mock）',
        author_role: 'ops',
        ref_domain: 'batch',
        ref_id: batchId,
        occurred_at: now,
      }
      upsertSupplierActivity(activity)
      toast.success(`已写入 ${logs.length} 条变更记录`)
    } else {
      const batch = useSupplierDomainMockStore.getState().opsUploadBatches.find((b) => b.id === batchId)
      if (!batch) {
        setCommitting(false)
        return
      }
      const incidents = buildFaultIncidentsFromRecordsImport({
        batchId,
        supplierId,
        rows: faultRows,
        createId,
      })
      for (const f of incidents) upsertFaultIncident(f)
      upsertOpsUploadBatch({
        ...batch,
        import_status: 'committed',
        committed_incident_count: incidents.length,
        committed_at: now,
      })
      const activity: SupplierActivity = {
        id: createId('act'),
        supplier_id: supplierId,
        type: 'fault_opened',
        title: `故障记录导入 ${batch.file_name}`,
        description: `写入 ${incidents.length} 条故障事件`,
        author_name: '运营（mock）',
        author_role: 'ops',
        ref_domain: 'ops_upload_batch',
        ref_id: batchId,
        occurred_at: now,
      }
      upsertSupplierActivity(activity)
      toast.success(`已入库 ${incidents.length} 条故障记录`)
    }

    setCommitting(false)
    setWizardOpen(false)
    resetWizard()
  }

  const previewRows =
    activeKind === 'device_inventory'
      ? inventoryRows
      : activeKind === 'device_changelog'
        ? changelogRows
        : faultRows

  const okCount = previewRows.filter((r) => r.parse_status === 'ok').length
  const warnCount = previewRows.filter((r) => r.parse_status === 'warning').length

  if (!supplier) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">未找到供应商</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-foreground">运维数据导入</h2>
        <p className="text-sm text-muted-foreground mt-1">
          三类 Excel/CSV 批量导入（仅 Mock，不写库）；依据 supplier-device-import-schema.md
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {(Object.keys(IMPORT_META) as DeviceImportKind[]).map((kind) => {
          const m = IMPORT_META[kind]
          const Icon = m.icon
          return (
            <Card key={kind} className="border-border">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base">{m.title}</CardTitle>
                </div>
                <CardDescription className="text-xs">{m.tableTarget}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
                <p className="text-xs font-mono text-muted-foreground">{m.batchTable}</p>
                <Button size="sm" className="w-full gap-2" onClick={() => openWizard(kind)}>
                  <Upload className="w-4 h-4" />
                  上传导入
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">设备主数据批次</TabsTrigger>
          <TabsTrigger value="changelog">变更批次 ({recentChangelogBatches.length})</TabsTrigger>
          <TabsTrigger value="fault">故障导入 ({recentFaultBatches.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory" className="mt-4">
          <ImportBatchTable
            emptyHint="暂无设备主数据导入批次"
            rows={recentInventoryBatches.map((b) => ({
              id: b.id,
              code: b.batch_code,
              status: IMPORT_STATUS_LABELS[b.import_status] ?? b.import_status,
              count: `${b.committed_device_count} / ${b.parsed_success_count}`,
              time: formatDt(b.committed_at ?? b.parsed_at),
            }))}
          />
        </TabsContent>
        <TabsContent value="changelog" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">
            累计变更审计 {changeLogCount} 条（supplier_device_change_log）
          </p>
          <ImportBatchTable
            emptyHint="暂无设备变更导入批次"
            rows={recentChangelogBatches.map((b) => ({
              id: b.id,
              code: b.batch_code,
              status: IMPORT_STATUS_LABELS[b.import_status] ?? b.import_status,
              count: String(b.committed_device_count),
              time: formatDt(b.committed_at ?? b.parsed_at),
            }))}
          />
        </TabsContent>
        <TabsContent value="fault" className="mt-4">
          <ImportBatchTable
            emptyHint="暂无故障记录导入批次"
            rows={recentFaultBatches.map((b) => ({
              id: b.id,
              code: b.file_name,
              status: FAULT_IMPORT_STATUS_LABELS[b.import_status] ?? b.import_status,
              count: String(b.committed_incident_count),
              time: formatDt(b.committed_at ?? b.created_at),
            }))}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={wizardOpen} onOpenChange={(o) => { setWizardOpen(o); if (!o) resetWizard() }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              导入{meta.title}
            </DialogTitle>
            <DialogDescription>
              {meta.description} · 目标表 {meta.tableTarget}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 'meta' && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground rounded-md bg-muted/40 p-3">
                必需列：{meta.columnsHint}
              </p>
              {needsDc && (
                <div className="space-y-2">
                  <Label>机房</Label>
                  <Select value={dataCenterId} onValueChange={setDataCenterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择机房" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierDcs.map((dc) => (
                        <SelectItem key={dc.id} value={dc.id}>{dc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {activeKind === 'fault_records' && supplierDcs.length > 0 && (
                <div className="space-y-2">
                  <Label>默认机房编码（可选）</Label>
                  <Select value={dataCenterId} onValueChange={setDataCenterId}>
                    <SelectTrigger>
                      <SelectValue placeholder={supplierDcs[0]?.code ?? '选择机房'} />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierDcs.map((dc) => (
                        <SelectItem key={dc.id} value={dc.id}>{dc.code} · {dc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setWizardOpen(false)}>取消</Button>
                <Button
                  onClick={() => setWizardStep('upload')}
                  disabled={needsDc && !dataCenterId}
                >
                  下一步：上传文件
                </Button>
              </DialogFooter>
            </div>
          )}

          {wizardStep === 'upload' && (
            <div className="space-y-4 py-4">
              <div
                className="border border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">点击上传 CSV / TSV</p>
                <p className="text-xs text-muted-foreground mt-1">首行为表头，UTF-8 编码</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onParseFile(f)
                }}
              />
              {parsing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  解析中...
                </div>
              )}
              {parseError && <p className="text-sm text-destructive">{parseError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setWizardStep('meta')}>上一步</Button>
              </DialogFooter>
            </div>
          )}

          {wizardStep === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">{meta.title}</Badge>
                <span className="text-muted-foreground">
                  文件 {fileName} · 共 {previewRows.length} 行 · 通过 {okCount}
                  {warnCount > 0 ? ` · 警告 ${warnCount}` : ''}
                </span>
              </div>
              <div className="max-h-56 overflow-auto border rounded-md">
                <PreviewTable kind={activeKind} rows={previewRows} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWizardStep('upload')}>重新上传</Button>
                <Button
                  disabled={committing || okCount === 0}
                  onClick={() => {
                    if (!pendingBatchId) saveParsedBatch()
                    commitImport()
                  }}
                >
                  {committing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  确认入库（Mock）
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ImportBatchTable({
  rows,
  emptyHint,
}: {
  rows: { id: string; code: string; status: string; count: string; time: string }[]
  emptyHint: string
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">{emptyHint}</CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>批次 / 文件</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>已入库</TableHead>
            <TableHead>时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.code}</TableCell>
              <TableCell>{r.status}</TableCell>
              <TableCell>{r.count}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{r.time}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function PreviewTable({
  kind,
  rows,
}: {
  kind: DeviceImportKind
  rows: DeviceInventoryParsedRow[] | DeviceChangelogParsedRow[] | FaultRecordsParsedRow[]
}) {
  if (kind === 'device_inventory') {
    const inv = rows as DeviceInventoryParsedRow[]
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>行</TableHead>
            <TableHead>设备ID</TableHead>
            <TableHead>内网IP</TableHead>
            <TableHead>设备状态</TableHead>
            <TableHead>维修中</TableHead>
            <TableHead>校验</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inv.slice(0, 12).map((r) => (
            <TableRow key={r.row_no}>
              <TableCell>{r.row_no}</TableCell>
              <TableCell className="font-mono text-xs">{r.external_device_id ?? '—'}</TableCell>
              <TableCell>{r.internal_ip ?? '—'}</TableCell>
              <TableCell>{r.ops_status}</TableCell>
              <TableCell>{r.in_maintenance ? '是' : '否'}</TableCell>
              <TableCell>
                <ParseStatusBadge status={r.parse_status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  if (kind === 'device_changelog') {
    const ch = rows as DeviceChangelogParsedRow[]
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>行</TableHead>
            <TableHead>设备ID</TableHead>
            <TableHead>操作时间</TableHead>
            <TableHead>变更动作</TableHead>
            <TableHead>工单</TableHead>
            <TableHead>校验</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ch.slice(0, 12).map((r) => (
            <TableRow key={r.row_no}>
              <TableCell>{r.row_no}</TableCell>
              <TableCell className="font-mono text-xs">{r.external_device_id ?? '—'}</TableCell>
              <TableCell className="text-xs">{r.occurred_at}</TableCell>
              <TableCell>{r.change_action}</TableCell>
              <TableCell>{r.ticket_no ?? '—'}</TableCell>
              <TableCell>
                <ParseStatusBadge status={r.parse_status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  const fr = rows as FaultRecordsParsedRow[]
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>行</TableHead>
          <TableHead>记录时间</TableHead>
          <TableHead>故障类型</TableHead>
          <TableHead>影响台数</TableHead>
          <TableHead>校验</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fr.slice(0, 12).map((r) => (
          <TableRow key={r.row_no}>
            <TableCell>{r.row_no}</TableCell>
            <TableCell className="text-xs">{r.opened_at}</TableCell>
            <TableCell>{r.fault_type}</TableCell>
            <TableCell>{r.affected_device_count ?? '—'}</TableCell>
            <TableCell>
              <ParseStatusBadge status={r.parse_status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
