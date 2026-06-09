'use client'

import { useEffect, useState } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { MoreHorizontal, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { DataCenter } from '@/lib/data/types'
import type { SupplierOpsEngineer } from '@/lib/types/supplier-ops-engineer'
import { trpc } from '@/lib/trpc/client'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

type FormMode = 'create' | 'edit'

type OpsEngineerFormValues = {
  name: string
  phone: string
  email: string
  wechatId: string
}

const emptyForm: OpsEngineerFormValues = {
  name: '',
  phone: '',
  email: '',
  wechatId: '',
}

function OpsEngineerFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  isSubmitting,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: FormMode
  initial: SupplierOpsEngineer | null
  isSubmitting: boolean
  onSubmit: (values: OpsEngineerFormValues) => void
}) {
  const [form, setForm] = useState<OpsEngineerFormValues>(emptyForm)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && initial) {
      setForm({
        name: initial.name,
        phone: initial.phone,
        email: initial.email,
        wechatId: initial.wechatId,
      })
    } else {
      setForm(emptyForm)
    }
    setSubmitError(null)
  }, [open, mode, initial])

  const handleSubmit = () => {
    const name = form.name.trim()
    const phone = form.phone.trim()
    const email = form.email.trim()
    const wechatId = form.wechatId.trim()

    if (!name) {
      setSubmitError('请填写姓名')
      return
    }
    if (!phone && !email && !wechatId) {
      setSubmitError('请至少填写手机号、邮箱或微信号中的一项')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError('请填写有效的邮箱地址')
      return
    }

    onSubmit({ name, phone, email, wechatId })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增运维工程师' : '编辑运维工程师'}</DialogTitle>
          <DialogDescription>填写运维工程师联系方式，至少提供一种联系方式</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="ops-engineer-name">姓名 *</Label>
            <Input
              id="ops-engineer-name"
              value={form.name}
              disabled={isSubmitting}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }))
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ops-engineer-phone">手机号</Label>
            <Input
              id="ops-engineer-phone"
              value={form.phone}
              disabled={isSubmitting}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, phone: e.target.value }))
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ops-engineer-email">邮箱</Label>
            <Input
              id="ops-engineer-email"
              type="email"
              value={form.email}
              disabled={isSubmitting}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, email: e.target.value }))
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ops-engineer-wechat">微信号</Label>
            <Input
              id="ops-engineer-wechat"
              value={form.wechatId}
              disabled={isSubmitting}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, wechatId: e.target.value }))
                setSubmitError(null)
              }}
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

export function SupplierOpsEngineersDialog({
  open,
  onOpenChange,
  dataCenter,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dataCenter: DataCenter | null
}) {
  const utils = trpc.useUtils()
  const dataCenterId = dataCenter?.id ?? ''

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingEngineer, setEditingEngineer] = useState<SupplierOpsEngineer | null>(null)
  const [deletingEngineer, setDeletingEngineer] = useState<SupplierOpsEngineer | null>(null)

  const { data: engineers = [], isLoading } = trpc.supplier.listOpsEngineers.useQuery(
    { dataCenterId },
    { enabled: open && !!dataCenterId },
  )

  const invalidate = async () => {
    await utils.supplier.listOpsEngineers.invalidate({ dataCenterId })
    if (dataCenter?.supplierId) {
      await utils.supplier.listOpsEngineers.invalidate({ supplierId: dataCenter.supplierId })
    }
  }

  const createMutation = trpc.supplier.createOpsEngineer.useMutation({
    onSuccess: async () => {
      toast.success('运维工程师已添加')
      setFormOpen(false)
      await invalidate()
    },
    onError: (error) => toast.error(error.message || '添加失败，请稍后重试'),
  })

  const updateMutation = trpc.supplier.updateOpsEngineer.useMutation({
    onSuccess: async () => {
      toast.success('运维工程师已更新')
      setFormOpen(false)
      await invalidate()
    },
    onError: (error) => toast.error(error.message || '更新失败，请稍后重试'),
  })

  const deleteMutation = trpc.supplier.deleteOpsEngineer.useMutation({
    onSuccess: async () => {
      toast.success('运维工程师已删除')
      setDeletingEngineer(null)
      await invalidate()
    },
    onError: (error) => toast.error(error.message || '删除失败，请稍后重试'),
  })

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const openCreate = () => {
    setFormMode('create')
    setEditingEngineer(null)
    setFormOpen(true)
  }

  const openEdit = (engineer: SupplierOpsEngineer) => {
    setFormMode('edit')
    setEditingEngineer(engineer)
    setFormOpen(true)
  }

  const handleSubmit = (values: OpsEngineerFormValues) => {
    if (!dataCenterId) return
    if (formMode === 'create') {
      createMutation.mutate({ dataCenterId, ...values })
      return
    }
    if (!editingEngineer) return
    updateMutation.mutate({ id: editingEngineer.id, data: values })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="size-4" />
              运维通讯录
            </DialogTitle>
            <DialogDescription>
              {dataCenter ? `${dataCenter.name} 的运维工程师联系方式` : '管理机房运维工程师联系方式'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate} disabled={!dataCenter}>
              <Plus className="size-4 mr-1" />
              新增
            </Button>
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">姓名</TableHead>
                  <TableHead className="text-muted-foreground">手机号</TableHead>
                  <TableHead className="text-muted-foreground">邮箱</TableHead>
                  <TableHead className="text-muted-foreground">微信号</TableHead>
                  <TableHead className="w-12 text-muted-foreground" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      <IconLoader2 className="mx-auto size-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : engineers.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      暂无运维工程师，点击「新增」添加
                    </TableCell>
                  </TableRow>
                ) : (
                  engineers.map((engineer) => (
                    <TableRow key={engineer.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{engineer.name}</TableCell>
                      <TableCell className="text-foreground">{engineer.phone || '—'}</TableCell>
                      <TableCell className="break-all text-foreground">
                        {engineer.email || '—'}
                      </TableCell>
                      <TableCell className="text-foreground">{engineer.wechatId || '—'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEdit(engineer)}>
                              <Pencil className="size-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setDeletingEngineer(engineer)}
                            >
                              <Trash2 className="size-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <OpsEngineerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={editingEngineer}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={!!deletingEngineer}
        onOpenChange={(next) => {
          if (!next) setDeletingEngineer(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除运维工程师？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deletingEngineer?.name}」的联系方式，此操作会记录审计日志且不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deletingEngineer) return
                deleteMutation.mutate({ id: deletingEngineer.id })
              }}
            >
              {deleteMutation.isPending ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
