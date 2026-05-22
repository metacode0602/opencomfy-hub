import "server-only"

import { z } from "zod"
import type { CooperationMode, DataCenter, Supplier, SupplierOnboardingType } from "@/lib/data/types"
import type { DatacenterImportParsedRow } from "@/lib/types/datacenter-import"
import type { SupplierImportParsedRow } from "@/lib/types/supplier-import"
import {
  buildRegionTags,
  deriveLocation,
  mapDatacenterAuditStatus,
} from "@/lib/supplier/datacenter-import-utils"
import {
  isHttpUrl,
  mapCooperationMode,
  normalizePlatformTenantId,
  resolveExternalTenantId,
} from "@/lib/supplier/supplier-import-utils"
import { crmError, crmLog, crmWarn } from "@/lib/server/dataaccess/crm/logger"
import type { dataCenter, supplier } from "@workspace/db/schema"

import supplyInstance from "./supply-request"

const BATCH_PAGE_SIZE = 100

/** 算算力 Supply OpenAPI — 供应商入驻申请单条记录 */
export type SupplierApplicationApiRecord = {
  id: number
  merchant_id?: number
  tenant_id?: number
  type?: string | null
  name?: string | null
  credential_code?: string | null
  business_scope?: string | null
  address?: string | null
  contact_person?: string | null
  contact_phone?: string | null
  business_license_url?: string | null
  id_card_front_url?: string | null
  id_card_back_url?: string | null
  bank_name?: string | null
  account_bank_name?: string | null
  bank_account?: string | null
  account_bank_address?: string | null
  admin_phone?: string | null
  admin_email?: string | null
  device_info?: string | null
  audit_status?: string | null
  audit_remark?: string | null
  is_sure?: boolean
  create_time?: string | null
  last_update_time?: string | null
  split_mode?: string | null
  direct_config_type?: string | null
  uniform_percentage?: number | null
  card_type_percentages?: unknown
  rate_card_tiers?: unknown
  hourly_card_prices?: unknown
  bc_create_time?: string | null
}

export type SupplierApplicationListParams = {
  name?: string
  types?: string
  status?: string
  split_modes?: string
  start_time?: string
  end_time?: string
  /** 批量入驻 ID，半角逗号分隔（待平台确认参数名） */
  application_ids?: string
  page?: number
  page_size?: number
}

export type SupplierApplicationListData = {
  count?: number
  results?: SupplierApplicationApiRecord[]
}

/** 映射后可直接写入 `supplier` 表的字段（不含 id/code/shortName/businessManagerStaffId） */
export type SupplierApplicationDbFields = Omit<
  typeof supplier.$inferInsert,
  "id" | "code" | "shortName" | "businessManagerStaffId"
>

/** 算算力 Supply OpenAPI — 机房信息单条记录 */
export type IdcInfoApiRecord = {
  id: number
  merchant_id?: number
  tenant_id?: number
  zone_id?: number
  zone_name?: string | null
  name?: string | null
  container_instance_region?: string | null
  description?: string | null
  scale?: string | null
  pub_ip_count?: number | null
  inner_network_segment?: string | null
  audit_status?: string | null
  audit_remark?: string | null
  specify_billing_device?: boolean
  specify_billing_device_ids?: unknown
  specify_billing_device_k8s_names?: unknown
  specify_billing_device_node_names?: unknown
  is_delete?: boolean
  create_time?: string | null
  last_update_time?: string | null
}

export type IdcInfoListParams = {
  name?: string
  container_instance_region?: string
  zone_ids?: string
  status?: string
  start_time?: string
  end_time?: string
  /** 批量机房 ID，半角逗号分隔（待平台确认参数名） */
  idc_ids?: string
  /** 批量租户 ID，半角逗号分隔 */
  tenant_tids?: string
  page?: number
  page_size?: number
}

export type IdcInfoListData = {
  count?: number
  results?: IdcInfoApiRecord[]
}

