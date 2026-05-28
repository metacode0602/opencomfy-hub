'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Loader2, Plus, Trash2, Upload } from 'lucide-react'
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
import {
  ACCESS_METHOD_OPTIONS,
  ONBOARDING_GPU_CARD_OPTIONS,
  ONLINE_REASON_OPTIONS,
  OPS_KIND_UI,
} from '@/lib/supplier-ops/ui-meta'
import type { SupplierOpsBatchKind } from '@/lib/types/supplier-ops-batch'
import {
  DEVICE_COOPERATION_TYPE_LABELS,
  type DeviceCooperationType,
  type OnboardingBatchPlanLine,
  type OnboardingParsedRow,
} from '@/lib/types/supplier-domain'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'
import { batchKindFromRoute } from '@/lib/supplier/onboarding-batch-utils'

type WizardStep = 'meta' | 'upload' | 'preview'

type PlanLineDraft = {
  key: string
  gpuCardTypeCode: string
  cooperationType: DeviceCooperationType | ''
  quantity: string
}

function emptyPlanLine(): PlanLineDraft {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    gpuCardTypeCode: '',
    cooperationType: '',
    quantity: '',
  }
}

function planLineKey(gpuCardTypeCode: string, cooperationType: DeviceCooperationType) {
  return `${gpuCardTypeCode}::${cooperationType}`
}

function validatePlanLines(lines: PlanLineDraft[]): {
  ok: boolean
  error?: string
  total: number
  normalized: Array<{
    gpuCardTypeId?: string
    gpuCardTypeCode: string
    cooperationType: DeviceCooperationType
    plannedQuantity: number
  }>
} {
  if (lines.length === 0) {
    return { ok: false, error: '请至少添加一行上架计划', total: 0, normalized: [] }
  }

  const seen = new Set<string>()
  const normalized: Array<{
    gpuCardTypeId?: string
    gpuCardTypeCode: string
    cooperationType: DeviceCooperationType
    plannedQuantity: number
  }> = []
  let total = 0

  for (const line of lines) {
    if (!line.gpuCardTypeCode) {
      return { ok: false, error: '请为每一行选择卡型', total: 0, normalized: [] }
    }
    if (!line.cooperationType) {
      return { ok: false, error: '请为每一行选择合作类型', total: 0, normalized: [] }
    }
    const qty = line.quantity.trim() ? Number(line.quantity) : NaN
    if (!Number.isInteger(qty) || qty <= 0) {
      return { ok: false, error: '请为每一行填写有效的上架数量（正整数）', total: 0, normalized: [] }
    }
    const key = planLineKey(line.gpuCardTypeCode, line.cooperationType)
    if (seen.has(key)) {
      return { ok: false, error: '卡型与合作类型组合在本批次内不可重复', total: 0, normalized: [] }
    }
    seen.add(key)
    total += qty
    normalized.push({
      gpuCardTypeCode: line.gpuCardTypeCode,
      gpuCardTypeId: line.gpuCardTypeCode,
      cooperationType: line.cooperationType,
      plannedQuantity: qty,
    })
  }

  return { ok: true, total, normalized }
}


