"use client"

import * as React from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { IconCalendarOff, IconCloudDownload, IconPencil } from "@tabler/icons-react"
import { CrmTenantInternalSettingDialog } from "./crm-tenant-internal-setting-dialog"
import type { BillingTenantDetail } from "@/lib/types/billing-tenant"
import { CrmTenantBillingImportDialog } from "./crm-tenant-billing-import-dialog"
import { CrmTenantEditDialog } from "./crm-tenant-edit-dialog"
import { CrmTenantRechargesList } from "./crm-tenant-recharges-list"
import { CrmTenantMonthlyBillsList } from "./crm-tenant-monthly-bills-list"
import { CrmTenantMetalOrdersList } from "./crm-tenant-metal-orders-list"
import { CrmTenantReservedPackOrdersList } from "./crm-tenant-reserved-pack-orders-list"
import { TenantContactsSection } from "@/components/dashboard/entity-contacts-section"
import { CopyToClipboard } from "@/components/shared/copy-to-clipboard"

function formatStatus(status: string) {
  switch (status) {
    case "active":
      return "正常"
    case "inactive":
      return "停用"
    case "suspended":
      return "暂停"
    default:
      return status
  }
}

function formatCustomerType(type: "B" | "C") {
  return type === "B" ? "企业" : "个人"
}

function formatTenantType(type: "internal" | "external") {
  return type === "internal" ? "内部租户" : "外部租户"
}

function formatInternalIncomeExclusion(d: BillingTenantDetail) {
  if (d.type !== "internal") return "—"
  if (!d.internalEffectiveFrom && !d.internalEffectiveTo) {
    return "全历史排除（月度收入 / 个人收入 / 提成基数）"
  }
  const from = d.internalEffectiveFrom ?? "不限"
  const to = d.internalEffectiveTo ?? "不限"
  return `${from} ～ ${to}（与账期自然日交集时排除）`
}

function formatMoney(amount: number) {
  return amount.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDateTime(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("zh-CN", { hour12: false })
}

export function CrmTenantDetailClient({ tenantId }: { tenantId: string }) {
  const utils = trpc.useUtils()
  const { data, isLoading } = trpc.crm.tenants.getById.useQuery({ id: tenantId })

  const [billingImportOpen, setBillingImportOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [internalSettingOpen, setInternalSettingOpen] = React.useState(false)

  const handleUpdated = React.useCallback(
    (row: BillingTenantDetail) => {
      void utils.crm.tenants.getById.setData({ id: tenantId }, row)
      void utils.crm.tenants.list.invalidate()
    },
    [tenantId, utils.crm.tenants.getById, utils.crm.tenants.list],
  )

  if (isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">加载中…</p>
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到计费租户。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/tenants">返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  return (
    <div className="bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href="/crm/tenants">← 返回列表</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/crm/customers/${data.customerId}`}>查看客户</LocaleLink>
        </Button>
        <Button variant="default" size="sm" type="button" onClick={() => setEditOpen(true)}>
          <IconPencil className="mr-1.5 size-4" />
          编辑信息
        </Button>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setInternalSettingOpen(true)}
        >
          <IconCalendarOff className="mr-1.5 size-4" />
          收入排除设置
        </Button>
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={() => setBillingImportOpen(true)}
        >
          <IconCloudDownload className="mr-1.5 size-4" />
          从平台同步账单
        </Button>
      </div>

      <CrmTenantEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenantId={tenantId}
        detail={data}
        onUpdated={handleUpdated}
      />

      <CrmTenantInternalSettingDialog
        open={internalSettingOpen}
        onOpenChange={setInternalSettingOpen}
        tenant={data}
        onUpdated={handleUpdated}
      />

      <CrmTenantBillingImportDialog
        open={billingImportOpen}
        onOpenChange={setBillingImportOpen}
        tenantId={tenantId}
        tenantName={data.name}
        platformTenantId={data.platformTenantId}
        onImported={() => {
          void utils.crm.tenants.getById.invalidate({ id: tenantId })
          void utils.crm.tenants.listRecharges.invalidate({ tenantId })
          void utils.crm.tenants.listMonthlyBills.invalidate({ tenantId })
          void utils.crm.tenants.listMetalOrders.invalidate({ tenantId })
          void utils.crm.tenants.listReservedPackOrders.invalidate({ tenantId })
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>计费租户</CardTitle>
            <CardDescription>
              平台租户 ID：{data.platformTenantId ?? "—"}
              {data.isDefault ? " · 默认账户" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadOnly label="租户显示名" value={data.name} />
            <ReadOnly label="租户手机号" value={data.phone ?? "—"} />
            <ReadOnly label="租户类型" value={formatTenantType(data.type)} />
            {data.type === "internal" && (
              <ReadOnly label="收入排除有效期" value={formatInternalIncomeExclusion(data)} />
            )}
            <ReadOnly label="状态" value={formatStatus(data.status)} />
            <ReadOnly label="余额(元)" value={formatMoney(data.balance)} />
            <ReadOnly label="欠费时间" value={formatDateTime(data.overdueAt)} />
            <ReadOnly
              label="授信额度(元)"
              value={data.creditLimit != null ? formatMoney(data.creditLimit) : "—"}
            />
            <ReadOnly label="客户默认计费账户" value={data.isDefault ? "是" : "否"} />
            <ReadOnly label="更新时间" value={formatDateTime(data.updatedAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              关联客户
              <Badge variant="outline">{formatCustomerType(data.customerType)}</Badge>
            </CardTitle>
            <CardDescription>客户名称不可在此修改</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadOnly label="客户名称" value={data.customerName} />
            <ReadOnly label="客户类型" value={formatCustomerType(data.customerType)} />
            <ReadOnly label="主联系人" value={data.customerContactPerson ?? "—"} />
            <ReadOnly
              label="联系人手机"
              value={data.customerContactPhone ?? "—"}
              copyText={data.customerContactPhone ?? undefined}
            />
            <ReadOnly
              label="联系邮箱"
              value={data.customerContactEmail ?? "—"}
              copyText={data.customerContactEmail ?? undefined}
            />
            <ReadOnly label="客户状态" value={formatStatus(data.customerStatus)} />
            <ReadOnly label="创建时间" value={formatDateTime(data.createdAt)} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <TenantContactsSection tenantId={tenantId} />
      </div>

      <div className="mt-6 space-y-6">
        <CrmTenantRechargesList tenantId={tenantId} />
        <CrmTenantMonthlyBillsList tenantId={tenantId} />
        <CrmTenantMetalOrdersList tenantId={tenantId} />
        <CrmTenantReservedPackOrdersList tenantId={tenantId} />
      </div>
    </div>
  )
}

function ReadOnly({
  label,
  value,
  copyText,
}: {
  label: string
  value: string
  copyText?: string
}) {
  return (
    <div>
      <div className="text-muted-foreground mb-0.5 text-xs">{label}</div>
      <div className="flex items-center gap-1 text-sm">
        <span>{value}</span>
        {copyText ? (
          <CopyToClipboard text={copyText} tooltip={`复制${label}`} />
        ) : null}
      </div>
    </div>
  )
}
