import type {
  Merchant,
  MerchantAccessMode,
  MerchantActivity,
  MerchantActivityAttachment,
  MerchantCardTypeRef,
  MerchantDatacenterRegion,
  MerchantListRow,
  MerchantPlatformDatacenter,
  MerchantRechargeAttachment,
  MerchantRechargeAuditLog,
  MerchantRechargeRecord,
  MerchantRegionCardType,
  MerchantRegionStatus,
  MerchantStatus,
  MerchantType,
} from '@/lib/types/merchant'
import type {
  merchant,
  merchantActivity,
  merchantActivityAttachment,
  merchantDatacenterRegion,
  merchantRechargeAttachment,
  merchantRechargeAuditLog,
  merchantRechargeRecord,
} from '@workspace/db/schema'

type MerchantRow = typeof merchant.$inferSelect
type ActivityRow = typeof merchantActivity.$inferSelect
type RechargeRow = typeof merchantRechargeRecord.$inferSelect
type AuditRow = typeof merchantRechargeAuditLog.$inferSelect

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined
  return value instanceof Date ? value.toISOString() : String(value)
}

function toDateString(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'number' ? value : Number(value)
}

export function mapMerchantRow(row: MerchantRow): Merchant {
  return {
    id: row.id,
    platformMerchantId: row.platformMerchantId,
    code: row.code,
    name: row.name,
    companyFullName: row.companyFullName,
    unifiedSocialCreditCode: row.unifiedSocialCreditCode,
    merchantMark: row.merchantMark ?? undefined,
    accessMode: row.accessMode as MerchantAccessMode,
    type: row.type as MerchantType,
    isDefault: row.isDefault,
    status: row.status as MerchantStatus,
    contactUser: row.contactUser ?? undefined,
    contactPhone: row.contactPhone ?? undefined,
    remark: row.remark ?? undefined,
    platformSyncedAt: toIso(row.platformSyncedAt),
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
  }
}

export function mapMerchantListRow(
  row: MerchantRow,
  stats: {
    tenantCount: number
    openRegionCount: number
    monthConsumption: number
    accountManagerStaffId?: string | null
    accountManagerName?: string | null
  },
): MerchantListRow {
  return {
    ...mapMerchantRow(row),
    tenantCount: stats.tenantCount,
    openRegionCount: stats.openRegionCount,
    monthConsumption: stats.monthConsumption,
    accountManagerStaffId: stats.accountManagerStaffId ?? null,
    accountManagerName: stats.accountManagerName ?? null,
  }
}

export function mapMerchantActivityRow(row: ActivityRow): MerchantActivity {
  return {
    id: row.id,
    merchantId: row.merchantId,
    type: row.type as MerchantActivity['type'],
    title: row.title,
    description: row.description ?? undefined,
    authorName: row.authorName,
    authorRole: row.authorRole as MerchantActivity['authorRole'],
    occurredAt: toIso(row.occurredAt)!,
  }
}

export function mapMerchantActivityAttachment(
  row: typeof merchantActivityAttachment.$inferSelect,
): MerchantActivityAttachment {
  return {
    id: row.id,
    name: row.fileName,
    size: row.fileSize ?? 0,
    url: `/api/merchant/attachments/${row.id}`,
    mimeType: row.mimeType ?? undefined,
  }
}

export function mapMerchantRechargeRow(
  row: RechargeRow,
  meta: { createdBy?: string; updatedBy?: string },
): MerchantRechargeRecord {
  return {
    id: row.id,
    merchantId: row.merchantId,
    amount: toNumber(row.amount),
    paymentMethod: row.paymentMethod,
    status: row.status as MerchantRechargeRecord['status'],
    transactionId: row.transactionId ?? undefined,
    rechargeDate: toDateString(row.rechargeDate),
    remark: row.remark ?? undefined,
    attachments: [],
    source: row.source as MerchantRechargeRecord['source'],
    createdBy: meta.createdBy,
    updatedBy: meta.updatedBy,
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
    completedAt: toIso(row.completedAt),
  }
}

export function mapMerchantRechargeAttachment(
  row: typeof merchantRechargeAttachment.$inferSelect,
): MerchantRechargeAttachment {
  return {
    id: row.id,
    name: row.fileName,
    mimeType: row.mimeType,
    size: row.fileSize,
    dataUrl: `/api/merchant/attachments/${row.id}`,
  }
}

export function mapMerchantRechargeAuditRow(row: AuditRow): MerchantRechargeAuditLog {
  return {
    id: row.id,
    rechargeId: row.rechargeId,
    merchantId: row.merchantId,
    action: row.action as MerchantRechargeAuditLog['action'],
    operatorName: row.operatorName,
    occurredAt: toIso(row.occurredAt)!,
    changes: (row.changes as MerchantRechargeAuditLog['changes']) ?? undefined,
    remark: row.remark ?? undefined,
  }
}

export function mapMerchantPlatformDatacenter(row: {
  id: string
  name: string
  code: string
  location: string
  regionCode: string
  status: MerchantPlatformDatacenter['status']
}): MerchantPlatformDatacenter {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    location: row.location,
    regionCode: row.regionCode,
    status: row.status,
  }
}

export function mapMerchantDatacenterRegionRow(
  row: typeof merchantDatacenterRegion.$inferSelect,
  meta: {
    dataCenterName: string
    location: string
    enabledCardTypes: MerchantCardTypeRef[]
    availableCardTypes?: MerchantRegionCardType[]
    usedGpuCount: number
  },
): MerchantDatacenterRegion {
  const quota =
    row.availableGpuQuota === -1 ? null : row.availableGpuQuota
  const availableCardTypes =
    meta.availableCardTypes ??
    meta.enabledCardTypes.map((card) => ({ ...card, enabled: true }))

  return {
    id: row.id,
    merchantId: row.merchantId,
    dataCenterId: row.dataCenterId,
    dataCenterName: meta.dataCenterName,
    displayName: row.displayName ?? undefined,
    regionCode: row.regionCode,
    location: meta.location,
    status: row.status as MerchantRegionStatus,
    availableGpuQuota: quota,
    usedGpuCount: meta.usedGpuCount,
    enabledCardTypeIds: meta.enabledCardTypes.map((c) => c.id),
    enabledCardTypes: meta.enabledCardTypes,
    availableCardTypes,
    effectiveFrom: toDateString(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? toDateString(row.effectiveTo) : null,
  }
}
