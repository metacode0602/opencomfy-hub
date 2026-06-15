'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, History, Loader2, Server } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import {
  CONSISTENCY_FLAG_LABELS,
  CONSISTENCY_FLAG_VARIANT,
  devicePlatformProbeListPath,
  formatProbeDateTime,
  formatProxyRentDisplay,
  formatSnapshotHourLabel,
  PROBE_STATUS_LABELS,
  type DevicePlatformProbeDetail,
  type ProbeCompareRow,
} from '@/lib/supplier/device-platform-probe-utils'
import { trpc } from '@/lib/trpc/client'
import { DevicePlatformProbeChangelogDialog } from './device-platform-probe-changelog-dialog'

type Props = {
  probeId: string
}

function MatchBadge({ matched }: { matched: boolean }) {
  return (
    <Badge variant={matched ? 'secondary' : 'outline'} className="font-normal">
      {matched ? '已命中' : '未命中'}
    </Badge>
  )
}

function FieldGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="font-mono text-xs break-all mt-0.5">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function CompareSection({ rows }: { rows: ProbeCompareRow[] }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">比对项</TableHead>
            <TableHead>CRM 主数据</TableHead>
            <TableHead>接入端 device_info</TableHead>
            <TableHead>K8s node_device</TableHead>
            <TableHead>裸金属订单</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label} className={r.highlight ? 'bg-amber-500/10' : undefined}>
              <TableCell className="font-medium text-sm">{r.label}</TableCell>
              <TableCell className="font-mono text-xs">{r.crm}</TableCell>
              <TableCell className="font-mono text-xs">{r.deviceInfo}</TableCell>
              <TableCell className="font-mono text-xs">{r.nodeDevice}</TableCell>
              <TableCell className="font-mono text-xs">{r.bareMetal}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function PlatformTabs({ detail }: { detail: DevicePlatformProbeDetail }) {
  const { deviceInfo: di, nodeDevice: nd, bareMetal: bm } = detail
  const dash = (v: string | number | boolean | null | undefined) =>
    v === null || v === undefined || v === '' ? '—' : String(v)

  return (
    <Tabs defaultValue="device_info" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="device_info">接入端</TabsTrigger>
        <TabsTrigger value="node_device">K8s</TabsTrigger>
        <TabsTrigger value="bare_metal">裸金属</TabsTrigger>
      </TabsList>
      <TabsContent value="device_info" className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">GET /admin/device_info/list</p>
          <MatchBadge matched={di.matched} />
        </div>
        {di.matched ? (
          <FieldGrid
            items={[
              { label: '平台设备 ID', value: dash(di.platformDeviceId) },
              { label: '设备名称', value: dash(di.name) },
              { label: 'idc_name', value: dash(di.idcName) },
              { label: 'inner_ip', value: dash(di.innerIp) },
              { label: 'pub_ip', value: dash(di.pubIp) },
              { label: 'rent_status', value: dash(di.rentStatus) },
              { label: 'is_container_instance', value: dash(di.isContainerInstance) },
              {
                label: '租赁态（展示）',
                value: formatProxyRentDisplay(true, di.rentStatus, di.isContainerInstance),
              },
              { label: 'online_status', value: dash(di.onlineStatus) },
              { label: 'shelf_status', value: dash(di.shelfStatus) },
              { label: 'listing_mode', value: dash(di.listingMode) },
              { label: 'gpu_model × count', value: `${dash(di.gpuModel)} × ${dash(di.gpuCount)}` },
              { label: 'last_connection_time', value: dash(di.lastConnectionTime) },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            未按 idc_name + inner_ip 命中接入端设备
          </p>
        )}
      </TabsContent>
      <TabsContent value="node_device" className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">GET /admin/node_device/list</p>
          <MatchBadge matched={nd.matched} />
        </div>
        {nd.matched ? (
          <FieldGrid
            items={[
              { label: '平台节点 ID', value: dash(nd.platformNodeId) },
              { label: 'device_name', value: dash(nd.deviceName) },
              { label: 'region', value: dash(nd.region) },
              { label: 'inner_ip', value: dash(nd.innerIp) },
              { label: 'gpu_name × count', value: `${dash(nd.gpuName)} × ${dash(nd.gpuCount)}` },
              { label: 'hash', value: dash(nd.hash) },
              { label: 'offline_date', value: dash(nd.offlineDate) },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            未按 region + inner_ip 命中 K8s 节点
          </p>
        )}
      </TabsContent>
      <TabsContent value="bare_metal" className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">本地 bare_metal_order + device（等待/服务中）</p>
          <MatchBadge matched={bm.matched} />
        </div>
        {bm.matched ? (
          <FieldGrid
            items={[
              { label: 'order_no', value: dash(bm.orderNo) },
              { label: 'order_status', value: dash(bm.orderStatus) },
              { label: 'platform_order_id', value: dash(bm.platformOrderId) },
              { label: 'idc_name', value: dash(bm.idcName) },
              { label: 'bare_metal_region', value: dash(bm.bareMetalRegion) },
              { label: 'internal_ip', value: dash(bm.internalIp) },
              { label: 'tenant', value: dash(bm.tenantName) },
              { label: 'device_model', value: dash(bm.gpuModelText) },
              { label: 'rent_ends_at', value: formatProbeDateTime(bm.rentEndsAt) },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            未命中有效裸金属订单明细
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}

function CrmPanel({ detail }: { detail: DevicePlatformProbeDetail }) {
  const { crm } = detail
  const dash = (v: string | number | boolean | null | undefined) =>
    v === null || v === undefined || v === '' ? '—' : String(v)

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <Server className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">CRM 主数据（探测快照时）</p>
      </div>
      <FieldGrid
        items={[
          { label: 'SN', value: detail.row.sn },
          { label: '运维状态 ops_status', value: crm.opsStatus },
          { label: '生命周期 lifecycle_status', value: crm.lifecycleStatus },
          { label: '维修中 in_maintenance', value: dash(crm.inMaintenance) },
          { label: '内网 IP', value: dash(crm.internalIp) },
          { label: '外网 IP', value: dash(crm.externalIp) },
          { label: '机房名称', value: dash(crm.dataCenterName) },
          { label: '容器实例区域', value: dash(crm.containerInstanceRegion) },
          { label: '裸金属区域', value: dash(crm.bareMetalRegion) },
          { label: 'idc_code', value: dash(crm.idcCode) },
          { label: 'GPU', value: `${dash(crm.gpuCardTypeName)} × ${dash(crm.gpuCount)}` },
        ]}
      />
    </div>
  )
}

function ProbeDetailBody({ detail }: { detail: DevicePlatformProbeDetail & { compareRows: ProbeCompareRow[] } }) {
  const [changelogOpen, setChangelogOpen] = useState(false)
  const r = detail.row

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex flex-wrap items-center gap-2">
            <span className="font-mono">{r.sn}</span>
            <Badge variant={CONSISTENCY_FLAG_VARIANT[r.consistencyFlag]}>
              {CONSISTENCY_FLAG_LABELS[r.consistencyFlag]}
            </Badge>
            <Badge variant="outline">{PROBE_STATUS_LABELS[r.probeStatus]}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            快照 {formatSnapshotHourLabel(r.snapshotHour)} · {r.suggestedAction}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setChangelogOpen(true)}>
          <History className="size-4 mr-2" />
          设备变更记录
        </Button>
      </div>

      <div className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">关键字段横向比对</h2>
          <CompareSection rows={detail.compareRows} />
        </section>

        <Separator />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <CrmPanel detail={detail} />
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">平台 API 抓取原文</h2>
            <PlatformTabs detail={detail} />
          </section>
        </div>
      </div>

      <DevicePlatformProbeChangelogDialog
        open={changelogOpen}
        onOpenChange={setChangelogOpen}
        sn={r.sn}
        changeLogs={detail.changeLogs}
      />
    </>
  )
}

export function DevicePlatformProbeDetailContent({ probeId }: Props) {
  const { data: detail, isLoading, error } = trpc.supplier.devicePlatformProbe.getById.useQuery(
    { id: probeId },
    { retry: false },
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        加载中…
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Link href={devicePlatformProbeListPath()}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            返回列表
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? `未找到探测记录（ID: ${probeId}）`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href={devicePlatformProbeListPath()}>
        <Button variant="ghost" size="sm" className="-ml-2">
          <ArrowLeft className="size-4 mr-1" />
          平台存在状态
        </Button>
      </Link>
      <ProbeDetailBody detail={detail} />
    </div>
  )
}
