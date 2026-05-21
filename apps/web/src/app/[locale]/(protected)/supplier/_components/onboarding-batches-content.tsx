'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
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
import { Textarea } from '@workspace/ui/components/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { ACCESS_METHOD_OPTIONS, ONLINE_REASON_OPTIONS, OPS_KIND_UI, onlineReasonLabel } from '@/lib/supplier-ops/ui-meta'
import { parseInventoryCsv } from '@/lib/supplier-ops/parse-inventory-csv'
import type { SupplierOpsBatchKind } from '@/lib/types/supplier-ops-batch'
import type { OnboardingBatch, OnboardingParsedRow, SupplierActivity } from '@/lib/types/supplier-domain'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import {
  batchKindFromRoute,
  buildDevicesFromBatch,
  generateBatchCode,
  IMPORT_STATUS_LABELS,
  inventoryRowsToParsed,
  maskPassword,
  onboardingBatchDetailPath,
} from '@/lib/supplier/onboarding-batch-utils'

type WizardStep = 'meta' | 'upload' | 'preview' | 'done'

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

const importStatusColor: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  parsed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  committed: 'bg-green-500/20 text-green-400 border-green-500/30',
  parse_failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export function OnboardingBatchesContent({
  routeKind,
}: {
  routeKind: Extract<SupplierOpsBatchKind, 'online-tasks' | 'order-access'>
}) {
  const ui = OPS_KIND_UI[routeKind]
  const batchKind = batchKindFromRoute(routeKind)
  const isOnlineTasks = routeKind === 'online-tasks'
  const isOrderAccess = routeKind === 'order-access'

  const suppliers = useSupplierDomainMockStore((s) => s.suppliers)
  const dataCenters = useSupplierDomainMockStore((s) => s.dataCenters)
  const contracts = useSupplierDomainMockStore((s) => s.contracts)
  const accessSheets = useSupplierDomainMockStore((s) => s.accessSheets)
  const onboardingBatches = useSupplierDomainMockStore((s) => s.onboardingBatches)
  const batches = useMemo(
    () => onboardingBatches.filter((b) => b.batch_kind === batchKind),
    [onboardingBatches, batchKind],
  )
  const upsertOnboardingBatch = useSupplierDomainMockStore((s) => s.upsertOnboardingBatch)
  const upsertDevice = useSupplierDomainMockStore((s) => s.upsertDevice)
  const upsertOnboardingTask = useSupplierDomainMockStore((s) => s.upsertOnboardingTask)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const upsertEntityStateTransitionLog = useSupplierDomainMockStore((s) => s.upsertEntityStateTransitionLog)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [importFilter, setImportFilter] = useState('all')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('meta')
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [supplierId, setSupplierId] = useState('')
  const [dataCenterId, setDataCenterId] = useState('')
  const [contractId, setContractId] = useState('')
  const [accessMethod, setAccessMethod] = useState('ssh_jump')
  const [plannedReady, setPlannedReady] = useState('')
  const [onlineReason, setOnlineReason] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [remark, setRemark] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState<OnboardingParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [draftBatchId, setDraftBatchId] = useState<string | null>(null)

  const supplierDcs = useMemo(
    () => dataCenters.filter((dc) => dc.supplier_id === supplierId),
    [dataCenters, supplierId],
  )
  const supplierContracts = useMemo(
    () => contracts.filter((c) => c.supplier_id === supplierId && c.status === '生效'),
    [contracts, supplierId],
  )

  const filtered = useMemo(() => {
    return batches.filter((b) => {
      const q = search.trim().toLowerCase()
      const matchQ =
        !q ||
        b.batch_code.toLowerCase().includes(q) ||
        b.supplier_name.toLowerCase().includes(q) ||
        b.idc_code.toLowerCase().includes(q) ||
        (b.order_no?.toLowerCase().includes(q) ?? false)
      const matchStatus = statusFilter === 'all' || b.batch_status === statusFilter
      const matchImport = importFilter === 'all' || b.import_status === importFilter
      return matchQ && matchStatus && matchImport
    })
  }, [batches, search, statusFilter, importFilter])

  const stats = useMemo(() => {
    return {
      total: batches.length,
      onboarding: batches.filter((b) => b.batch_status === '接入中').length,
      committed: batches.filter((b) => b.import_status === 'committed').length,
      pendingParse: batches.filter((b) => b.import_status === 'parsed').length,
    }
  }, [batches])

  const resetWizard = () => {
    setWizardStep('meta')
    setSupplierId('')
    setDataCenterId('')
    setContractId('')
    setAccessMethod('ssh_jump')
    setPlannedReady('')
    setOnlineReason('')
    setOrderNo('')
    setRemark('')
    setFileName('')
    setParsedRows([])
    setParseError(null)
    setDraftBatchId(null)
    setParsing(false)
    setCommitting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const openWizard = () => {
    resetWizard()
    setWizardOpen(true)
  }

  const createDraftBatch = (): OnboardingBatch | null => {
    const supplier = suppliers.find((s) => s.id === supplierId)
    const dc = dataCenters.find((d) => d.id === dataCenterId)
    const sheet = accessSheets.find((a) => a.contract_id === contractId && a.is_current)
    if (!supplier || !dc || !contractId || !sheet) {
      toast.error('请完整选择供应商、机房与生效合同')
      return null
    }
    if (isOnlineTasks && !onlineReason) {
      toast.error('请选择上架原因')
      return null
    }
    if (isOrderAccess && !orderNo.trim()) {
      toast.error('请填写订单编号')
      return null
    }
    if (isOrderAccess && !remark.trim()) {
      toast.error('请填写备注')
      return null
    }
    const now = new Date().toISOString()
    const batch: OnboardingBatch = {
      id: draftBatchId ?? createId('batch'),
      batch_kind: batchKind,
      supplier_id: supplier.id,
      supplier_code: supplier.code,
      supplier_name: supplier.name,
      supplier_short_name: supplier.short_name,
      data_center_id: dc.id,
      idc_code: dc.code,
      data_center_name: dc.name,
      idc_region: dc.location,
      contract_id: contractId,
      access_condition_sheet_id: sheet.id,
      batch_code: generateBatchCode(batchKind),
      batch_status: '待开始',
      planned_ready_at: plannedReady ? new Date(plannedReady).toISOString() : null,
      online_reason: isOnlineTasks ? onlineReason : null,
      order_no: isOrderAccess ? orderNo.trim() : null,
      remark: remark.trim() || null,
      access_method: accessMethod,
      import_file_name: fileName || '未上传',
      import_status: 'draft',
      parsed_row_count: 0,
      parsed_success_count: 0,
      parsed_rows_json: null,
      parsed_at: null,
      committed_device_count: 0,
      committed_at: null,
      created_at: now,
      updated_at: now,
    }
    upsertOnboardingBatch(batch)
    setDraftBatchId(batch.id)
    return batch
  }

  const onParseFile = async (file: File) => {
    setParseError(null)
    setParsing(true)
    const text = await file.text()
    const result = parseInventoryCsv(text)
    setParsing(false)
    if (!result.ok) {
      setParseError(result.error)
      setParsedRows([])
      return
    }
    const rows = inventoryRowsToParsed(result.rows)
    setParsedRows(rows)
    setFileName(file.name)
    setWizardStep('preview')

    const batch = createDraftBatch()
    if (!batch) return
    const updated: OnboardingBatch = {
      ...batch,
      import_file_name: file.name,
      import_status: 'parsed',
      parsed_row_count: rows.length,
      parsed_success_count: rows.filter((r) => r.parse_status === 'ok').length,
      parsed_rows_json: rows.map((r) => ({ ...r, root_password: maskPassword(r.root_password) })),
      parsed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    upsertOnboardingBatch(updated)
    toast.success(`解析成功，共 ${rows.length} 行`)
  }

  const commitBatch = (batch: OnboardingBatch) => {
    if (batch.batch_kind !== 'online' && batch.batch_kind !== 'order_access') {
      toast.error('该批次类型请使用「运维导入」确认入库')
      return
    }
    if (!batch.parsed_rows_json?.length) {
      toast.error('无解析数据，无法入库')
      return
    }
    setCommitting(true)
    const rows = batch.parsed_rows_json as OnboardingParsedRow[]
    const newDevices = buildDevicesFromBatch({
      batchId: batch.id,
      supplierId: batch.supplier_id,
      contractId: batch.contract_id,
      dataCenterId: batch.data_center_id,
      idcCode: batch.idc_code,
      idcRegion: batch.idc_region,
      cardTypeDefault: 'A100-80G',
      rows,
      createId,
    })
    for (const d of newDevices) {
      upsertDevice(d)
      upsertEntityStateTransitionLog({
        id: createId('esl'),
        entity_type: 'device',
        entity_id: d.id,
        from_state: '待接入',
        to_state: '接入中',
        operator_id: 'staff-mock-01',
        reason_code: 'BATCH_COMMITTED',
        occurred_at: new Date().toISOString(),
      })
    }
    upsertOnboardingTask({
      id: createId('task'),
      onboarding_batch_id: batch.id,
      device_id: null,
      task_type: '批次联调',
      assignee_id: 'staff-mock-02',
      task_status: '待开始',
      started_at: null,
      finished_at: null,
    })
    const now = new Date().toISOString()
    upsertOnboardingBatch({
      ...batch,
      import_status: 'committed',
      batch_status: '接入中',
      committed_device_count: newDevices.length,
      committed_at: now,
      updated_at: now,
    })
    const activity: SupplierActivity = {
      id: createId('act'),
      supplier_id: batch.supplier_id,
      type: 'ops_import',
      title: `${ui.title}批次 ${batch.batch_code} 已入库`,
      description: `共入库 ${newDevices.length} 台物理机`,
      author_name: '运营（mock）',
      author_role: 'ops',
      ref_domain: 'batch',
      ref_id: batch.id,
      occurred_at: now,
    }
    upsertSupplierActivity(activity)
    setCommitting(false)
    toast.success(`已入库 ${newDevices.length} 台设备`)
    setWizardOpen(false)
    setWizardStep('done')
    resetWizard()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{ui.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{ui.description}</p>
        </div>
        <Button className="gap-2" onClick={openWizard}>
          <Plus className="w-4 h-4" />
          {ui.dialogTitle}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">批次总数</p>
            <p className="text-2xl font-semibold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">接入中</p>
            <p className="text-2xl font-semibold mt-1">{stats.onboarding}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已入库</p>
            <p className="text-2xl font-semibold mt-1">{stats.committed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">待确认入库</p>
            <p className="text-2xl font-semibold mt-1">{stats.pendingParse}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索批次号、供应商、机房..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="批次状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="待开始">待开始</SelectItem>
              <SelectItem value="接入中">接入中</SelectItem>
              <SelectItem value="已完成">已完成</SelectItem>
            </SelectContent>
          </Select>
          <Select value={importFilter} onValueChange={setImportFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="导入状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部导入</SelectItem>
              <SelectItem value="parsed">待确认入库</SelectItem>
              <SelectItem value="committed">已入库</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>批次号</TableHead>
              <TableHead>供应商 / 机房</TableHead>
              <TableHead>导入状态</TableHead>
              <TableHead>批次状态</TableHead>
              <TableHead>已入库</TableHead>
              {isOnlineTasks && <TableHead>上架原因</TableHead>}
              {isOrderAccess && <TableHead>订单编号</TableHead>}
              <TableHead>计划就绪</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isOnlineTasks || isOrderAccess ? 8 : 7} className="text-center text-muted-foreground py-12">
                  暂无批次，点击右上角新建
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={onboardingBatchDetailPath(b)}
                      className="text-primary hover:underline"
                    >
                      {b.batch_code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{b.supplier_short_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.idc_code} · {b.data_center_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={importStatusColor[b.import_status] ?? ''}>
                      {IMPORT_STATUS_LABELS[b.import_status] ?? b.import_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{b.batch_status}</TableCell>
                  <TableCell>
                    {b.committed_device_count}
                    {b.parsed_success_count > 0 ? ` / ${b.parsed_success_count}` : ''}
                  </TableCell>
                  {isOnlineTasks && (
                    <TableCell className="text-sm">
                      {onlineReasonLabel(b.online_reason)}
                    </TableCell>
                  )}
                  {isOrderAccess && (
                    <TableCell className="text-sm font-mono">
                      {b.order_no ?? '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDt(b.planned_ready_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={onboardingBatchDetailPath(b)}>
                            <Eye className="w-4 h-4 mr-2" />
                            查看详情
                          </Link>
                        </DropdownMenuItem>
                        {b.import_status === 'parsed' && (
                          <DropdownMenuItem onClick={() => commitBatch(b)}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            确认入库
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={wizardOpen} onOpenChange={(o) => { setWizardOpen(o); if (!o) resetWizard() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ui.dialogTitle}</DialogTitle>
            <DialogDescription>
              {isOrderAccess
                ? '填写订单编号与备注 → 选择供应商与机房 → 上传 CSV 清单 → 预览 → 确认入库（Mock，后续接 tRPC）'
                : '选择供应商与机房 → 上传 CSV 清单 → 预览 → 确认入库（Mock，后续接 tRPC）'}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 'meta' && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>供应商</Label>
                  <Select value={supplierId} onValueChange={(v) => { setSupplierId(v); setDataCenterId(''); setContractId('') }}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择供应商" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.short_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>机房</Label>
                  <Select value={dataCenterId} onValueChange={setDataCenterId} disabled={!supplierId}>
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
                <div className="space-y-2">
                  <Label>商务合同</Label>
                  <Select value={contractId} onValueChange={setContractId} disabled={!supplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="生效中合同" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierContracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.contract_no}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>接入方式</Label>
                  <Select value={accessMethod} onValueChange={setAccessMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_METHOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>计划完成时间（可选）</Label>
                  <Input type="datetime-local" value={plannedReady} onChange={(e) => setPlannedReady(e.target.value)} />
                </div>
                {isOnlineTasks && (
                  <>
                    <div className="space-y-2 col-span-2">
                      <Label>上架原因</Label>
                      <Select value={onlineReason} onValueChange={setOnlineReason}>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择上架原因" />
                        </SelectTrigger>
                        <SelectContent>
                          {ONLINE_REASON_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>备注</Label>
                      <Textarea
                        placeholder="补充说明本次上架背景、优先级或特殊要求"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}
                {isOrderAccess && (
                  <>
                    <div className="space-y-2 col-span-2">
                      <Label>订单编号</Label>
                      <Input
                        placeholder="请输入关联订单编号"
                        value={orderNo}
                        onChange={(e) => setOrderNo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>备注</Label>
                      <Textarea
                        placeholder="补充说明本次订单接入背景、优先级或特殊要求"
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWizardOpen(false)}>取消</Button>
                <Button
                  onClick={() => {
                    if (!createDraftBatch()) return
                    setWizardStep('upload')
                  }}
                  disabled={
                    !supplierId ||
                    !dataCenterId ||
                    !contractId ||
                    (isOnlineTasks && !onlineReason) ||
                    (isOrderAccess && (!orderNo.trim() || !remark.trim()))
                  }
                >
                  下一步：上传清单
                  <ChevronRight className="w-4 h-4 ml-1" />
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
                <p className="text-xs text-muted-foreground mt-1">
                  需包含：公网 IP、内网 IP、root 账号、密码
                </p>
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
              <p className="text-sm text-muted-foreground">
                文件 {fileName}，共 {parsedRows.length} 行校验通过
              </p>
              <div className="max-h-48 overflow-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>行</TableHead>
                      <TableHead>公网 IP</TableHead>
                      <TableHead>内网 IP</TableHead>
                      <TableHead>账号</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 8).map((r) => (
                      <TableRow key={r.row_no}>
                        <TableCell>{r.row_no}</TableCell>
                        <TableCell>{r.public_ip}</TableCell>
                        <TableCell>{r.private_ip}</TableCell>
                        <TableCell>{r.root_account}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWizardStep('upload')}>重新上传</Button>
                <Button
                  disabled={committing || !draftBatchId}
                  onClick={() => {
                    const b = useSupplierDomainMockStore
                      .getState()
                      .onboardingBatches.find((x) => x.id === draftBatchId)
                    if (b) commitBatch(b)
                  }}
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
