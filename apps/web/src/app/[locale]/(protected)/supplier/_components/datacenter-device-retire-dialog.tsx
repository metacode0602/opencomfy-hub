'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronRight, Download, Info, Loader2, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
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
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Alert, AlertDescription, AlertTitle } from '@workspace/ui/components/alert'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { trpc } from '@/lib/trpc/client'
import {
  DEVICE_COOPERATION_TYPE_LABELS,
  type DeviceCooperationType,
} from '@/lib/types/supplier-domain'
import {
  DEVICE_RETIRE_REASON_OPTIONS,
  type DeviceRetireReason,
} from '@/lib/types/device-retire'
import type {
  DatacenterRetireCommitResult,
  DatacenterRetireContext,
  DatacenterRetirePlanLineDraft,
  DatacenterRetirePreviewResult,
  RetireActionType,
} from '@/lib/types/datacenter-device-retire'
import {
  DATACENTER_RETIRE_LIST_HEADERS,
  RETIRE_ACTION_TYPE_OPTIONS,
} from '@/lib/types/datacenter-device-retire'
import {
  getListedQuantity,
  validateRetirePlanLineDrafts,
} from '@/lib/supplier/datacenter-retire-plan-validation'
import { downloadDatacenterRetireListSampleCsv } from '@/lib/data/datacenter-device-retire-list-sample'
import {
  getChangelogActionHint,
  getRetireScenarioLabel,
  resolveRetirePlanMode,
  sumDatacenterRetireAvailability,
} from '@/lib/supplier/datacenter-device-retire-ui'

type WizardStep = 'meta' | 'upload' | 'preview' | 'done'

function emptyPlanLine(): DatacenterRetirePlanLineDraft {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    gpuCardTypeId: '',
    cooperationType: '',
    quantity: '',
  }
}

function formatPlanSummary(preview: DatacenterRetirePreviewResult) {
  if (preview.retirePlanMode === 'datacenter_closure') {
    return `机房裁撤 · 本机房可下架 ${preview.totalPlannedQuantity} 台（快照）`
  }
  return preview.planLines
    .map(
      (l) =>
        `${l.gpuCardTypeName} · ${DEVICE_COOPERATION_TYPE_LABELS[l.cooperationType]} × ${l.plannedQuantity}`,
    )
    .join('；')
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('读取文件失败'))
        return
      }
      const base64 = result.includes(',') ? (result.split(',')[1] ?? result) : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return '操作失败，请稍后重试'
}

function ScenarioBadge({ label }: { label: string }) {
  return (
    <Badge variant="outline" className="font-normal">
      {label}
    </Badge>
  )
}