export function OnboardingBatchWizardDialog({
  routeKind,
  open,
  onOpenChange,
  defaultSupplierId,
  defaultDataCenterId,
  supplierName,
  dataCenterName,
  lockContext = false,
  onSuccess,
}: {
  routeKind: Extract<SupplierOpsBatchKind, 'online-tasks' | 'order-access'>
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultSupplierId?: string
  defaultDataCenterId?: string
  supplierName?: string
  dataCenterName?: string
  lockContext?: boolean
  onSuccess?: () => void
}) {
  const utils = trpc.useUtils()
  const ui = OPS_KIND_UI[routeKind]
  const batchKind = batchKindFromRoute(routeKind) as 'online' | 'order_access'
  const isOnlineTasks = routeKind === 'online-tasks'
  const isOrderAccess = routeKind === 'order-access'

  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, { enabled: open })
  const { data: activeCardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery(undefined, {
    enabled: open,
  })

  const createMutation = trpc.supplier.onboardingBatch.create.useMutation()
  const parseListMutation = trpc.supplier.onboardingBatch.parseList.useMutation()
  const commitListMutation = trpc.supplier.onboardingBatch.commitList.useMutation()

  const [wizardStep, setWizardStep] = useState<WizardStep>('meta')
  const fileRef = useRef<HTMLInputElement>(null)

  const [supplierId, setSupplierId] = useState('')
  const [dataCenterId, setDataCenterId] = useState('')
  const [contractId, setContractId] = useState('')
  const [accessMethod, setAccessMethod] = useState('ssh_jump')
  const [plannedReady, setPlannedReady] = useState('')
  const [onlineReason, setOnlineReason] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [workOrderNo, setWorkOrderNo] = useState('')
  const [remark, setRemark] = useState('')
  const [planLines, setPlanLines] = useState<PlanLineDraft[]>([emptyPlanLine()])
  const [uploadList, setUploadList] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState<OnboardingParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  const { data: dataCenters = [] } = trpc.supplier.listDataCenters.useQuery(
    { supplierId },
    { enabled: open && Boolean(supplierId) },
  )
  const { data: contracts = [] } = trpc.supplier.listContracts.useQuery(
    { supplierId },
    { enabled: open && Boolean(supplierId) },
  )

  const activeContracts = useMemo(
    () => contracts.filter((c) => c.status === 'active'),
    [contracts],
  )

  const cardTypeOptions = useMemo(() => {
    if (activeCardTypes.length > 0) {
      return activeCardTypes
        .map((c) => ({
          code: c.code ?? c.id,
          label: c.name,
          id: c.id,
        }))
        .filter((c) => Boolean(c.code))
    }
    return ONBOARDING_GPU_CARD_OPTIONS.map((c) => ({
      code: c.code,
      label: c.label,
      id: c.code,
    }))
  }, [activeCardTypes])

  const planValidation = useMemo(() => validatePlanLines(planLines), [planLines])
  const totalPlannedQuantity = planValidation.total

  const submitting =
    createMutation.isPending || parseListMutation.isPending || commitListMutation.isPending

  const updatePlanLine = (key: string, patch: Partial<PlanLineDraft>) => {
    setPlanLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  const addPlanLine = () => setPlanLines((prev) => [...prev, emptyPlanLine()])

  const removePlanLine = (key: string) => {
    setPlanLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)))
  }

  useEffect(() => {
    if (!open) return
    if (lockContext && defaultSupplierId) {
      setSupplierId(defaultSupplierId)
      setDataCenterId(defaultDataCenterId ?? '')
    }
  }, [open, lockContext, defaultSupplierId, defaultDataCenterId])

  const resetWizard = () => {
    setWizardStep('meta')
    setSupplierId('')
    setDataCenterId('')
    setContractId('')
    setAccessMethod('ssh_jump')
    setPlannedReady('')
    setOnlineReason('')
    setOrderNo('')
    setWorkOrderNo('')
    setRemark('')
    setPlanLines([emptyPlanLine()])
    setUploadList(false)
    setBatchId(null)
    setFileName('')
    setParsedRows([])
    setParseError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) resetWizard()
  }

  const invalidateList = () => {
    void utils.supplier.onboardingBatch.list.invalidate({ batchKind })
    invalidateGlobalDashboard(utils)
  }

  const buildCreateInput = () => {
    if (!planValidation.ok) return null
    return {
      batchKind,
      supplierId,
      dataCenterId,
      contractId: contractId || undefined,
      accessMethod,
      plannedReadyAt: plannedReady || undefined,
      onlineReason: isOnlineTasks ? onlineReason : undefined,
      orderNo: isOrderAccess ? orderNo.trim() : undefined,
      workOrderNo: workOrderNo.trim(),
      remark: remark.trim() || undefined,
      uploadList,
      planLines: planValidation.normalized.map((line) => {
        const card = cardTypeOptions.find((c) => c.code === line.gpuCardTypeCode)
        return {
          ...line,
          gpuCardTypeId: card?.id,
        }
      }),
    }
  }

  const submitCreate = async () => {
    const input = buildCreateInput()
    if (!input) {
      toast.error(planValidation.error ?? '请完善上架计划')
      return null
    }
    try {
      const result = await createMutation.mutateAsync(input)
      setBatchId(result.batchId)
      invalidateList()
      return result
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建批次失败')
      return null
    }
  }

  const confirmWithoutUpload = async () => {
    const result = await submitCreate()
    if (!result) return
    toast.success(
      `已创建批次 ${result.batchCode}，计划上架 ${result.plannedDeviceCount} 台（工单 ${result.workOrderNo}）`,
    )
    onSuccess?.()
    handleOpenChange(false)
  }

  const onMetaNext = async () => {
    if (!workOrderNo.trim()) {
      toast.error('请填写飞书审批工单号')
      return
    }
    if (uploadList) {
      const result = await submitCreate()
      if (!result) return
      setWizardStep('upload')
      return
    }
    await confirmWithoutUpload()
  }

  const onParseFile = async (file: File) => {
    if (!batchId) {
      toast.error('请先完成批次创建')
      return
    }
    setParseError(null)
    try {
      const text = await file.text()
      const result = await parseListMutation.mutateAsync({
        batchId,
        fileName: file.name,
        csvText: text,
      })
      setParsedRows(result.rows)
      setFileName(file.name)
      setWizardStep('preview')
      toast.success(`解析成功，共 ${result.rowCount} 行`)
    } catch (e) {
      const message = e instanceof Error ? e.message : '解析失败'
      setParseError(message)
      toast.error(message)
    }
  }

  const onCommitList = async () => {
    if (!batchId) return
    try {
      const result = await commitListMutation.mutateAsync({ batchId })
      invalidateList()
      toast.success(`已入库 ${result.committedCount} 台设备`)
      onSuccess?.()
      handleOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '入库失败')
    }
  }

  const metaFormValid =
    supplierId &&
    dataCenterId &&
    planValidation.ok &&
    (!isOnlineTasks || onlineReason) &&
    (!isOrderAccess || (orderNo.trim() && remark.trim()))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl min-w-[50vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ui.dialogTitle}</DialogTitle>
          <DialogDescription>
            {lockContext && dataCenterName
              ? isOrderAccess
                ? `为机房「${dataCenterName}」填写订单信息与上架计划 → 可选上传清单 → 确认`
                : `为机房「${dataCenterName}」填写上架计划 → 可选上传清单 → 确认`
              : isOrderAccess
                ? '填写订单信息与上架计划 → 可选上传清单 → 确认'
                : '选择供应商与机房，填写上架计划 → 可选上传清单 → 确认'}
          </DialogDescription>
        </DialogHeader>

        {wizardStep === 'meta' && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              {lockContext && defaultSupplierId && defaultDataCenterId ? (
                <>
                  <div className="space-y-2">
                    <Label>供应商</Label>
                    <p className="text-sm text-foreground">{supplierName ?? '—'}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>机房</Label>
                    <p className="text-sm text-foreground">{dataCenterName ?? '—'}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>供应商</Label>
                    <Select
                      value={supplierId}
                      onValueChange={(v) => {
                        setSupplierId(v)
                        setDataCenterId('')
                        setContractId('')
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择供应商" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.shortName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>机房</Label>
                    <Select
                      value={dataCenterId}
                      onValueChange={setDataCenterId}
                      disabled={!supplierId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择机房" />
                      </SelectTrigger>
                      <SelectContent>
                        {dataCenters.map((dc) => (
                          <SelectItem key={dc.id} value={dc.id}>{dc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>商务合同（可选）</Label>
                <Select
                  value={contractId || '__none__'}
                  onValueChange={(v) => setContractId(v === '__none__' ? '' : v)}
                  disabled={!supplierId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="不关联合同" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不关联合同</SelectItem>
                    {activeContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.contractNo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>接入方式</Label>
                <Select value={accessMethod} onValueChange={setAccessMethod}>
                  <SelectTrigger className="w-full">
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
                <Label>飞书审批工单号</Label>
                <Input
                  placeholder="请输入飞书审批工单号（供应商内唯一）"
                  value={workOrderNo}
                  onChange={(e) => setWorkOrderNo(e.target.value)}
                />
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
                      <SelectTrigger className="w-full">
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
                    <Label>备注（可选）</Label>
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>上架计划</Label>
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addPlanLine}>
                  <Plus className="w-3.5 h-3.5" />
                  添加一行
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                每行选择卡型、合作类型与数量；卡型 + 合作类型在本批次内不可重复。
              </p>
              <div className="space-y-2 rounded-md border p-3">
                {planLines.map((line, index) => (
                  <div key={line.key} className="grid grid-cols-[1fr_1fr_100px_36px] gap-2 items-end">
                    <div className="space-y-1">
                      {index === 0 && <span className="text-xs text-muted-foreground">卡型</span>}
                      <Select
                        value={line.gpuCardTypeCode}
                        onValueChange={(v) => updatePlanLine(line.key, { gpuCardTypeCode: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择卡型" />
                        </SelectTrigger>
                        <SelectContent>
                          {cardTypeOptions.map((c) => (
                            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <span className="text-xs text-muted-foreground">合作类型</span>}
                      <Select
                        value={line.cooperationType}
                        onValueChange={(v) =>
                          updatePlanLine(line.key, { cooperationType: v as DeviceCooperationType })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="合作类型" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(DEVICE_COOPERATION_TYPE_LABELS) as DeviceCooperationType[]).map((t) => (
                            <SelectItem key={t} value={t}>
                              {DEVICE_COOPERATION_TYPE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      {index === 0 && <span className="text-xs text-muted-foreground">数量</span>}
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="台数"
                        value={line.quantity}
                        onChange={(e) => updatePlanLine(line.key, { quantity: e.target.value })}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      disabled={planLines.length <= 1}
                      onClick={() => removePlanLine(line.key)}
                      aria-label="删除行"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {planValidation.ok ? (
                <p className="text-xs text-muted-foreground">
                  合计计划上架 <span className="font-medium text-foreground">{totalPlannedQuantity}</span> 台
                </p>
              ) : planLines.some((l) => l.gpuCardTypeCode || l.cooperationType || l.quantity) ? (
                <p className="text-xs text-destructive">{planValidation.error}</p>
              ) : null}
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
              <Button onClick={() => void onMetaNext()} disabled={!metaFormValid || submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
            <p className="text-sm text-muted-foreground">
              计划总台数 {totalPlannedQuantity} 台；清单行数不得超过该值。
            </p>
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
            {parseListMutation.isPending && (
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
              文件 {fileName}，共 {parsedRows.length} 行校验通过（计划 {totalPlannedQuantity} 台）
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
              <Button disabled={submitting || !batchId} onClick={() => void onCommitList()}>
                {commitListMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                确认入库
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
