'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import { EntityContactsDialog } from '@/components/dashboard/entity-contacts-dialog'
import { EntityContactsList } from '@/components/dashboard/entity-contacts-list'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Phone } from 'lucide-react'

export function CustomerContactsSection({ customerId }: { customerId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const utils = trpc.useUtils()

  const { data: contacts = [], isLoading } = trpc.crm.customers.contacts.list.useQuery(
    { customerId },
    { enabled: !!customerId },
  )

  const invalidate = async () => {
    await utils.crm.customers.contacts.list.invalidate({ customerId })
    await utils.crm.customers.getById.invalidate({ id: customerId })
    await utils.crm.customers.list.invalidate()
  }

  const createMutation = trpc.crm.customers.contacts.create.useMutation({
    onSuccess: async () => {
      toast.success('联系人已添加')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '添加失败'),
  })

  const updateMutation = trpc.crm.customers.contacts.update.useMutation({
    onSuccess: async () => {
      toast.success('联系人已更新')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '更新失败'),
  })

  const deleteMutation = trpc.crm.customers.contacts.delete.useMutation({
    onSuccess: async () => {
      toast.success('联系人已删除')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '删除失败'),
  })

  const setPrimaryMutation = trpc.crm.customers.contacts.setPrimary.useMutation({
    onSuccess: async () => {
      toast.success('已设为主联系人')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '操作失败'),
  })

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    setPrimaryMutation.isPending

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">通讯录</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Phone className="mr-1.5 size-4" />
            管理通讯录
          </Button>
        </CardHeader>
        <CardContent>
          <EntityContactsList contacts={contacts} isLoading={isLoading} />
        </CardContent>
      </Card>

      <EntityContactsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="客户通讯录"
        description="管理客户主体的商务/决策对接人"
        contacts={contacts}
        isLoading={isLoading}
        isSubmitting={isSubmitting}
        onCreate={(values) => createMutation.mutateAsync({ customerId, ...values })}
        onUpdate={(id, values) => updateMutation.mutateAsync({ id, data: values })}
        onDelete={(id) => deleteMutation.mutateAsync({ id })}
        onSetPrimary={(id) => setPrimaryMutation.mutateAsync({ id })}
      />
    </>
  )
}

export function TenantContactsSection({ tenantId }: { tenantId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const utils = trpc.useUtils()

  const { data: contacts = [], isLoading } = trpc.crm.tenants.contacts.list.useQuery(
    { tenantId },
    { enabled: !!tenantId },
  )

  const invalidate = async () => {
    await utils.crm.tenants.contacts.list.invalidate({ tenantId })
    await utils.crm.tenants.getById.invalidate({ id: tenantId })
    await utils.crm.tenants.list.invalidate()
  }

  const createMutation = trpc.crm.tenants.contacts.create.useMutation({
    onSuccess: async () => {
      toast.success('联系人已添加')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '添加失败'),
  })

  const updateMutation = trpc.crm.tenants.contacts.update.useMutation({
    onSuccess: async () => {
      toast.success('联系人已更新')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '更新失败'),
  })

  const deleteMutation = trpc.crm.tenants.contacts.delete.useMutation({
    onSuccess: async () => {
      toast.success('联系人已删除')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '删除失败'),
  })

  const setPrimaryMutation = trpc.crm.tenants.contacts.setPrimary.useMutation({
    onSuccess: async () => {
      toast.success('已设为主联系人')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '操作失败'),
  })

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    setPrimaryMutation.isPending

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">租户通讯录</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Phone className="mr-1.5 size-4" />
            管理通讯录
          </Button>
        </CardHeader>
        <CardContent>
          <EntityContactsList contacts={contacts} isLoading={isLoading} emptyMessage="暂无租户联系人" />
        </CardContent>
      </Card>

      <EntityContactsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="租户通讯录"
        description="管理该计费账户的运营/财务/技术对接人"
        contacts={contacts}
        isLoading={isLoading}
        isSubmitting={isSubmitting}
        onCreate={(values) => createMutation.mutateAsync({ tenantId, ...values })}
        onUpdate={(id, values) => updateMutation.mutateAsync({ id, data: values })}
        onDelete={(id) => deleteMutation.mutateAsync({ id })}
        onSetPrimary={(id) => setPrimaryMutation.mutateAsync({ id })}
      />
    </>
  )
}

export function MerchantContactsSection({ merchantId }: { merchantId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const utils = trpc.useUtils()

  const { data: contacts = [], isLoading } = trpc.merchant.contacts.list.useQuery(
    { merchantId },
    { enabled: !!merchantId },
  )

  const invalidate = async () => {
    await utils.merchant.contacts.list.invalidate({ merchantId })
    await utils.merchant.getById.invalidate({ id: merchantId })
    await utils.merchant.list.invalidate()
  }

  const createMutation = trpc.merchant.contacts.create.useMutation({
    onSuccess: async () => {
      toast.success('联系人已添加')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '添加失败'),
  })

  const updateMutation = trpc.merchant.contacts.update.useMutation({
    onSuccess: async () => {
      toast.success('联系人已更新')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '更新失败'),
  })

  const deleteMutation = trpc.merchant.contacts.delete.useMutation({
    onSuccess: async () => {
      toast.success('联系人已删除')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '删除失败'),
  })

  const setPrimaryMutation = trpc.merchant.contacts.setPrimary.useMutation({
    onSuccess: async () => {
      toast.success('已设为主联系人')
      await invalidate()
    },
    onError: (e) => toast.error(e.message || '操作失败'),
  })

  const isSubmitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    setPrimaryMutation.isPending

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">通讯录</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <Phone className="mr-1.5 size-4" />
            管理通讯录
          </Button>
        </CardHeader>
        <CardContent>
          <EntityContactsList contacts={contacts} isLoading={isLoading} />
        </CardContent>
      </Card>

      <EntityContactsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="商户通讯录"
        description="管理商户主体对接人；平台同步仅更新主联系人"
        contacts={contacts}
        isLoading={isLoading}
        isSubmitting={isSubmitting}
        onCreate={(values) => createMutation.mutateAsync({ merchantId, ...values })}
        onUpdate={(id, values) => updateMutation.mutateAsync({ id, data: values })}
        onDelete={(id) => deleteMutation.mutateAsync({ id })}
        onSetPrimary={(id) => setPrimaryMutation.mutateAsync({ id })}
      />
    </>
  )
}
