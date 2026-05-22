'use client'

import { useMemo, useRef, useState } from 'react'
import { ChevronRight, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Checkbox } from '@workspace/ui/components/checkbox'
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
import { ACCESS_METHOD_OPTIONS, ONLINE_REASON_OPTIONS, OPS_KIND_UI } from '@/lib/supplier-ops/ui-meta'
import { parseInventoryCsv } from '@/lib/supplier-ops/parse-inventory-csv'
import type { SupplierOpsBatchKind } from '@/lib/types/supplier-ops-batch'
import type { OnboardingBatch, OnboardingParsedRow, SupplierActivity } from '@/lib/types/supplier-domain'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import {
  batchKindFromRoute,
  buildDevicesFromBatch,
  generateBatchCode,
  inventoryRowsToParsed,
  maskPassword,
} from '@/lib/supplier/onboarding-batch-utils'

type WizardStep = 'meta' | 'upload' | 'preview'

export function OnboardingBatchWizardDialog({
  routeKind,
  open,
  onOpenChange,
}: {
  routeKind: Extract<SupplierOpsBatchKind, 'online-tasks' | 'order-access'>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const ui = OPS_KIND_UI[routeKind]
  const batchKind = batchKindFromRoute(routeKind)
  const isOnlineTasks = routeKind === 'online-tasks'
  const isOrderAccess = routeKind === 'order-access'

  const suppliers = useSupplierDomainMockStore((s) => s.suppliers)
  const dataCenters = useSupplierDomainMockStore((s) => s.dataCenters)
  const contracts = useSupplierDomainMockStore((s) => s.contracts)
  const accessSheets = useSupplierDomainMockStore((s) => s.accessSheets)
  const upsertOnboardingBatch = useSupplierDomainMockStore((s) => s.upsertOnboardingBatch)
  const upsertDevice = useSupplierDomainMockStore((s) => s.upsertDevice)
  const upsertOnboardingTask = useSupplierDomainMockStore((s) => s.upsertOnboardingTask)
  const upsertSupplierActivity = useSupplierDomainMockStore((s) => s.upsertSupplierActivity)
  const upsertEntityStateTransitionLog = useSupplierDomainMockStore((s) => s.upsertEntityStateTransitionLog)
  const createId = useSupplierDomainMockStore((s) => s.createId)

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
  const [plannedQuantity, setPlannedQuantity] = useState('')
  const [uploadList, setUploadList] = useState(false)
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

  const plannedQuantityNum = plannedQuantity.trim() ? Number(plannedQuantity) : NaN
  const hasValidQuantity = Number.isInteger(plannedQuantityNum) && plannedQuantityNum > 0

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
    setPlannedQuantity('')
    setUploadList(false)
    setFileName('')
    setParsedRows([])
    setParseError(null)
    setDraftBatchId(null)
    setParsing(false)
    setCommitting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) resetWizard()
  }

  const createDraftBatch = (): OnboardingBatch | null => {
    const supplier = suppliers.find((s) => s.id === supplierId)
    const dc = dataCenters.find((d) => d.id === dataCenterId)
    const sheet = accessSheets.find((a) => a.contract_id === contractId && a.is_current)
    if (!supplier || !dc || !contractId || !sheet) {
      toast.error('请完整选择供应商、机房与生效合同')
      return null
    }
    if (!hasValidQuantity) {
      toast.error('请填写有效的上架数量（正整数）')
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

  const confirmWithoutUpload = () => {
    const batch = createDraftBatch()
    if (!batch) return
    toast.success(`已创建批次 ${batch.batch_code}，计划上架 ${plannedQuantityNum} 台`)
    handleOpenChange(false)
  }

  const onMetaNext = () => {
    if (uploadList) {
      if (!createDraftBatch()) return
      setWizardStep('upload')
      return
    }
    confirmWithoutUpload()
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
    handleOpenChange(false)
  }

  const metaFormValid =
    supplierId &&
    dataCenterId &&
    contractId &&
    hasValidQuantity &&
    (!isOnlineTasks || onlineReason) &&
    (!isOrderAccess || (orderNo.trim() && remark.trim()))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              <div className="space-y-2">
                <Label>上架数量</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  placeholder="请输入计划上架台数"
                  value={plannedQuantity}
                  onChange={(e) => setPlannedQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
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
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={uploadList}
                onCheckedChange={(checked) => setUploadList(checked === true)}
              />
              <span className="text-sm">上传清单</span>
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>取消</Button>
              <Button onClick={onMetaNext} disabled={!metaFormValid}>
                {uploadList ? (
                  <>
                    下一步：上传清单
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  '确认'
                )}
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
  )
}