export function DatacenterDeviceRetireDialog({
  open,
  onOpenChange,
  dataCenterId,
  dataCenterName,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataCenterId: string
  dataCenterName: string
  onSuccess?: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadFileRef = useRef<File | null>(null)

  const [wizardStep, setWizardStep] = useState<WizardStep>('meta')
  const [retireReason, setRetireReason] = useState<DeviceRetireReason | ''>('')
  const [retireActionType, setRetireActionType] = useState<RetireActionType | ''>('')
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('')
  const [workOrderNo, setWorkOrderNo] = useState('')
  const [remark, setRemark] = useState('')
  const [planLines, setPlanLines] = useState<DatacenterRetirePlanLineDraft[]>([emptyPlanLine()])
  const [uploadList, setUploadList] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [preview, setPreview] = useState<DatacenterRetirePreviewResult | null>(null)
  const [commitResult, setCommitResult] = useState<DatacenterRetireCommitResult | null>(null)
  const [busy, setBusy] = useState(false)

  const {
    data: context,
    isLoading: contextLoading,
    isError: contextError,
    error: contextLoadError,
    refetch: refetchContext,
  } = trpc.supplier.deviceRetire.getDatacenterContext.useQuery(
    { dataCenterId },
    { enabled: open, retry: 1 },
  )

  const previewMutation = trpc.supplier.deviceRetire.previewDatacenter.useMutation()
  const commitMutation = trpc.supplier.deviceRetire.commitDatacenter.useMutation()

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const effectiveContext: DatacenterRetireContext | null = context ?? null
  const isDatacenterClosure = retireReason === 'dc_closure'

  const planValidation = useMemo(
    () =>
      effectiveContext && !isDatacenterClosure
        ? validateRetirePlanLineDrafts(planLines, effectiveContext)
        : { ok: true as const, total: 0, normalized: [], error: undefined },
    [planLines, effectiveContext, isDatacenterClosure],
  )

  const snapshotTotal = useMemo(
    () => sumDatacenterRetireAvailability(effectiveContext?.availability ?? []),
    [effectiveContext],
  )

  const hasInventory = (effectiveContext?.cardTypes.length ?? 0) > 0
  const scenarioPreviewLabel =
    retireReason && retireActionType
      ? getRetireScenarioLabel(
          resolveRetirePlanMode(retireReason),
          isDatacenterClosure ? 'device_unsubscribe' : retireActionType,
        )
      : null

  const reset = useCallback(() => {
    setWizardStep('meta')
    setRetireReason('')
    setRetireActionType('')
    setExpectedCompletionDate('')
    setWorkOrderNo('')
    setRemark('')
    setPlanLines([emptyPlanLine()])
    setUploadList(false)
    setFileName('')
    setParseError(null)
    setPreview(null)
    setCommitResult(null)
    uploadFileRef.current = null
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  const prevOpenRef = useRef(open)
  useEffect(() => {
    if (prevOpenRef.current && !open) reset()
    prevOpenRef.current = open
  }, [open, reset])

  useEffect(() => {
    if (isDatacenterClosure) {
      setUploadList(false)
      setRetireActionType('device_unsubscribe')
    }
  }, [isDatacenterClosure])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const updatePlanLine = (key: string, patch: Partial<DatacenterRetirePlanLineDraft>) => {
    setPlanLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const addPlanLine = () => setPlanLines((prev) => [...prev, emptyPlanLine()])
  const removePlanLine = (key: string) =>
    setPlanLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)))

  const metaFormValid =
    Boolean(retireReason) &&
    Boolean(workOrderNo.trim()) &&
    Boolean(expectedCompletionDate) &&
    expectedCompletionDate >= todayStr &&
    (isDatacenterClosure
      ? snapshotTotal > 0
      : Boolean(retireActionType) && planValidation.ok && hasInventory)

  const buildCommitInput = async () => {
    if (!retireReason) throw new Error('请选择下架原因')
    const actionType = (isDatacenterClosure ? 'device_unsubscribe' : retireActionType) as RetireActionType

    let listFile: { fileName: string; fileBase64: string } | undefined
    if (!isDatacenterClosure && uploadList && uploadFileRef.current) {
      listFile = {
        fileName: uploadFileRef.current.name,
        fileBase64: await readFileAsBase64(uploadFileRef.current),
      }
    }

    return {
      dataCenterId,
      meta: {
        reason: retireReason,
        retireActionType: actionType,
        expectedCompletionDate,
        workOrderNo: workOrderNo.trim(),
        remark: remark.trim() || undefined,
      },
      planLines: isDatacenterClosure
        ? []
        : planValidation.normalized.map((l) => ({
            gpuCardTypeId: l.gpuCardTypeId,
            gpuCardTypeCode: l.gpuCardTypeCode,
            cooperationType: l.cooperationType,
            plannedQuantity: l.plannedQuantity,
          })),
      uploadList: !isDatacenterClosure && uploadList,
      listFile,
    }
  }

  const runPreview = async (file?: File | null) => {
    if (!effectiveContext) return null
    setParseError(null)
    setBusy(true)
    try {
      if (file) uploadFileRef.current = file

      const input = await buildCommitInput()
      if (file && input.listFile) {
        input.listFile = {
          fileName: file.name,
          fileBase64: await readFileAsBase64(file),
        }
      }

      const result = await previewMutation.mutateAsync(input)
      if (!result.valid) {
        const msg = result.errors[0] ?? '校验未通过'
        setParseError(msg)
        toast.error(msg)
        return null
      }

      setPreview(result)
      return result
    } catch (e) {
      const msg = getErrorMessage(e)
      setParseError(msg)
      toast.error(msg)
      return null
    } finally {
      setBusy(false)
    }
  }

  const onMetaNext = async () => {
    if (!metaFormValid) {
      toast.error(
        isDatacenterClosure
          ? '请完善裁撤信息（本机房需有可下架设备）'
          : (planValidation.error ?? '请完善表单'),
      )
      return
    }
    if (!isDatacenterClosure && uploadList) {
      setWizardStep('upload')
      return
    }
    const result = await runPreview()
    if (result) setWizardStep('preview')
  }

  const onParseFile = async (file: File) => {
    uploadFileRef.current = file
    setFileName(file.name)
    const result = await runPreview(file)
    if (result) {
      toast.success(`清单解析成功，共 ${result.list?.summary.ok ?? 0} 行（仅供运维参考）`)
      setWizardStep('preview')
    }
  }

  const onConfirm = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const input = await buildCommitInput()
      const result = await commitMutation.mutateAsync(input)
      setCommitResult(result)
      setWizardStep('done')
      toast.success(`${result.scenarioLabel}批次 ${result.batchCodes[0]} 已创建`)
      onSuccess?.()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const listErrorRows = preview?.list?.rows.filter((r) => r.parseStatus === 'error') ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {wizardStep === 'meta' && '设备下架 / 机房裁撤'}
            {wizardStep === 'upload' && '上传下架清单（运维指引）'}
            {wizardStep === 'preview' && '确认提交计划'}
            {wizardStep === 'done' && '计划已创建'}
          </DialogTitle>
          <DialogDescription>
            {wizardStep === 'meta' &&
              `商务下发计划 → 运维线下实施 → 变更表更新状态（机房：${dataCenterName}）`}
            {wizardStep === 'upload' &&
              `清单仅供运维参考，不会在提交时变更设备；计划 ${planValidation.total} 台`}
            {wizardStep === 'preview' && preview && formatPlanSummary(preview)}
            {wizardStep === 'done' &&
              commitResult &&
              `${commitResult.scenarioLabel} · 批次 ${commitResult.batchCodes[0]}`}
          </DialogDescription>
        </DialogHeader>

        {wizardStep === 'meta' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>业务流程</AlertTitle>
            <AlertDescription className="text-xs leading-relaxed">
              本弹窗<strong>仅创建下架/裁撤批次</strong>，不会修改设备状态。运维实施后在「设备变更表」中填写
              <strong>相同飞书工单号</strong>及对应变更动作，系统再挂接批次并更新资源总览。
            </AlertDescription>
          </Alert>
        )}

        {contextLoading && wizardStep === 'meta' && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载机房库存与可下架数量…
          </div>
        )}

        {contextError && wizardStep === 'meta' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{getErrorMessage(contextLoadError)}</span>
              <Button variant="outline" size="sm" onClick={() => void refetchContext()}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {wizardStep === 'meta' && effectiveContext && !contextLoading && (
          <div className="space-y-4">
            {!hasInventory && !isDatacenterClosure && (
              <Alert>
                <AlertDescription>
                  本机房暂无聚合库存，请先通过「运维数据导入」入库设备后再发起下架。
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  飞书审批工单号 <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="运维变更表须填写相同工单号"
                  value={workOrderNo}
                  onChange={(e) => setWorkOrderNo(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>
                  下架原因 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={retireReason}
                  onValueChange={(v) => setRetireReason(v as DeviceRetireReason)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择下架原因" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_RETIRE_REASON_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isDatacenterClosure ? (
                <div className="space-y-2 sm:col-span-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ScenarioBadge label="机房裁撤" />
                    <span className="text-sm font-medium">整机房清退</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    无需填写卡型计划与设备清单。提交后本机房可下架设备快照共{' '}
                    <span className="font-medium text-foreground">{snapshotTotal}</span>{' '}
                    台；运维在变更表中对本机房设备填写「设备退订」或「非常规下线」。
                  </p>
                  {snapshotTotal <= 0 && (
                    <p className="text-xs text-destructive">当前无可下架设备，无法发起裁撤计划。</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>
                      下架计划类型 <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={retireActionType}
                      onValueChange={(v) => setRetireActionType(v as RetireActionType)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="请选择计划类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {RETIRE_ACTION_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {retireActionType && (
                      <p className="text-xs text-muted-foreground">
                        {
                          RETIRE_ACTION_TYPE_OPTIONS.find((o) => o.value === retireActionType)
                            ?.description
                        }
                        ；变更动作：{getChangelogActionHint(retireActionType)}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="dc-retire-date">
                  期望完成日期 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dc-retire-date"
                  type="date"
                  min={todayStr}
                  value={expectedCompletionDate}
                  onChange={(e) => setExpectedCompletionDate(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="dc-retire-remark">备注</Label>
                <Textarea
                  id="dc-retire-remark"
                  placeholder="补充说明（选填）"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            {!isDatacenterClosure && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>下架计划</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={!hasInventory}
                      onClick={addPlanLine}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      添加一行
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    卡型 × 合作类型 × 数量；数量不超过当前可下架上限。
                  </p>
                  <div className="space-y-2 rounded-md border p-3">
                    {planLines.map((line, index) => {
                      const maxQty =
                        line.gpuCardTypeId && line.cooperationType
                          ? getListedQuantity(
                              effectiveContext.availability,
                              line.gpuCardTypeId,
                              line.cooperationType,
                            )
                          : null
                      return (
                        <div
                          key={line.key}
                          className="grid grid-cols-[1fr_1fr_100px_36px] items-end gap-2"
                        >
                          <div className="space-y-1">
                            {index === 0 && (
                              <span className="text-xs text-muted-foreground">卡型</span>
                            )}
                            <Select
                              value={line.gpuCardTypeId}
                              onValueChange={(v) =>
                                updatePlanLine(line.key, { gpuCardTypeId: v, quantity: '' })
                              }
                              disabled={!hasInventory}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="选择卡型" />
                              </SelectTrigger>
                              <SelectContent>
                                {effectiveContext.cardTypes.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            {index === 0 && (
                              <span className="text-xs text-muted-foreground">合作类型</span>
                            )}
                            <Select
                              value={line.cooperationType}
                              onValueChange={(v) =>
                                updatePlanLine(line.key, {
                                  cooperationType: v as DeviceCooperationType,
                                  quantity: '',
                                })
                              }
                              disabled={!line.gpuCardTypeId}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="合作类型" />
                              </SelectTrigger>
                              <SelectContent>
                                {(
                                  Object.keys(DEVICE_COOPERATION_TYPE_LABELS) as DeviceCooperationType[]
                                ).map((t) => {
                                  const listed = line.gpuCardTypeId
                                    ? getListedQuantity(
                                        effectiveContext.availability,
                                        line.gpuCardTypeId,
                                        t,
                                      )
                                    : 0
                                  return (
                                    <SelectItem key={t} value={t} disabled={listed <= 0}>
                                      {DEVICE_COOPERATION_TYPE_LABELS[t]}
                                      {line.gpuCardTypeId ? `（可下架 ${listed}）` : ''}
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            {index === 0 && (
                              <span className="text-xs text-muted-foreground">数量</span>
                            )}
                            <Input
                              type="number"
                              min={1}
                              max={maxQty ?? undefined}
                              step={1}
                              placeholder="台数"
                              value={line.quantity}
                              disabled={!line.cooperationType || maxQty === 0}
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
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                  {planValidation.ok ? (
                    <p className="text-xs text-muted-foreground">
                      合计计划{' '}
                      <span className="font-medium text-foreground">{planValidation.total}</span> 台
                      {scenarioPreviewLabel ? (
                        <>
                          {' '}
                          · <ScenarioBadge label={scenarioPreviewLabel} />
                        </>
                      ) : null}
                    </p>
                  ) : planLines.some((l) => l.gpuCardTypeId || l.cooperationType || l.quantity) ? (
                    <p className="text-xs text-destructive">{planValidation.error}</p>
                  ) : null}
                </div>

                <label className="flex cursor-pointer items-start gap-2">
                  <Checkbox
                    className="mt-0.5"
                    checked={uploadList}
                    onCheckedChange={(checked) => setUploadList(checked === true)}
                  />
                  <span className="text-sm leading-snug">
                    上传清单
                    <span className="block text-xs text-muted-foreground">
                      可选；列出建议下架设备，供运维参考，提交时不会变更设备状态
                    </span>
                  </span>
                </label>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                取消
              </Button>
              <Button onClick={() => void onMetaNext()} disabled={!metaFormValid || busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {!isDatacenterClosure && uploadList ? (
                  <>
                    下一步：上传清单
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </>
                ) : (
                  '下一步：确认'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {wizardStep === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription className="text-xs">
                清单仅作为运维指引存档，不会在提交时执行下架。设备状态由后续「设备变更表」更新。
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              表头：{DATACENTER_RETIRE_LIST_HEADERS.join('、')}。外网 IP 支持{' '}
              <code className="rounded bg-muted px-1">203.0.113.1:8080</code>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => downloadDatacenterRetireListSampleCsv()}
            >
              <Download className="h-3.5 w-3.5" />
              下载样例
            </Button>
            <div
              className="cursor-pointer rounded-lg border border-dashed border-border p-8 text-center hover:bg-muted/30"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">点击上传 CSV / TSV</p>
              <p className="mt-1 text-xs text-muted-foreground">
                各卡型×合作类型行数须与计划完全一致
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
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                解析清单…
              </div>
            )}
            {parseError && <p className="text-sm text-destructive">{parseError}</p>}
            {listErrorRows.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">行</TableHead>
                      <TableHead>卡型</TableHead>
                      <TableHead>说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listErrorRows.slice(0, 10).map((r) => (
                      <TableRow key={r.rowNo}>
                        <TableCell>{r.rowNo}</TableCell>
                        <TableCell>{r.gpuCardTypeCode}</TableCell>
                        <TableCell className="text-xs text-destructive">
                          {r.errors.join('；')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setWizardStep('meta')}>
                上一步
              </Button>
            </DialogFooter>
          </div>
        )}

        {wizardStep === 'preview' && preview && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <ScenarioBadge label={preview.scenarioLabel} />
                <span className="text-muted-foreground">·</span>
                <span>{preview.context.dataCenterName}</span>
              </div>
              <p>
                <span className="text-muted-foreground">飞书工单：</span>
                {preview.meta.workOrderNo}
              </p>
              <p>
                <span className="text-muted-foreground">下架原因：</span>
                {preview.meta.reasonLabel}
              </p>
              {preview.retirePlanMode === 'datacenter_closure' ? (
                <p>
                  <span className="text-muted-foreground">裁撤范围：</span>
                  本机房可下架设备快照 {preview.totalPlannedQuantity} 台
                </p>
              ) : (
                <p>
                  <span className="text-muted-foreground">计划数量：</span>
                  {preview.totalPlannedQuantity} 台
                  {preview.list
                    ? `（清单 ${preview.list.summary.ok} 行，仅供运维参考）`
                    : '（无清单，由运维选机）'}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">运维变更动作：</span>
                {preview.changelogActionHint}
              </p>
            </div>

            {preview.retirePlanMode === 'line_plan' && preview.planLines.length > 0 && (
              <ul className="space-y-1 text-sm">
                {preview.planLines.map((l) => (
                  <li key={`${l.gpuCardTypeId}-${l.cooperationType}`}>
                    {l.gpuCardTypeName} · {DEVICE_COOPERATION_TYPE_LABELS[l.cooperationType]} ×{' '}
                    {l.plannedQuantity}
                  </li>
                ))}
              </ul>
            )}

            {preview.list && preview.list.rows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">建议下架设备（清单）</p>
                <div className="max-h-48 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>行</TableHead>
                        <TableHead>卡型</TableHead>
                        <TableHead>外网 IP</TableHead>
                        <TableHead>内网 IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.list.rows.slice(0, 8).map((r) => (
                        <TableRow key={r.rowNo}>
                          <TableCell>{r.rowNo}</TableCell>
                          <TableCell>{r.gpuCardTypeName ?? r.gpuCardTypeCode}</TableCell>
                          <TableCell>{r.externalIp ?? '—'}</TableCell>
                          <TableCell>{r.internalIp ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                确认后将<strong>仅创建批次</strong>，设备状态不变。请通知运维在变更表中使用工单号{' '}
                <strong>{preview.meta.workOrderNo}</strong> 及变更动作「{preview.changelogActionHint}
                」。
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setWizardStep(isDatacenterClosure ? 'meta' : uploadList ? 'upload' : 'meta')}
                disabled={busy}
              >
                返回修改
              </Button>
              <Button onClick={onConfirm} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认创建计划
              </Button>
            </DialogFooter>
          </div>
        )}

        {wizardStep === 'done' && commitResult && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <ScenarioBadge label={commitResult.scenarioLabel} />
                <span className="font-mono font-medium">{commitResult.batchCodes[0]}</span>
              </div>
              <p>
                飞书工单：<span className="font-medium">{commitResult.workOrderNo}</span>
              </p>
              <p>
                {commitResult.retirePlanMode === 'datacenter_closure'
                  ? `机房裁撤计划已创建（快照 ${commitResult.totalPlannedQuantity} 台）`
                  : `下架计划已创建（计划 ${commitResult.totalPlannedQuantity} 台）`}
              </p>
            </div>
            <Alert>
              <AlertTitle className="text-sm">下一步（运维）</AlertTitle>
              <AlertDescription className="space-y-1 text-xs">
                <p>1. 按计划在机房线下实施下架或裁撤。</p>
                <p>
                  2. 在「设备变更表」中填写工单号 <strong>{commitResult.workOrderNo}</strong>，变更动作：
                  <strong> {commitResult.changelogActionHint}</strong>。
                </p>
                <p>3. 导入变更表后，系统将挂接本批次并更新设备状态与资源总览。</p>
                <p className="pt-1">
                  <Link
                    href={`/supplier/offline-tasks/${commitResult.batchId}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    查看批次详情
                  </Link>
                </p>
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>关闭</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
