'use client'

import { useState, type ReactNode } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { LocaleLink } from '@/lib/i18n/navigation'
import { trpc } from '@/lib/trpc/client'
import { MerchantActivityPanel } from './merchant-activity-panel'
import { MerchantDetailNav } from './merchant-detail-nav'
import { MerchantEditDialog } from './merchant-edit-dialog'
import {
  formatMoney,
  MERCHANT_STATUS_BADGE,
  merchantAccessModeLabels,
  merchantStatusLabels,
  merchantTypeLabels,
} from './merchant-utils'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'

export function MerchantDetailContent({ merchantId }: { merchantId: string }) {
  const utils = trpc.useUtils()
  const { data: merchant, isLoading, isError } = trpc.merchant.getById.useQuery({ id: merchantId })
  const tenantQuery = trpc.merchant.tenant.list.useQuery({ id: merchantId })
  const regionsQuery = trpc.merchant.region.list.useQuery({ merchantId })
  const pricingQuery = trpc.merchant.pricing.list.useQuery({ merchantId })
  const summaryQuery = trpc.merchant.consumption.summary.useQuery({ merchantId })
  const [editOpen, setEditOpen] = useState(false)

  const updateMutation = trpc.merchant.update.useMutation({
    onSuccess: async () => {
      await utils.merchant.getById.invalidate({ id: merchantId })
      await utils.merchant.activity.list.invalidate({ merchantId })
    },
  })

  const regions = regionsQuery.data ?? []
  const prices = pricingQuery.data ?? []
  const summary = summaryQuery.data

  if (isLoading || summaryQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        加载商户信息…
      </div>
    )
  }

  if (isError || !merchant) {
    return <p className="text-muted-foreground py-8">商户不存在或加载失败</p>
  }

  return (
    <div className="space-y-6">
      <MerchantDetailNav merchant={merchant} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">基本信息</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" />
              编辑
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
            <InfoRow label="展示简称" value={merchant.name} />
            <InfoRow label="公司全称" value={merchant.companyFullName} />
            <InfoRow label="统一社会信用代码" value={merchant.unifiedSocialCreditCode} mono />
            <InfoRow label="业务 Code" value={merchant.code} mono />
            <InfoRow label="平台商户 ID" value={String(merchant.platformMerchantId)} />
            <InfoRow label="Merchant Mark" value={merchant.merchantMark ?? '—'} />
            <InfoRow label="接入模式" value={merchantAccessModeLabels[merchant.accessMode]} />
            <InfoRow label="类型" value={merchantTypeLabels[merchant.type]} />
            <InfoRow label="状态">
              <Badge variant="outline" className={MERCHANT_STATUS_BADGE[merchant.status]}>
                {merchantStatusLabels[merchant.status]}
              </Badge>
            </InfoRow>
            <InfoRow label="联系人" value={merchant.contactUser ?? '—'} />
            <InfoRow label="联系电话" value={merchant.contactPhone ?? '—'} />
            <InfoRow
              label="最近平台同步"
              value={
                merchant.platformSyncedAt
                  ? new Date(merchant.platformSyncedAt).toLocaleString('zh-CN')
                  : '—'
              }
            />
            <InfoRow label="备注" value={merchant.remark ?? '—'} className="sm:col-span-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">本月消耗概览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summaryQuery.isError ? (
              <p className="text-muted-foreground">消耗数据加载失败</p>
            ) : summary ? (
              <>
                <StatRow label="总消费" value={`¥${formatMoney(summary.monthAmount)}`} />
                <StatRow label="算力券" value={`¥${formatMoney(summary.monthVoucherAmount)}`} />
                <StatRow label="实付" value={`¥${formatMoney(summary.monthBalanceAmount)}`} />
                <StatRow
                  label="关联租户"
                  value={String(tenantQuery.data?.length ?? summary.activeTenantCount)}
                />
              </>
            ) : (
              <p className="text-muted-foreground">暂无消耗数据</p>
            )}
            <Button variant="outline" size="sm" className="w-full mt-2" asChild>
              <LocaleLink href={`/merchant/${merchant.id}/consumption`}>查看消耗详情</LocaleLink>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <QuickCard
          title="关联租户"
          count={tenantQuery.data?.length ?? 0}
          desc={`${tenantQuery.data?.filter((t) => t.isPrimary).length ?? 0} 个主绑定`}
          href={`/merchant/${merchant.id}/tenants`}
        />
        <QuickCard
          title="机房区域"
          count={regions.filter((r) => r.status === 'open').length}
          desc={`共 ${regions.length} 个配置区域`}
          href={`/merchant/${merchant.id}/regions`}
        />
        <QuickCard
          title="进货价条目"
          count={prices.length}
          desc="机房 × 卡型 × 产品线"
          href={`/merchant/${merchant.id}/pricing`}
        />
      </div>

      <MerchantActivityPanel merchantId={merchant.id} />

      <MerchantEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        merchant={merchant}
        onSave={async (input) => {
          await updateMutation.mutateAsync({
            id: merchant.id,
            ...input,
            merchantMark: input.merchantMark || undefined,
            contactUser: input.contactUser || undefined,
            contactPhone: input.contactPhone || undefined,
            remark: input.remark || undefined,
          })
        }}
      />
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono,
  className,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {children ?? (
        <p className={mono ? 'font-mono text-xs break-all' : ''}>{value}</p>
      )}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

function QuickCard({
  title,
  count,
  desc,
  href,
}: {
  title: string
  count: number
  desc: string
  href: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">{count}</p>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href={href}>进入</LocaleLink>
        </Button>
      </CardContent>
    </Card>
  )
}
