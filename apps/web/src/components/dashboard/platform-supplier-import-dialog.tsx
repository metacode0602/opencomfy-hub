'use client'

import * as React from 'react'
import { IconAlertTriangle, IconLoader2, IconPlus } from '@tabler/icons-react'
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
import { Label } from '@workspace/ui/components/label'
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
import { Textarea } from '@workspace/ui/components/textarea'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'

import { contractPricingModeNames } from '@/lib/data/types'
import type { UserStaff } from '@/lib/types/crm'
import {
  mockCommitPlatformSupplierImport,
  mockPreviewPlatformSupplierImport,
  PLATFORM_SUPPLIER_IMPORT_MAX_IDS,
} from '@/lib/supplier/platform-supplier-import-mock'
import { parsePlatformSupplierIds } from '@/lib/supplier/platform-supplier-import-utils'
import type {
  PlatformSupplierImportCommitResult,
  PlatformSupplierImportPreviewResult,
  PlatformSupplierPreviewItem,
} from '@/lib/types/platform-supplier-import'

type Step = 'input' | 'preview' | 'done'

const ONBOARDING_LABEL = { enterprise: '企业', individual: '个人' } as const

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function ActionBadge({ item }: { item: PlatformSupplierPreviewItem }) {
  if (item.missingOnPlatform) {
    return <Badge variant="secondary">平台无数据</Badge>
  }
  if (item.action === 'update') {
    return <Badge variant="outline">更新</Badge>
  }
  if (item.action === 'create') {
    return <Badge>新建</Badge>
  }
  return <Badge variant="secondary">跳过</Badge>
}