/** 映射后可直接写入 `data_center` 表的字段（不含 id/supplierId/code） */
export type IdcInfoDbFields = Omit<
  typeof dataCenter.$inferInsert,
  "id" | "supplierId" | "code"
>

const supplierApplicationRecordSchema = z.object({
  id: z.number(),
  merchant_id: z.number().optional(),
  tenant_id: z.number().optional(),
  type: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  credential_code: z.string().nullable().optional(),
  business_scope: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  contact_person: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  business_license_url: z.string().nullable().optional(),
  id_card_front_url: z.string().nullable().optional(),
  id_card_back_url: z.string().nullable().optional(),
  bank_name: z.string().nullable().optional(),
  account_bank_name: z.string().nullable().optional(),
  bank_account: z.string().nullable().optional(),
  account_bank_address: z.string().nullable().optional(),
  admin_phone: z.string().nullable().optional(),
  admin_email: z.string().nullable().optional(),
  device_info: z.string().nullable().optional(),
  audit_status: z.string().nullable().optional(),
  audit_remark: z.string().nullable().optional(),
  is_sure: z.boolean().optional(),
  create_time: z.string().nullable().optional(),
  last_update_time: z.string().nullable().optional(),
  split_mode: z.string().nullable().optional(),
})

const supplierApplicationListDataSchema = z.object({
  results: z.array(supplierApplicationRecordSchema).optional(),
  count: z.number().optional(),
})

const idcInfoRecordSchema = z.object({
  id: z.number(),
  merchant_id: z.number().optional(),
  tenant_id: z.number().optional(),
  zone_id: z.number().optional(),
  zone_name: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  container_instance_region: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  scale: z.string().nullable().optional(),
  pub_ip_count: z.number().nullable().optional(),
  inner_network_segment: z.string().nullable().optional(),
  audit_status: z.string().nullable().optional(),
  audit_remark: z.string().nullable().optional(),
  specify_billing_device: z.boolean().optional(),
  is_delete: z.boolean().optional(),
  create_time: z.string().nullable().optional(),
  last_update_time: z.string().nullable().optional(),
})

const idcInfoListDataSchema = z.object({
  results: z.array(idcInfoRecordSchema).optional(),
  count: z.number().optional(),
})

export class SuanliSupplyOpenApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = "SuanliSupplyOpenApiError"
  }
}

