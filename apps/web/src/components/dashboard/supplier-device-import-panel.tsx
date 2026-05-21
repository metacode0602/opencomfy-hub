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
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import {
  parseDeviceChangelogCsv,
  parseDeviceInventoryCsv,
  parseFaultRecordsCsv,
} from '@/lib/supplier-ops/parse-device-import-csv'
import { IMPORT_STATUS_LABELS } from '@/lib/supplier/onboarding-batch-utils'
import { FAULT_IMPORT_STATUS_LABELS } from '@/lib/supplier/device-import-utils'
import type {
  DeviceChangelogParsedRow,
  DeviceInventoryParsedRow,
  FaultRecordsParsedRow,
} from '@/lib/types/supplier-domain'
import { trpc } from '@/lib/trpc/client'

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '操作失败，请稍后重试'
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
  const utils = trpc.useUtils()

  const { data: supplier, isLoading: supplierLoading, isError: supplierError } =
    trpc.supplier.getById.useQuery({ id: supplierId }, { retry: 1 })

  const { data: dataCenters = [], isLoading: dcLoading } = trpc.supplier.listDataCenters.useQuery(
    { supplierId },
    { enabled: Boolean(supplierId) },
  )

  const {
    data: importContext,
    isLoading: contextLoading,
  } = trpc.supplier.deviceImport.getContext.useQuery({ supplierId }, { enabled: Boolean(supplierId) })

  const commitInventoryMutation = trpc.supplier.deviceImport.commitInventory.useMutation()
  const commitChangelogMutation = trpc.supplier.deviceImport.commitChangelog.useMutation()
  const commitFaultMutation = trpc.supplier.deviceImport.commitFaultRecords.useMutation()

  const [activeKind, setActiveKind] = useState<DeviceImportKind>(defaultKind)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('meta')
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [dataCenterId, setDataCenterId] = useState('')
  const [fileName, setFileName] = useState('')
  const [inventoryRows, setInventoryRows] = useState<DeviceInventoryParsedRow[]>([])
  const [changelogRows, setChangelogRows] = useState<DeviceChangelogParsedRow[]>([])
  const [faultRows, setFaultRows] = useState<FaultRecordsParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  const meta = IMPORT_META[activeKind]
  const needsDc = activeKind !== 'fault_records'

  const committing =
    commitInventoryMutation.isPending ||
    commitChangelogMutation.isPending ||
    commitFaultMutation.isPending

  const recentInventoryBatches = importContext?.inventoryBatches ?? []
  const recentChangelogBatches = importContext?.changelogBatches ?? []
  const recentFaultBatches = importContext?.faultBatches ?? []
  const changeLogCount = importContext?.changeLogCount ?? 0

  const resetWizard = () => {
    setWizardStep('meta')
    setDataCenterId('')
    setFileName('')
    setInventoryRows([])
    setChangelogRows([])
    setFaultRows([])
    setParseError(null)
    setParsing(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const openWizard = (kind: DeviceImportKind) => {
    setActiveKind(kind)
    resetWizard()
    setWizardOpen(true)
  }

  const invalidateAfterCommit = () => {
    void utils.supplier.deviceImport.getContext.invalidate({ supplierId })
    void utils.supplier.listPhysicalDevices.invalidate({ supplierId })
    void utils.supplier.getPhysicalDeviceStats.invalidate({ supplierId })
  }

  const onParseFile = async (file: File) => {
    setParseError(null)
    setParsing(true)
    try {
      const text = await file.text()
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
    } catch (e) {
      const message = getErrorMessage(e)
      setParseError(message)
      toast.error(message)
    } finally {
      setParsing(false)
    }
  }

  const commitImport = async () => {
    if (!supplier) return

    if (needsDc && !dataCenterId) {
      toast.error('请选择机房')
      return
    }

    const okCount = previewRows.filter((r) => r.parse_status === 'ok').length
    if (okCount === 0) {
      toast.error('没有通过校验的行可入库')
      return
    }

    try {
      let result
      if (activeKind === 'device_inventory') {
        result = await commitInventoryMutation.mutateAsync({
          supplierId,
          dataCenterId,
          fileName,
          rows: inventoryRows,
        })
        toast.success(`已入库 ${result.committedCount} 台设备`)
      } else if (activeKind === 'device_changelog') {
        result = await commitChangelogMutation.mutateAsync({
          supplierId,
          dataCenterId,
          fileName,
          rows: changelogRows,
        })
        toast.success(`已写入 ${result.committedCount} 条变更记录`)
      } else {
        result = await commitFaultMutation.mutateAsync({
          supplierId,
          dataCenterId: dataCenterId || undefined,
          fileName,
          rows: faultRows,
        })
        toast.success(`已入库 ${result.committedCount} 条故障记录`)
      }

      if (result.skippedCount > 0 || result.warnings.length > 0) {
        toast.warning(
          result.warnings.length > 0
            ? result.warnings.slice(0, 3).join('；')
            : `跳过 ${result.skippedCount} 行`,
        )
      }

      invalidateAfterCommit()
      setWizardOpen(false)
      resetWizard()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const previewRows =
    activeKind === 'device_inventory'
      ? inventoryRows
      : activeKind === 'device_changelog'
        ? changelogRows
        : faultRows

  const okCount = previewRows.filter((r) => r.parse_status === 'ok').length
  const warnCount = previewRows.filter((r) => r.parse_status === 'warning').length

  if (supplierLoading || contextLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          加载导入上下文...
        </CardContent>
      </Card>
    )
  }

  if (supplierError || !supplier) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          未找到供应商或加载失败
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-foreground">运维数据导入</h2>
        <p className="text-sm text-muted-foreground mt-1">
          三类 Excel/CSV 批量导入，写入 PostgreSQL；依据 supplier-device-import-schema.md
        </p>
      </div>

      {dataCenters.length === 0 && (
        <Alert>
          <AlertDescription>
            该供应商尚未配置机房，设备主数据/变更导入需先添加机房并配置合同与接入条件单。
          </AlertDescription>
        </Alert>
      )}

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
              code: b.code,
              status: IMPORT_STATUS_LABELS[b.importStatus as keyof typeof IMPORT_STATUS_LABELS] ?? b.importStatus,
              count: `${b.committedCount} / ${b.parsedSuccessCount}`,
              time: formatDt(b.committedAt ?? b.parsedAt),
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
              code: b.code,
              status: IMPORT_STATUS_LABELS[b.importStatus as keyof typeof IMPORT_STATUS_LABELS] ?? b.importStatus,
              count: String(b.committedCount),
              time: formatDt(b.committedAt ?? b.parsedAt),
            }))}
          />
        </TabsContent>
        <TabsContent value="fault" className="mt-4">
          <ImportBatchTable
            emptyHint="暂无故障记录导入批次"
            rows={recentFaultBatches.map((b) => ({
              id: b.id,
              code: b.code,
              status:
                FAULT_IMPORT_STATUS_LABELS[b.importStatus as keyof typeof FAULT_IMPORT_STATUS_LABELS] ??
                b.importStatus,
              count: String(b.committedCount),
              time: formatDt(b.committedAt ?? b.createdAt),
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
                  {dcLoading ? (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      加载机房...
                    </p>
                  ) : (
                    <Select value={dataCenterId} onValueChange={setDataCenterId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择机房" />
                      </SelectTrigger>
                      <SelectContent>
                        {dataCenters.map((dc) => (
                          <SelectItem key={dc.id} value={dc.id}>{dc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {activeKind === 'fault_records' && dataCenters.length > 0 && (
                <div className="space-y-2">
                  <Label>默认机房编码（可选）</Label>
                  <Select value={dataCenterId} onValueChange={setDataCenterId}>
                    <SelectTrigger>
                      <SelectValue placeholder={dataCenters[0]?.code ?? '选择机房'} />
                    </SelectTrigger>
                    <SelectContent>
                      {dataCenters.map((dc) => (
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
                  onClick={() => void commitImport()}
                >
                  {committing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  确认入库
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
