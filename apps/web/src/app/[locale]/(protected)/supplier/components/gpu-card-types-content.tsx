'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Ban,
  CheckCircle,
  Cpu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Label } from '@workspace/ui/components/label'
import type {
  GPUCardType,
  GPUCardTypeManufacturer,
  GPUCardTypeStatus,
} from '@/lib/data/types'
import { manufacturerNames } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'

/** 与 gpu-card-types-schemas 中 gpuCardTypeCodePattern 保持一致 */
const GPU_CARD_TYPE_CODE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

const cardTypeStatusNames: Record<GPUCardTypeStatus, string> = {
  active: '启用',
  disabled: '已禁用',
}

const gpuManufacturers: GPUCardTypeManufacturer[] = [
  'NVIDIA',
  'AMD',
  'Intel',
  'Huawei',
  'Other',
]

type GpuCardTypeRow = GPUCardType & { usageCount: number }

type CardTypeFormMode = 'create' | 'edit'

function CardTypeStatusBadge({ status }: { status: GPUCardTypeStatus }) {
  return (
    <Badge
      variant="outline"
      className={
        status === 'active'
          ? 'bg-green-500/10 text-green-400 border-green-500/30'
          : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
      }
    >
      {cardTypeStatusNames[status]}
    </Badge>
  )
}

function CardTypeFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  existingCodes,
  isSubmitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CardTypeFormMode
  initial: GpuCardTypeRow | null
  existingCodes: string[]
  isSubmitting: boolean
  onSubmit: (
    values: {
      name: string
      manufacturer: GPUCardTypeManufacturer
      memoryGB: number
      tdpWatts?: number
      computeCapability?: string
    } & ({ mode: 'create'; code: string } | { mode: 'edit' }),
  ) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState<GPUCardTypeManufacturer>('NVIDIA')
  const [memoryGB, setMemoryGB] = useState('')
  const [tdpWatts, setTdpWatts] = useState('')
  const [computeCapability, setComputeCapability] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const resetForm = () => {
    if (mode === 'edit' && initial) {
      setCode(initial.code ?? initial.id)
      setName(initial.name)
      setManufacturer(initial.manufacturer)
      setMemoryGB(String(initial.memoryGB))
      setTdpWatts(initial.tdpWatts != null ? String(initial.tdpWatts) : '')
      setComputeCapability(initial.computeCapability ?? '')
    } else {
      setCode('')
      setName('')
      setManufacturer('NVIDIA')
      setMemoryGB('')
      setTdpWatts('')
      setComputeCapability('')
    }
    setSubmitError(null)
  }

  useEffect(() => {
    if (open) resetForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initial])

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
  }

  const handleSubmit = () => {
    const trimmedName = name.trim()
    if (mode === 'create') {
      const trimmedCode = code.trim()
      if (!trimmedCode) {
        setSubmitError('请填写卡型编码')
        return
      }
      if (!GPU_CARD_TYPE_CODE_PATTERN.test(trimmedCode)) {
        setSubmitError('卡型编码仅可包含字母、数字、下划线与连字符')
        return
      }
      if (existingCodes.includes(trimmedCode)) {
        setSubmitError('卡型编码已存在')
        return
      }
    }
    if (!trimmedName) {
      setSubmitError('请填写卡型名称')
      return
    }
    const memory = parseInt(memoryGB, 10)
    if (Number.isNaN(memory) || memory <= 0) {
      setSubmitError('请填写有效的显存容量（GB）')
      return
    }
    const tdpTrimmed = tdpWatts.trim()
    let tdp: number | undefined
    if (tdpTrimmed) {
      const parsed = parseInt(tdpTrimmed, 10)
      if (Number.isNaN(parsed) || parsed <= 0) {
        setSubmitError('请填写有效的 TDP（W）')
        return
      }
      tdp = parsed
    }

    const payload = {
      name: trimmedName,
      manufacturer,
      memoryGB: memory,
      tdpWatts: tdp,
      computeCapability: computeCapability.trim() || undefined,
    }
    if (mode === 'create') {
      onSubmit({ mode: 'create', code: code.trim(), ...payload })
    } else {
      onSubmit({ mode: 'edit', ...payload })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增系统卡型' : '编辑系统卡型'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? '录入平台标准 GPU 卡型，供机房单价与平台定价关联选用'
              : '修改卡型规格信息；编码创建后不可变更'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {mode === 'create' ? (
            <div className="grid gap-2">
              <Label>卡型编码 *</Label>
              <Input
                placeholder="如 A100-80G 或 910B"
                value={code}
                disabled={isSubmitting}
                onChange={(e) => {
                  setCode(e.target.value)
                  setSubmitError(null)
                }}
              />
            </div>
          ) : (
            initial && (
              <div className="grid gap-2">
                <Label>卡型编码</Label>
                <div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                  <code>{initial.code ?? initial.id}</code>
                </div>
              </div>
            )
          )}
          <div className="grid gap-2">
            <Label>卡型名称 *</Label>
            <Input
              placeholder="如 NVIDIA A100 80GB"
              value={name}
              disabled={isSubmitting}
              onChange={(e) => {
                setName(e.target.value)
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>厂商 *</Label>
            <Select
              value={manufacturer}
              onValueChange={(v) => setManufacturer(v as GPUCardTypeManufacturer)}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gpuManufacturers.map((m) => (
                  <SelectItem key={m} value={m}>
                    {manufacturerNames[m] ?? m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>显存（GB）*</Label>
              <Input
                type="number"
                min={1}
                value={memoryGB}
                disabled={isSubmitting}
                onChange={(e) => setMemoryGB(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>TDP（W）</Label>
              <Input
                type="number"
                min={1}
                placeholder="选填"
                value={tdpWatts}
                disabled={isSubmitting}
                onChange={(e) => setTdpWatts(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>算力版本</Label>
            <Input
              placeholder="如 8.0（选填）"
              value={computeCapability}
              disabled={isSubmitting}
              onChange={(e) => setComputeCapability(e.target.value)}
            />
          </div>
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '保存中…' : mode === 'create' ? '创建' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GpuCardTypesContent() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | GPUCardTypeStatus>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<CardTypeFormMode>('create')
  const [editingCard, setEditingCard] = useState<GpuCardTypeRow | null>(null)

  const utils = trpc.useUtils()
  const { data: cardTypes = [], isLoading, isError, error, refetch } =
    trpc.supplier.gpuCardTypes.list.useQuery({
      search: searchTerm || undefined,
      status: statusFilter,
    })

  const createMutation = trpc.supplier.gpuCardTypes.create.useMutation({
    onSuccess: async () => {
      toast.success('卡型已创建')
      setFormOpen(false)
      await utils.supplier.gpuCardTypes.list.invalidate()
      await utils.supplier.gpuCardTypes.listActive.invalidate()
    },
    onError: (e) => toast.error(e.message || '创建失败，请稍后重试'),
  })

  const updateMutation = trpc.supplier.gpuCardTypes.update.useMutation({
    onSuccess: async () => {
      toast.success('卡型已更新')
      setFormOpen(false)
      await utils.supplier.gpuCardTypes.list.invalidate()
      await utils.supplier.gpuCardTypes.listActive.invalidate()
    },
    onError: (e) => toast.error(e.message || '更新失败，请稍后重试'),
  })

  const setStatusMutation = trpc.supplier.gpuCardTypes.setStatus.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(variables.status === 'active' ? '卡型已启用' : '卡型已禁用')
      await utils.supplier.gpuCardTypes.list.invalidate()
      await utils.supplier.gpuCardTypes.listActive.invalidate()
    },
    onError: (e) => toast.error(e.message || '状态更新失败'),
  })

  const existingCodes = useMemo(
    () => cardTypes.map((c) => c.code ?? c.id),
    [cardTypes],
  )

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const openCreate = () => {
    setFormMode('create')
    setEditingCard(null)
    setFormOpen(true)
  }

  const openEdit = (card: GpuCardTypeRow) => {
    setFormMode('edit')
    setEditingCard(card)
    setFormOpen(true)
  }

  const handleSubmit = (
    values: {
      name: string
      manufacturer: GPUCardTypeManufacturer
      memoryGB: number
      tdpWatts?: number
      computeCapability?: string
    } & ({ mode: 'create'; code: string } | { mode: 'edit' }),
  ) => {
    if (values.mode === 'create') {
      const { mode: _mode, ...data } = values
      createMutation.mutate(data)
      return
    }
    if (!editingCard) return
    const { mode: _mode, ...data } = values
    updateMutation.mutate({ id: editingCard.id, data })
  }

  const toggleStatus = (card: GpuCardTypeRow) => {
    const nextStatus: GPUCardTypeStatus = card.status === 'active' ? 'disabled' : 'active'
    setStatusMutation.mutate({ id: card.id, status: nextStatus })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">系统卡型</h1>
        <p className="text-sm text-muted-foreground">
          维护平台 GPU 卡型主数据，供机房成本定价与平台刊例价引用
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">卡型列表</CardTitle>
            <CardDescription>
              平台维护的标准 GPU 卡型字典，禁用前须确保无定价配置引用
            </CardDescription>
          </div>
          <Button className="gap-2 shrink-0" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            新增卡型
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索编码、名称、厂商..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'all' | GPUCardTypeStatus)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">启用</SelectItem>
                <SelectItem value="disabled">已禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isError && (
            <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <span className="text-destructive">
                {error.message || '加载卡型列表失败'}
              </span>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                重试
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">编码</TableHead>
                <TableHead className="text-muted-foreground">名称</TableHead>
                <TableHead className="text-muted-foreground">厂商</TableHead>
                <TableHead className="text-muted-foreground">显存</TableHead>
                <TableHead className="text-muted-foreground">TDP</TableHead>
                <TableHead className="text-muted-foreground">算力版本</TableHead>
                <TableHead className="text-muted-foreground">状态</TableHead>
                <TableHead className="text-muted-foreground">定价引用</TableHead>
                <TableHead className="text-muted-foreground w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className="border-border">
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : cardTypes.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                    暂无匹配的卡型
                  </TableCell>
                </TableRow>
              ) : (
                cardTypes.map((card) => {
                  const isDisabled = card.status === 'disabled'
                  return (
                    <TableRow
                      key={card.id}
                      className={`border-border ${isDisabled ? 'opacity-60' : ''}`}
                    >
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded">
                          {card.code ?? card.id}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-muted-foreground" />
                          {card.name}
                        </div>
                      </TableCell>
                      <TableCell>{manufacturerNames[card.manufacturer] ?? card.manufacturer}</TableCell>
                      <TableCell>{card.memoryGB} GB</TableCell>
                      <TableCell>
                        {card.tdpWatts != null ? `${card.tdpWatts} W` : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {card.computeCapability || '—'}
                      </TableCell>
                      <TableCell>
                        <CardTypeStatusBadge status={card.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {card.usageCount > 0 ? `${card.usageCount} 条` : '—'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(card)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleStatus(card)}
                              disabled={setStatusMutation.isPending}
                            >
                              {card.status === 'active' ? (
                                <>
                                  <Ban className="w-4 h-4 mr-2" />
                                  禁用
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  启用
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CardTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={editingCard}
        existingCodes={existingCodes}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