function parsePlatformDate(value?: string | null): Date | undefined {
  if (!value) return undefined
  const d = new Date(value.replace(/\//g, "-"))
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** 平台入驻类型 → CRM onboarding_type */
export function mapPlatformOnboardingType(raw?: string | null): SupplierOnboardingType | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase()
  if (["personal", "individual", "个人", "自然人"].some((k) => s === k || s.includes(k))) {
    return "individual"
  }
  if (["enterprise", "company", "企业", "公司"].some((k) => s === k || s.includes(k))) {
    return "enterprise"
  }
  return null
}

/** 平台 split_mode → default_cooperation_mode */
export function mapPlatformSplitMode(raw?: string | null): {
  mode: CooperationMode
  warning?: string
} {
  if (!raw) return { mode: "card_time" }
  const s = raw.trim().toLowerCase()
  if (
    ["revenue", "share", "分成", "revenue_share", "profit"].some((k) => s.includes(k))
  ) {
    return { mode: "revenue_share" }
  }
  if (["card", "hourly", "uniform", "卡时", "card_time"].some((k) => s.includes(k))) {
    return { mode: "card_time" }
  }
  return mapCooperationMode(raw)
}

/** 平台 audit_status（如 Waiting）→ CRM audit_status + status */
export function mapPlatformAuditStatus(raw?: string | null): {
  audit_status: string
  status: Supplier["status"]
  warning?: string
} {
  if (!raw) {
    return { audit_status: "pending", status: "negotiating", warning: "审核状态为空" }
  }
  const s = raw.trim()
  const lower = s.toLowerCase()

  if (["waiting", "pending", "待审核", "审核中"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "pending", status: "negotiating" }
  }
  if (["approved", "pass", "passed", "已通过", "审核通过"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "approved", status: "cooperating" }
  }
  if (["rejected", "reject", "fail", "failed", "已驳回"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "rejected", status: "negotiating" }
  }
  if (["suspended", "已暂停"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "suspended", status: "suspended" }
  }
  if (["terminated", "closed", "已终止", "已注销"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "terminated", status: "terminated" }
  }

  return {
    audit_status: s,
    status: "negotiating",
    warning: `无法识别审核状态「${raw}」`,
  }
}

/** 平台机房 audit_status（如 Pass）→ CRM audit_status + data_center.status */
export function mapPlatformIdcAuditStatus(raw?: string | null): {
  audit_status: string
  status: DataCenter["status"]
  warning?: string
} {
  if (!raw) {
    return { audit_status: "pending", status: "offline", warning: "审核状态为空" }
  }
  const s = raw.trim()
  const lower = s.toLowerCase()

  if (["waiting", "pending", "待审核", "审核中"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "pending", status: "offline" }
  }
  if (["approved", "pass", "passed", "已通过", "审核通过"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "approved", status: "online" }
  }
  if (["rejected", "reject", "fail", "failed", "已驳回"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "rejected", status: "offline" }
  }
  if (["suspended", "已暂停"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "suspended", status: "maintenance" }
  }
  if (["terminated", "closed", "已终止"].some((k) => lower === k || s.includes(k))) {
    return { audit_status: "terminated", status: "offline" }
  }

  return mapDatacenterAuditStatus(raw)
}

function buildIdcRegionTags(record: IdcInfoApiRecord, row: DatacenterImportParsedRow): string[] {
  const tags = buildRegionTags(row)
  const zoneName = record.zone_name?.trim()
  if (zoneName && !tags.includes(zoneName)) {
    tags.unshift(zoneName)
  }
  return tags
}

function collectIdcFieldWarnings(record: IdcInfoApiRecord): string[] {
  const warnings: string[] = []
  const cidr = record.inner_network_segment?.trim()
  if (cidr && !/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(cidr)) {
    warnings.push("内网网段格式可疑")
  }
  if (record.pub_ip_count != null && record.pub_ip_count < 0) {
    warnings.push("公网 IP 数量须为非负整数")
  }
  return warnings
}

/** 平台机房 → 与 Excel 导入一致的解析行 */
export function mapIdcInfoToImportRow(
  record: IdcInfoApiRecord,
  rowNo: number,
): DatacenterImportParsedRow {
  const auditMapped = mapPlatformIdcAuditStatus(record.audit_status)
  const field_warnings = collectIdcFieldWarnings(record)
  if (auditMapped.warning) field_warnings.push(auditMapped.warning)

  return {
    row_no: rowNo,
    external_onboarding_id: String(record.id),
    platform_tenant_id:
      record.tenant_id != null && record.tenant_id > 0 ? String(record.tenant_id) : undefined,
    name: record.name?.trim() || undefined,
    container_instance_region: record.container_instance_region ?? undefined,
    description: record.description ?? undefined,
    scale: record.scale ?? undefined,
    public_ip_count: record.pub_ip_count ?? undefined,
    internal_network_cidr: record.inner_network_segment ?? undefined,
    audit_status_raw: record.audit_status ?? undefined,
    audit_status: auditMapped.audit_status,
    audit_remark: record.audit_remark ?? undefined,
    source_deleted: record.is_delete ?? false,
    status: auditMapped.status,
    source_created_at: parsePlatformDate(record.create_time)?.toISOString(),
    source_updated_at: parsePlatformDate(record.last_update_time)?.toISOString(),
    field_warnings,
  }
}

/** 平台机房 → `data_center` 表写入字段（需调用方补充 supplierId、code） */
export function mapIdcInfoToDbFields(record: IdcInfoApiRecord): IdcInfoDbFields {
  const row = mapIdcInfoToImportRow(record, 0)
  const updatedAt = parsePlatformDate(record.last_update_time) ?? new Date()
  const location = record.zone_name?.trim() || deriveLocation(row) || null

  return {
    name: row.name!,
    location: location || null,
    address: null,
    regionTags: buildIdcRegionTags(record, row),
    status: row.status ?? "offline",
    networkFeeMonthly: "0",
    mgmtNodeFeeMonthly: "0",
    externalOnboardingId: row.external_onboarding_id ?? null,
    platformTenantId: normalizePlatformTenantId(row.platform_tenant_id) ?? null,
    containerInstanceRegion: row.container_instance_region ?? null,
    bareMetalRegion: row.bare_metal_region ?? null,
    description: row.description ?? null,
    scale: row.scale ?? null,
    publicIpCount: row.public_ip_count ?? null,
    internalNetworkCidr: row.internal_network_cidr ?? null,
    auditStatus: row.audit_status ?? null,
    auditRemark: row.audit_remark ?? null,
    sourceDeleted: row.source_deleted ?? false,
    updatedAt,
  }
}

function collectUriWarnings(
  record: SupplierApplicationApiRecord,
  onboardingType: SupplierOnboardingType | null,
): string[] {
  const warnings: string[] = []
  if (onboardingType === "enterprise" && record.business_license_url && !isHttpUrl(record.business_license_url)) {
    warnings.push("营业执照非 URL")
  }
  if (record.id_card_front_url && !isHttpUrl(record.id_card_front_url)) {
    warnings.push("身份证正面非 URL")
  }
  if (record.id_card_back_url && !isHttpUrl(record.id_card_back_url)) {
    warnings.push("身份证反面非 URL")
  }
  if (!record.admin_email?.trim()) {
    warnings.push("管理员邮箱为空")
  }
  return warnings
}

/** 平台入驻申请 → 与 Excel 导入一致的解析行（可接 buildSupplierImportPreview） */
export function mapSupplierApplicationToImportRow(
  record: SupplierApplicationApiRecord,
  rowNo: number,
): SupplierImportParsedRow {
  const onboarding_type = mapPlatformOnboardingType(record.type)
  const auditMapped = mapPlatformAuditStatus(record.audit_status)
  const coop = mapPlatformSplitMode(record.split_mode)
  const field_warnings = collectUriWarnings(record, onboarding_type)

  if (auditMapped.warning) field_warnings.push(auditMapped.warning)
  if (coop.warning) field_warnings.push(coop.warning)
  if (!onboarding_type) field_warnings.push("入驻类型无法识别")

  return {
    row_no: rowNo,
    external_onboarding_id: String(record.id),
    platform_tenant_id:
      record.tenant_id != null && record.tenant_id > 0 ? String(record.tenant_id) : undefined,
    onboarding_type: onboarding_type ?? undefined,
    name: record.name?.trim() || undefined,
    identity_no: record.credential_code?.trim() || undefined,
    business_scope: record.business_scope ?? undefined,
    address: record.address ?? undefined,
    contact_person: record.contact_person ?? undefined,
    contact_phone: record.contact_phone ?? undefined,
    business_license_uri:
      onboarding_type === "enterprise" ? (record.business_license_url ?? undefined) : undefined,
    id_card_front_uri: record.id_card_front_url ?? undefined,
    id_card_back_uri: record.id_card_back_url ?? undefined,
    bank_name: record.bank_name ?? undefined,
    bank_branch_name: record.account_bank_name ?? undefined,
    bank_account: record.bank_account ?? undefined,
    bank_branch_address: record.account_bank_address ?? undefined,
    admin_phone: record.admin_phone ?? undefined,
    admin_email: record.admin_email ?? undefined,
    device_info_raw: record.device_info ?? undefined,
    audit_status_raw: record.audit_status ?? undefined,
    audit_status: auditMapped.audit_status,
    audit_confirmed: record.is_sure ?? false,
    audit_remark: record.audit_remark ?? undefined,
    cooperation_mode: coop.mode,
    status: auditMapped.status,
    source_created_at: parsePlatformDate(record.create_time)?.toISOString(),
    source_updated_at: parsePlatformDate(record.last_update_time)?.toISOString(),
    field_warnings,
    originalCells: [],
  }
}

/** 平台入驻申请 → `supplier` 表写入字段 */
export function mapSupplierApplicationToDbFields(
  record: SupplierApplicationApiRecord,
): SupplierApplicationDbFields {
  const row = mapSupplierApplicationToImportRow(record, 0)
  const updatedAt = parsePlatformDate(record.last_update_time) ?? new Date()

  return {
    name: row.name!,
    contactPerson: row.contact_person?.trim() || null,
    contactPhone: row.contact_phone?.trim() || null,
    contactEmail: row.admin_email?.trim() || null,
    address: row.address?.trim() || null,
    bankName: row.bank_name ?? null,
    bankAccount: row.bank_account ?? null,
    defaultCooperationMode: row.cooperation_mode ?? "card_time",
    status: row.status ?? "negotiating",
    externalOnboardingId: row.external_onboarding_id ?? null,
    externalTenantId: resolveExternalTenantId(row),
    platformTenantId: normalizePlatformTenantId(row.platform_tenant_id) ?? null,
    onboardingType: row.onboarding_type ?? null,
    identityNo: row.identity_no ?? null,
    businessScope: row.business_scope ?? null,
    businessLicenseUri: row.business_license_uri ?? null,
    idCardFrontUri: row.id_card_front_uri ?? null,
    idCardBackUri: row.id_card_back_uri ?? null,
    bankBranchName: row.bank_branch_name ?? null,
    bankBranchAddress: row.bank_branch_address ?? null,
    adminPhone: row.admin_phone ?? null,
    adminEmail: row.admin_email ?? null,
    deviceInfoRaw: row.device_info_raw ?? null,
    auditStatus: row.audit_status ?? null,
    auditConfirmed: row.audit_confirmed ?? false,
    auditRemark: row.audit_remark ?? null,
    updatedAt,
  }
}

/** 供应商入驻申请列表（单页） */
export async function fetchSupplierApplicationList(
  params: SupplierApplicationListParams = {},
  traceId?: string,
): Promise<SupplierApplicationListData> {
  const tid = traceId ?? crypto.randomUUID().slice(0, 8)

  crmLog("suanli-supply-api", "request supplier_application list", {
    traceId: tid,
    page: params.page ?? 1,
    page_size: params.page_size ?? BATCH_PAGE_SIZE,
  })

  try {
    const name = params.name?.trim() ?? ""
    const data = await supplyInstance.get<unknown>("/supply/supplier_application/list", {
      params: {
        name: name ? encodeURIComponent(name) : "",
        types: params.types ?? "",
        status: "Pass", //只抓取审核通过的数据
        split_modes: params.split_modes ?? "",
        start_time: params.start_time ?? "",
        end_time: params.end_time ?? "",
        tenant_tids: params.application_ids ?? "",
        page: params.page ?? 1,
        page_size: params.page_size ?? BATCH_PAGE_SIZE,
      },
    })

    const parsed = supplierApplicationListDataSchema.safeParse(data)
    if (!parsed.success) {
      crmWarn("suanli-supply-api", "response schema mismatch", {
        traceId: tid,
        issues: parsed.error.issues.slice(0, 3),
      })
      throw new SuanliSupplyOpenApiError("平台返回数据格式异常")
    }

    crmLog("suanli-supply-api", "supplier_application list ok", {
      traceId: tid,
      count: parsed.data.count,
      returned: parsed.data.results?.length ?? 0,
    })

    return parsed.data
  } catch (e) {
    if (e instanceof SuanliSupplyOpenApiError) throw e
    crmError("suanli-supply-api", "fetch failed", e, { traceId: tid })
    throw new SuanliSupplyOpenApiError(e instanceof Error ? e.message : "连接算算力供应商 OpenAPI 失败")
  }
}

/** 拉取全部入驻申请（自动翻页） */
export async function fetchAllSupplierApplications(
  params: Omit<SupplierApplicationListParams, "page" | "page_size"> = {},
): Promise<SupplierApplicationApiRecord[]> {
  const traceId = crypto.randomUUID().slice(0, 8)
  const pageSize = BATCH_PAGE_SIZE
  const all: SupplierApplicationApiRecord[] = []
  let page = 1
  let total = Infinity

  while (all.length < total) {
    const data = await fetchSupplierApplicationList(
      { ...params, page, page_size: pageSize },
      traceId,
    )
    const batch = data.results ?? []
    total = data.count ?? all.length + batch.length
    all.push(...batch)
    if (batch.length < pageSize) break
    page++
  }

  return all
}

/** 批量映射为 `supplier` 表字段 */
export function mapSupplierApplicationsToDbFields(
  records: SupplierApplicationApiRecord[],
): SupplierApplicationDbFields[] {
  return records
    .filter((r) => r.name?.trim())
    .map((r) => mapSupplierApplicationToDbFields(r))
}

/** 批量映射为导入解析行 */
export function mapSupplierApplicationsToImportRows(
  records: SupplierApplicationApiRecord[],
): SupplierImportParsedRow[] {
  return records
    .filter((r) => r.name?.trim())
    .map((r, i) => mapSupplierApplicationToImportRow(r, i + 1))
}

/** 机房列表（单页） */
export async function fetchIdcInfoList(
  params: IdcInfoListParams = {},
  traceId?: string,
): Promise<IdcInfoListData> {
  const tid = traceId ?? crypto.randomUUID().slice(0, 8)

  crmLog("suanli-supply-api", "request idc_info list", {
    traceId: tid,
    page: params.page ?? 1,
    page_size: params.page_size ?? BATCH_PAGE_SIZE,
  })

  try {
    const name = params.name?.trim() ?? ""
    const data = await supplyInstance.get<unknown>("/supply/idc_info/list", {
      params: {
        name: name ? encodeURIComponent(name) : "",
        container_instance_region: params.container_instance_region ?? "",
        zone_ids: params.zone_ids ?? "",
        status: params.status ?? "",
        start_time: params.start_time ?? "",
        end_time: params.end_time ?? "",
        idc_ids: params.idc_ids ?? "",
        tenant_tids: params.tenant_tids ?? "",
        page: params.page ?? 1,
        page_size: params.page_size ?? BATCH_PAGE_SIZE,
      },
    })

    const parsed = idcInfoListDataSchema.safeParse(data)
    if (!parsed.success) {
      crmWarn("suanli-supply-api", "idc_info response schema mismatch", {
        traceId: tid,
        issues: parsed.error.issues.slice(0, 3),
      })
      throw new SuanliSupplyOpenApiError("平台返回数据格式异常")
    }

    crmLog("suanli-supply-api", "idc_info list ok", {
      traceId: tid,
      count: parsed.data.count,
      returned: parsed.data.results?.length ?? 0,
    })

    return parsed.data
  } catch (e) {
    if (e instanceof SuanliSupplyOpenApiError) throw e
    crmError("suanli-supply-api", "idc_info fetch failed", e, { traceId: tid })
    throw new SuanliSupplyOpenApiError(e instanceof Error ? e.message : "连接算算力供应商 OpenAPI 失败")
  }
}

/** 拉取全部机房（自动翻页） */
export async function fetchAllIdcInfos(
  params: Omit<IdcInfoListParams, "page" | "page_size"> = {},
): Promise<IdcInfoApiRecord[]> {
  const traceId = crypto.randomUUID().slice(0, 8)
  const pageSize = BATCH_PAGE_SIZE
  const all: IdcInfoApiRecord[] = []
  let page = 1
  let total = Infinity

  while (all.length < total) {
    const data = await fetchIdcInfoList({ ...params, page, page_size: pageSize }, traceId)
    const batch = data.results ?? []
    total = data.count ?? all.length + batch.length
    all.push(...batch)
    if (batch.length < pageSize) break
    page++
  }

  return all
}

/** 批量映射为 `data_center` 表字段 */
export function mapIdcInfosToDbFields(records: IdcInfoApiRecord[]): IdcInfoDbFields[] {
  return records.filter((r) => r.name?.trim()).map((r) => mapIdcInfoToDbFields(r))
}

/** 批量映射为机房导入解析行 */
export function mapIdcInfosToImportRows(records: IdcInfoApiRecord[]): DatacenterImportParsedRow[] {
  return records.filter((r) => r.name?.trim()).map((r, i) => mapIdcInfoToImportRow(r, i + 1))
}

function indexRecordsById<T extends { id: number }>(
  records: T[],
  idSet: Set<string>,
): Map<string, T> {
  const map = new Map<string, T>()
  for (const record of records) {
    const key = String(record.id)
    if (idSet.has(key)) {
      map.set(key, record)
    }
  }
  return map
}

/** 按入驻 ID 批量拉取供应商申请（优先 batch 参数，结果按 id 过滤） */
export async function fetchSupplierApplicationsByIds(
  ids: string[],
  traceId?: string,
): Promise<Map<string, SupplierApplicationApiRecord>> {
  if (ids.length === 0) return new Map()

  const tid = traceId ?? crypto.randomUUID().slice(0, 8)
  const idSet = new Set(ids)
  const pageSize = Math.max(BATCH_PAGE_SIZE, ids.length)

  crmLog("suanli-supply-api", "fetch supplier applications by ids", {
    traceId: tid,
    count: ids.length,
  })

  const data = await fetchSupplierApplicationList(
    {
      application_ids: ids.join(","),
      page: 1,
      page_size: pageSize,
    },
    tid,
  )

  const map = indexRecordsById(data.results ?? [], idSet)

  if (map.size < ids.length) {
    crmWarn("suanli-supply-api", "supplier batch fetch partial", {
      traceId: tid,
      requested: ids.length,
      returned: map.size,
      missing: ids.filter((id) => !map.has(id)),
    })
  } else {
    crmLog("suanli-supply-api", "supplier batch fetch ok", {
      traceId: tid,
      returned: map.size,
    })
  }

  return map
}

/** 按机房 ID 批量拉取机房信息（优先 batch 参数，结果按 id 过滤） */
export async function fetchIdcInfosByIds(
  ids: string[],
  traceId?: string,
): Promise<Map<string, IdcInfoApiRecord>> {
  if (ids.length === 0) return new Map()

  const tid = traceId ?? crypto.randomUUID().slice(0, 8)
  const idSet = new Set(ids)
  const pageSize = Math.max(BATCH_PAGE_SIZE, ids.length)

  crmLog("suanli-supply-api", "fetch idc infos by ids", {
    traceId: tid,
    count: ids.length,
  })

  const data = await fetchIdcInfoList(
    {
      idc_ids: ids.join(","),
      page: 1,
      page_size: pageSize,
    },
    tid,
  )

  const map = indexRecordsById(data.results ?? [], idSet)

  if (map.size < ids.length) {
    crmWarn("suanli-supply-api", "idc batch fetch partial", {
      traceId: tid,
      requested: ids.length,
      returned: map.size,
      missing: ids.filter((id) => !map.has(id)),
    })
  } else {
    crmLog("suanli-supply-api", "idc batch fetch ok", {
      traceId: tid,
      returned: map.size,
    })
  }

  return map
}
