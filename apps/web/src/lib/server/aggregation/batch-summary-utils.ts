import { onboardingBatchDetailPath } from '@/lib/supplier/onboarding-batch-utils'
import type { OnboardingBatchSummaryDto } from '@/lib/types/supplier-overview-api'

export const ACTIVE_BUSINESS_BATCH_KINDS = [
  'online',
  'order_access',
  'device_retire',
  'internal_occupancy',
] as const

export type ActiveBusinessBatchKind = (typeof ACTIVE_BUSINESS_BATCH_KINDS)[number]

export type ActiveBatchRow = {
  id: string
  batchCode: string
  batchKind: string
  supplierId: string
  supplierShortName: string | null
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  importStatus: string
  batchStatus: string
  onlineReason: string | null
  plannedDeviceCount: number
  plannedLinesJson: unknown
  touchedDeviceCount: number | null
  onlineDeviceCount: number | null
  retiredDeviceCount: number | null
  plannedReadyAt: Date | null
  workOrderNo: string | null
  idcRegion: string | null
}

export function computeBatchProgressMetrics(batch: {
  batchKind: string
  plannedDeviceCount: number
  touchedDeviceCount: number | null
  onlineDeviceCount: number | null
  retiredDeviceCount: number | null
}): {
  progressDoneCount: number
  progressGap: number
  progressMidLabel: string
  progressDoneLabel: string
  gapDoneLabel: string
} {
  const planned = batch.plannedDeviceCount ?? 0
  const touched = batch.touchedDeviceCount ?? 0
  const online = batch.onlineDeviceCount ?? 0
  const retired = batch.retiredDeviceCount ?? 0

  switch (batch.batchKind) {
    case 'device_retire':
      return {
        progressDoneCount: retired,
        progressGap: Math.max(0, planned - retired),
        progressMidLabel: '挂接',
        progressDoneLabel: '已退订',
        gapDoneLabel: '已退订',
      }
    case 'internal_occupancy':
      return {
        progressDoneCount: touched,
        progressGap: Math.max(0, planned - touched),
        progressMidLabel: '—',
        progressDoneLabel: '已挂接',
        gapDoneLabel: '已挂接',
      }
    default:
      return {
        progressDoneCount: online,
        progressGap: Math.max(0, planned - online),
        progressMidLabel: '接收',
        progressDoneLabel: '在线',
        gapDoneLabel: '在线',
      }
  }
}

export function resolveBatchDetailHref(batch: { id: string; batchKind: string }): string {
  return onboardingBatchDetailPath({
    id: batch.id,
    batchKind: batch.batchKind as 'online' | 'order_access' | 'device_retire' | 'internal_occupancy',
  })
}

export function buildBatchSummary(batch: ActiveBatchRow): OnboardingBatchSummaryDto {
  const touched = batch.touchedDeviceCount ?? 0
  const online = batch.onlineDeviceCount ?? 0
  const retired = batch.retiredDeviceCount ?? 0
  const metrics = computeBatchProgressMetrics(batch)

  return {
    id: batch.id,
    batchCode: batch.batchCode,
    batchKind: batch.batchKind,
    supplierName: batch.supplierShortName ?? batch.supplierName,
    dataCenterName: batch.dataCenterName,
    importStatus: batch.importStatus,
    batchStatus: batch.batchStatus,
    plannedDeviceCount: batch.plannedDeviceCount,
    touchedDeviceCount: touched,
    onlineDeviceCount:
      batch.batchKind === 'internal_occupancy'
        ? touched
        : batch.batchKind === 'device_retire'
          ? retired
          : online,
    retiredDeviceCount: retired,
    progressDoneCount: metrics.progressDoneCount,
    progressGap: metrics.progressGap,
    progressMidLabel: metrics.progressMidLabel,
    progressDoneLabel: metrics.progressDoneLabel,
    gapDoneLabel: metrics.gapDoneLabel,
    plannedReadyAt: batch.plannedReadyAt?.toISOString() ?? null,
    workOrderNo: batch.workOrderNo,
    detailHref: resolveBatchDetailHref(batch),
  }
}

export function batchTodoTitle(batchKind: string, supplierName: string, dataCenterName: string): string {
  switch (batchKind) {
    case 'device_retire':
      return `下架缺口 · ${supplierName} / ${dataCenterName}`
    case 'internal_occupancy':
      return `占用未挂接 · ${supplierName} / ${dataCenterName}`
    default:
      return `接入缺口 · ${supplierName} / ${dataCenterName}`
  }
}
