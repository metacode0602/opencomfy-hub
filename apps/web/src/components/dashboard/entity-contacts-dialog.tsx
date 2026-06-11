'use client'

import { useEffect, useState } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { MoreHorizontal, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react'
import type { EntityContact, EntityContactInput } from '@/lib/types/entity-contact'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
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
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Badge } from '@workspace/ui/components/badge'

type FormMode = 'create' | 'edit'

type ContactFormValues = EntityContactInput

const emptyForm: ContactFormValues = {
  name: '',
  phone: '',
  email: '',
  wechatId: '',
  title: '',
  remark: '',
  isPrimary: false,
}

function ContactFormDialog({
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
  initial: EntityContact | null
  isSubmitting: boolean
  onSubmit: (values: ContactFormValues) => void
}) {
  const [form, setForm] = useState<ContactFormValues>(emptyForm)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && initial) {
      setForm({
        name: initial.name,
        phone: initial.phone,
        email: initial.email,
        wechatId: initial.wechatId,
        title: initial.title,
        remark: initial.remark,
        isPrimary: initial.isPrimary,
      })
    } else {
      setForm(emptyForm)
    }
    setSubmitError(null)
  }, [open, mode, initial])

  const handleSubmit = () => {
    const name = form.name.trim()
    const phone = form.phone?.trim() ?? ''
    const email = form.email?.trim() ?? ''
    const wechatId = form.wechatId?.trim() ?? ''

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

    onSubmit({
      name,
      phone,
      email,
      wechatId,
      title: form.title?.trim() ?? '',
      remark: form.remark?.trim() ?? '',
      isPrimary: form.isPrimary ?? false,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增联系人' : '编辑联系人'}</DialogTitle>
          <DialogDescription>至少提供一种联系方式；主联系人会同步到列表摘要字段</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="entity-contact-name">姓名 *</Label>
            <Input
              id="entity-contact-name"
              value={form.name}
              disabled={isSubmitting}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }))
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="entity-contact-title">职务</Label>
            <Input
              id="entity-contact-title"
              value={form.title ?? ''}
              disabled={isSubmitting}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="entity-contact-phone">手机号</Label>
            <Input
              id="entity-contact-phone"
              value={form.phone ?? ''}
              disabled={isSubmitting}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, phone: e.target.value }))
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="entity-contact-email">邮箱</Label>
            <Input
              id="entity-contact-email"
              type="email"
              value={form.email ?? ''}
              disabled={isSubmitting}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, email: e.target.value }))
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="entity-contact-wechat">微信号</Label>
            <Input
              id="entity-contact-wechat"
              value={form.wechatId ?? ''}
              disabled={isSubmitting}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, wechatId: e.target.value }))
                setSubmitError(null)
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="entity-contact-remark">备注</Label>
            <Textarea
              id="entity-contact-remark"
              value={form.remark ?? ''}
              disabled={isSubmitting}
              rows={2}
              onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.isPrimary ?? false}
              disabled={isSubmitting}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isPrimary: checked === true }))
              }
            />
            设为主联系人
          </label>
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

export type EntityContactsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  contacts: EntityContact[]
  isLoading?: boolean
  isSubmitting?: boolean
  onCreate: (values: EntityContactInput) => void | Promise<unknown>
  onUpdate: (id: string, values: EntityContactInput) => void | Promise<unknown>
  onDelete: (id: string) => void | Promise<unknown>
  onSetPrimary: (id: string) => void | Promise<unknown>
}

export function EntityContactsDialog({
  open,
  onOpenChange,
  title,
  description,
  contacts,
  isLoading,
  isSubmitting = false,
  onCreate,
  onUpdate,
  onDelete,
  onSetPrimary,
}: EntityContactsDialogProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingContact, setEditingContact] = useState<EntityContact | null>(null)
  const [deletingContact, setDeletingContact] = useState<EntityContact | null>(null)

  const openCreate = () => {
    setFormMode('create')
    setEditingContact(null)
    setFormOpen(true)
  }

  const openEdit = (contact: EntityContact) => {
    setFormMode('edit')
    setEditingContact(contact)
    setFormOpen(true)
  }

  const handleSubmit = (values: ContactFormValues) => {
    if (formMode === 'create') {
      void Promise.resolve(onCreate(values)).then(() => setFormOpen(false))
      return
    }
    if (!editingContact) return
    void Promise.resolve(onUpdate(editingContact.id, values)).then(() => setFormOpen(false))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="size-4" />
              {title}
            </DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1 size-4" />
              新增
            </Button>
          </div>

          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">姓名</TableHead>
                  <TableHead className="text-muted-foreground">职务</TableHead>
                  <TableHead className="text-muted-foreground">手机</TableHead>
                  <TableHead className="text-muted-foreground">邮箱</TableHead>
                  <TableHead className="text-muted-foreground">微信</TableHead>
                  <TableHead className="text-muted-foreground">主联系人</TableHead>
                  <TableHead className="w-12 text-muted-foreground" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      <IconLoader2 className="mx-auto size-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : contacts.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      暂无联系人，点击「新增」添加
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow key={contact.id} className="border-border">
                      <TableCell className="font-medium text-foreground">{contact.name}</TableCell>
                      <TableCell className="text-foreground">{contact.title || '—'}</TableCell>
                      <TableCell className="text-foreground">{contact.phone || '—'}</TableCell>
                      <TableCell className="break-all text-foreground">
                        {contact.email || '—'}
                      </TableCell>
                      <TableCell className="text-foreground">{contact.wechatId || '—'}</TableCell>
                      <TableCell>
                        {contact.isPrimary ? (
                          <Badge variant="secondary" className="text-xs">
                            主联系人
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEdit(contact)}>
                              <Pencil className="mr-2 size-4" />
                              编辑
                            </DropdownMenuItem>
                            {!contact.isPrimary && (
                              <DropdownMenuItem onSelect={() => void onSetPrimary(contact.id)}>
                                <Star className="mr-2 size-4" />
                                设为主联系人
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => setDeletingContact(contact)}
                            >
                              <Trash2 className="mr-2 size-4" />
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

      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={editingContact}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={!!deletingContact}
        onOpenChange={(next) => {
          if (!next) setDeletingContact(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除联系人？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deletingContact?.name}」的联系方式。若为主联系人，需先指定新的主联系人。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              onClick={() => {
                if (!deletingContact) return
                void Promise.resolve(onDelete(deletingContact.id)).then(() =>
                  setDeletingContact(null),
                )
              }}
            >
              {isSubmitting ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
