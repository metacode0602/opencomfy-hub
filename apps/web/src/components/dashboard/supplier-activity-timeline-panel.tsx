'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Activity, ChevronRight } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import { BATCH_KIND_LABELS } from '@/lib/supplier/device-import-utils'

const typeLabels: Record<string, string> = {
  batch_started: '批次',
  device_online: '上线',
  device_onboarding: '接入',
  internal_test_hold: '测试',
  fault_opened: '故障',
  fault_closed: '故障',
  ops_import: '导入',
  device_change_imported: '变更导入',
  pricing_change: '定价',
  contract_created: '合同',
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SupplierActivityTimelinePanel({ supplierId }: { supplierId: string }) {
  const activities = useSupplierDomainMockStore((s) => s.supplierActivities)

  const items = useMemo(
    () =>
      activities
        .filter((a) => a.supplier_id === supplierId)
        .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)),
    [activities, supplierId],
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-foreground">活动时间线</h2>
        <p className="text-sm text-muted-foreground">合同、接入、上线、故障与测试等运营事件（Mock）</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground text-sm">暂无活动记录</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((a) => (
                <li key={a.id} className="p-4 flex gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{a.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[a.type] ?? a.type}
                      </Badge>
                      {a.author_role === 'system' && (
                        <Badge variant="secondary" className="text-xs">系统</Badge>
                      )}
                    </div>
                    {a.description && (
                      <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {a.author_name} · {formatDt(a.occurred_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function SupplierOnboardingBatchesPanel({ supplierId }: { supplierId: string }) {
  const allBatches = useSupplierDomainMockStore((s) => s.onboardingBatches)

  const batches = useMemo(
    () => allBatches.filter((b) => b.supplier_id === supplierId),
    [allBatches, supplierId],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">接入批次</h2>
          <p className="text-sm text-muted-foreground">上架、订单接入、设备主数据与设备变更批次</p>
        </div>
        <Link href="/supplier/online-tasks" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          接入工作台
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid gap-3">
        {batches.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground text-sm">暂无接入批次</CardContent>
          </Card>
        ) : (
          batches.map((b) => (
            <Card key={b.id}>
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{b.batch_code}</CardTitle>
                  <Badge variant="outline">{b.batch_status}</Badge>
                </div>
                <CardDescription>
                  {BATCH_KIND_LABELS[b.batch_kind] ?? b.batch_kind} · {b.idc_code} · 已入库 {b.committed_device_count} 台
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <Link
                  href={
                    b.batch_kind === 'online'
                      ? `/supplier/online-tasks/${b.id}`
                      : `/supplier/order-access/${b.id}`
                  }
                  className="text-sm text-primary hover:underline"
                >
                  查看批次详情
                </Link>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