export function PlatformSupplierImportDialog({
  open,
  onOpenChange,
  activeStaff,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeStaff: UserStaff[]
  onSuccess: () => void
}) {
  const [step, setStep] = React.useState<Step>('input')
  const [idsRaw, setIdsRaw] = React.useState('')
  const [businessManagerStaffId, setBusinessManagerStaffId] = React.useState('')
  const [preview, setPreview] = React.useState<PlatformSupplierImportPreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<PlatformSupplierImportCommitResult | null>(
    null,
  )
  const [loading, setLoading] = React.useState(false)

  const reset = React.useCallback(() => {
    setStep('input')
    setIdsRaw('')
    setBusinessManagerStaffId('')
    setPreview(null)
    setCommitResult(null)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const actionableItems = React.useMemo(
    () => preview?.items.filter((i) => !i.missingOnPlatform && i.action !== 'skip') ?? [],
    [preview],
  )

  const previewSummary =
    preview &&
    `共 ${preview.items.length} 条，平台返回 ${preview.items.filter((i) => !i.missingOnPlatform).length} 条，本地已有 ${preview.items.filter((i) => i.local).length} 条`

  const onFetchPreview = async () => {
    const ids = parsePlatformSupplierIds(idsRaw)
    if (ids.length === 0) {
      toast.error('请输入有效的平台入驻 ID（纯数字）')
      return
    }
    if (ids.length > PLATFORM_SUPPLIER_IMPORT_MAX_IDS) {
      toast.error(`单次最多 ${PLATFORM_SUPPLIER_IMPORT_MAX_IDS} 个 ID`)
      return
    }
    if (!businessManagerStaffId) {
      toast.error('请选择默认商务经理')
      return
    }

    const manager = activeStaff.find((s) => s.id === businessManagerStaffId)
    if (!manager) {
      toast.error('所选商务经理无效')
      return
    }

    setLoading(true)
    try {
      const result = await mockPreviewPlatformSupplierImport({
        externalOnboardingIds: ids,
        defaultBusinessManagerStaffId: businessManagerStaffId,
        defaultBusinessManagerLabel: manager.display_name,
      })
      setPreview(result)
      setStep('preview')
      if (result.missingPlatformIds.length > 0) {
        toast.warning(`有 ${result.missingPlatformIds.length} 个 ID 平台未返回`)
      } else if (result.items.filter((i) => !i.missingOnPlatform).length === 0) {
        toast.error('平台未返回任何有效供应商')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '拉取失败')
    } finally {
      setLoading(false)
    }
  }

  const onCommit = async () => {
    if (!preview) return
    if (actionableItems.length === 0) {
      toast.error('没有可导入的供应商')
      return
    }

    setLoading(true)
    try {
      const result = await mockCommitPlatformSupplierImport({
        defaultBusinessManagerStaffId: preview.defaultBusinessManagerStaffId,
        items: actionableItems.map((i) => ({ externalOnboardingId: i.externalOnboardingId })),
      })
      setCommitResult(result)
      setStep('done')
      const fail = result.errors.length
      if (fail > 0) {
        toast.warning(
          `导入完成：新建 ${result.created}，更新 ${result.updated}，${fail} 条失败`,
        )
      } else {
        toast.success(`导入完成：新建 ${result.created}，更新 ${result.updated}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (next: boolean) => {
    if (!next && step === 'done') onSuccess()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'input' && '从平台导入供应商'}
            {step === 'preview' && '确认导入供应商'}
            {step === 'done' && '导入完成'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input' &&
              `输入平台入驻 ID，多个可用逗号或换行分隔（最多 ${PLATFORM_SUPPLIER_IMPORT_MAX_IDS} 个）。新建供应商将统一写入所选商务经理。`}
            {step === 'preview' &&
              (previewSummary ??
                '核对平台数据；已有本地供应商仅更新平台字段，不修改商务经理。')}
            {step === 'done' && '导入结果如下，关闭后将刷新供应商列表。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === 'input' && (
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="default-business-manager">默认商务经理</Label>
                <Select
                  value={businessManagerStaffId || undefined}
                  onValueChange={setBusinessManagerStaffId}
                  disabled={loading}
                >
                  <SelectTrigger id="default-business-manager">
                    <SelectValue placeholder="选择商务经理（新建供应商必填）" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {activeStaff.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        暂无在职员工
                      </SelectItem>
                    ) : (
                      activeStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.display_name}
                          {s.employee_no ? ` (${s.employee_no})` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  仅对本次导入中「新建」的供应商生效；已存在记录保留原商务经理。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform-supplier-ids">平台入驻 ID</Label>
                <Textarea
                  id="platform-supplier-ids"
                  placeholder={'10001\n10002, 10003'}
                  rows={6}
                  value={idsRaw}
                  disabled={loading}
                  onChange={(e) => setIdsRaw(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  支持半角/中文逗号、空格、换行分隔；仅保留纯数字 ID。Mock 示例：10001、10002、10003。
                </p>
              </div>
            </div>
          )}

          {step === 'preview' && preview && !loading && (
            <div className="space-y-4 px-1">
              <Alert>
                <AlertDescription>
                  默认商务经理：
                  <span className="text-foreground font-medium">
                    {preview.defaultBusinessManagerLabel}
                  </span>
                  （仅新建行写入）
                </AlertDescription>
              </Alert>

              {preview.missingPlatformIds.length > 0 && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>
                    平台未返回：{preview.missingPlatformIds.join('、')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">入驻 ID</TableHead>
                      <TableHead>供应商名称</TableHead>
                      <TableHead className="w-16">类型</TableHead>
                      <TableHead className="w-24">租户 ID</TableHead>
                      <TableHead>联系人</TableHead>
                      <TableHead className="w-20">合作模式</TableHead>
                      <TableHead className="w-20">操作</TableHead>
                      <TableHead className="min-w-[140px]">本地</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.items.map((item) => (
                      <TableRow
                        key={item.externalOnboardingId}
                        className={item.missingOnPlatform ? 'bg-muted/40 opacity-60' : undefined}
                      >
                        <TableCell className="font-mono text-sm">
                          {item.externalOnboardingId}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate" title={item.platform.name}>
                          {item.platform.name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.platform.onboardingType
                            ? ONBOARDING_LABEL[item.platform.onboardingType]
                            : '—'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.platform.platformTenantId ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.platform.contactPerson ?? '—'}
                          {item.platform.contactPhone ? (
                            <span className="text-muted-foreground block text-xs">
                              {item.platform.contactPhone}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.platform.cooperationMode
                            ? contractPricingModeNames[item.platform.cooperationMode]
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <ActionBadge item={item} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.local ? (
                            <>
                              已存在：
                              <span className="text-foreground font-medium">
                                {item.local.supplierName}
                              </span>
                              {item.local.businessManager ? (
                                <span className="block text-xs">
                                  商务：{item.local.businessManager}
                                </span>
                              ) : null}
                            </>
                          ) : item.missingOnPlatform ? (
                            '—'
                          ) : (
                            <span className="text-foreground">将新建</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {step === 'done' && commitResult && (
            <div className="space-y-4 px-1">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="新建" value={commitResult.created} />
                <Stat label="更新" value={commitResult.updated} />
                <Stat label="跳过" value={commitResult.skipped} />
                <Stat label="失败" value={commitResult.errors.length} />
              </div>
              {commitResult.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>入驻 ID</TableHead>
                        <TableHead>原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commitResult.errors.map((err) => (
                        <TableRow key={err.externalOnboardingId}>
                          <TableCell className="font-mono">{err.externalOnboardingId}</TableCell>
                          <TableCell className="text-destructive text-xs">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button type="button" disabled={loading} onClick={() => void onFetchPreview()}>
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    正在从平台拉取…
                  </>
                ) : (
                  '拉取并预览'
                )}
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setStep('input')
                  setPreview(null)
                }}
              >
                上一步
              </Button>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={loading || actionableItems.length === 0}
                onClick={() => void onCommit()}
              >
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    导入中…
                  </>
                ) : (
                  `确认导入${actionableItems.length > 0 ? `（${actionableItems.length} 条）` : ''}`
                )}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button
              type="button"
              onClick={() => {
                onSuccess()
                handleClose(false)
              }}
            >
              关闭并刷新列表
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PlatformSupplierImportTrigger({
  activeStaff,
  onSuccess,
}: {
  activeStaff: UserStaff[]
  onSuccess: () => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-2"
        type="button"
        onClick={() => setOpen(true)}
      >
        <IconPlus className="size-4" />
        导入供应商
      </Button>
      {open ? (
        <PlatformSupplierImportDialog
          open
          onOpenChange={setOpen}
          activeStaff={activeStaff}
          onSuccess={onSuccess}
        />
      ) : null}
    </>
  )
}
