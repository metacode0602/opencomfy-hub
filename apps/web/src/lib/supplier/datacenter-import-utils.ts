import type { DataCenter, Supplier } from '@/lib/data/types'
import type {
  DatacenterImportCommitResult,
  DatacenterImportParsedRow,
  DatacenterImportPreviewMode,
  DatacenterImportPreviewResult,
  DatacenterImportPreviewRow,
} from '@/lib/types/datacenter-import'
import { normalizePlatformTenantId } from '@/lib/supplier/supplier-import-utils'

export function normalizeHeaderKey(h: string): string {
  return h.trim().replace(/\s+/g, '').toLowerCase()
}

export function normalizeDatacenterName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function parseImportDate(
  row: Record<string, unknown>,
  canonical: string,
): string | null {
  const norm = normalizeHeaderKey(canonical)
  for (const [key, value] of Object.entries(row)) {
    if (normalizeHeaderKey(key) !== norm) continue
    if (value == null || value === '') return null
    if (value instanceof Date) return value.toISOString().slice(0, 10)
    const s = String(value).trim()
    const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
    if (m) {
      const [, y, mo, d] = m
      return `${y}-${mo!.padStart(2, '0')}-${d!.padStart(2, '0')}`
    }
    return s
  }
  return null
}

export function parseDatacenterDeleted(raw: string | null): boolean {
  if (!raw) return false
  const s = raw.trim().toLowerCase()
  return s === '是' || s === 'true' || s === '1' || s === 'yes' || s === 'y'
}

export function parsePublicIpCount(raw: string | null): {
  value?: number
  error?: string
  warning?: string
} {
  if (!raw) return {}
  const s = raw.trim()
  if (!/^\d+$/.test(s)) {
    return { error: '公网 IP 数量须为非负整数' }
  }
  const n = Number(s)
  if (n < 0) return { error: '公网 IP 数量须为非负整数' }
  return { value: n }
}

export function mapDatacenterAuditStatus(raw: string | null): {
  audit_status: string
  status: DataCenter['status']
  warning?: string
} {
  if (!raw) {
    return { audit_status: 'pending', status: 'offline', warning: '审核状态为空' }
  }
  const s = raw.trim()
  if (['已通过', '审核通过', 'approved'].some((k) => s.includes(k))) {
    return { audit_status: 'approved', status: 'online' }
  }
  if (['待审核', '审核中', 'pending'].some((k) => s.includes(k))) {
    return { audit_status: 'pending', status: 'offline' }
  }
  if (['已驳回', 'rejected'].some((k) => s.includes(k))) {
    return { audit_status: 'rejected', status: 'offline' }
  }
  if (s.includes('已暂停') || s.includes('suspended')) {
    return { audit_status: 'suspended', status: 'maintenance' }
  }
  if (['已终止', 'terminated'].some((k) => s.includes(k))) {
    return { audit_status: 'terminated', status: 'offline' }
  }
  return {
    audit_status: s,
    status: 'offline',
    warning: `无法识别审核状态「${raw}」`,
  }
}

function slugFromName(name: string): string {
  const ascii = name
    .trim()
    .replace(/[\s/\\]+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .slice(0, 24)
  return ascii || 'DC'
}

export function deriveDatacenterCode(
  row: DatacenterImportParsedRow,
  existingCodes: Set<string>,
): string {
  let candidate: string
  if (row.external_onboarding_id) {
    candidate = `DC-${row.external_onboarding_id}`
  } else {
    candidate = `DC-${slugFromName(row.name!)}`
  }
  let code = candidate
  let n = 2
  while (existingCodes.has(code)) {
    code = `${candidate}-${n}`
    n++
  }
  return code
}

export function buildRegionTags(row: DatacenterImportParsedRow): string[] {
  const tags: string[] = []
  if (row.container_instance_region) tags.push(row.container_instance_region)
  if (row.bare_metal_region && row.bare_metal_region !== row.container_instance_region) {
    tags.push(row.bare_metal_region)
  }
  return tags
}

export function deriveLocation(row: DatacenterImportParsedRow): string {
  return row.bare_metal_region ?? row.container_instance_region ?? ''
}

function findMatchingDatacenter(
  row: DatacenterImportParsedRow,
  dataCenters: DataCenter[],
): DataCenter | undefined {
  const normName = normalizeDatacenterName(row.name!)
  const byName = dataCenters.find((dc) => normalizeDatacenterName(dc.name) === normName)
  if (byName) return byName

  if (row.external_onboarding_id) {
    const byExternal = dataCenters.find(
      (dc) => dc.externalOnboardingId === row.external_onboarding_id,
    )
    if (byExternal) return byExternal
  }

  return undefined
}

function wouldCodeCollide(
  row: DatacenterImportParsedRow,
  dataCenters: DataCenter[],
  existingCodes: Set<string>,
): boolean {
  const probe = new Set(existingCodes)
  const code = deriveDatacenterCode(row, probe)
  return dataCenters.some((dc) => dc.code === code)
}

export type DatacenterImportPreviewContext =
  | {
      mode: 'fixed'
      supplierId: string
      supplier: Supplier
      existingDataCenters: DataCenter[]
    }
  | {
      mode: 'auto'
      suppliersByTenantId: Map<string, Supplier>
      dataCentersBySupplierId: Map<string, DataCenter[]>
    }

function resolveRowSupplier(
  row: DatacenterImportParsedRow,
  context: DatacenterImportPreviewContext,
):
  | { ok: true; supplier: Supplier; platformTenantId?: string }
  | { ok: false; preview: DatacenterImportPreviewRow } {
  const tenantRaw = row.platform_tenant_id
  const platformTenantId = normalizePlatformTenantId(tenantRaw)

  if (context.mode === 'auto') {
    if (!platformTenantId) {
      return {
        ok: false,
        preview: {
          row_no: row.row_no,
          name: row.name,
          external_onboarding_id: row.external_onboarding_id,
          platform_tenant_id: tenantRaw,
          action: 'error',
          parse_status: 'error',
          parse_message: '缺少平台租户 ID，无法匹配供应商',
          field_warnings: [...row.field_warnings],
        },
      }
    }
    const supplier = context.suppliersByTenantId.get(platformTenantId)
    if (!supplier) {
      return {
        ok: false,
        preview: {
          row_no: row.row_no,
          name: row.name,
          external_onboarding_id: row.external_onboarding_id,
          platform_tenant_id: platformTenantId,
          action: 'error',
          parse_status: 'error',
          parse_message: `未找到平台租户 ID「${platformTenantId}」对应的供应商`,
          field_warnings: [...row.field_warnings],
        },
      }
    }
    return { ok: true, supplier, platformTenantId }
  }

  return { ok: true, supplier: context.supplier, platformTenantId }
}

function buildNameInFileCounts(
  parsedRows: DatacenterImportParsedRow[],
  context: DatacenterImportPreviewContext,
): Map<string, number> {
  const nameInFile = new Map<string, number>()
  for (const row of parsedRows) {
    if (!row.name) continue
    const resolved = resolveRowSupplier(row, context)
    const scopeKey =
      context.mode === 'auto' && resolved.ok
        ? `${resolved.supplier.id}:${normalizeDatacenterName(row.name)}`
        : normalizeDatacenterName(row.name)
    nameInFile.set(scopeKey, (nameInFile.get(scopeKey) ?? 0) + 1)
  }
  return nameInFile
}

export function buildDatacenterImportPreview(
  parsedRows: DatacenterImportParsedRow[],
  fileName: string,
  originalHeaders: string[],
  context: DatacenterImportPreviewContext,
): DatacenterImportPreviewResult {
  const mode: DatacenterImportPreviewMode = context.mode
  const nameInFile = buildNameInFileCounts(parsedRows, context)

  const previewRows: DatacenterImportPreviewRow[] = parsedRows.map((row) => {
    const warnings = [...row.field_warnings]
    const resolvedSupplier = resolveRowSupplier(row, context)
    const platformTenantId =
      resolvedSupplier.ok && resolvedSupplier.platformTenantId
        ? resolvedSupplier.platformTenantId
        : normalizePlatformTenantId(row.platform_tenant_id)

    const supplierFields =
      resolvedSupplier.ok
        ? {
            platform_tenant_id: platformTenantId ?? row.platform_tenant_id,
            resolved_supplier_id: resolvedSupplier.supplier.id,
            resolved_supplier_name: resolvedSupplier.supplier.name,
          }
        : {
            platform_tenant_id: row.platform_tenant_id,
          }

    if (!resolvedSupplier.ok) {
      return resolvedSupplier.preview
    }

    const supplier = resolvedSupplier.supplier
    const supplierId = supplier.id
    const scoped =
      context.mode === 'fixed'
        ? context.existingDataCenters.filter((dc) => dc.supplierId === supplierId)
        : (context.dataCentersBySupplierId.get(supplierId) ?? [])
    const codeSet = new Set(scoped.map((dc) => dc.code))

    if (row.field_warnings.some((w) => w.includes('公网 IP 数量'))) {
      return {
        row_no: row.row_no,
        name: row.name,
        external_onboarding_id: row.external_onboarding_id,
        ...supplierFields,
        action: 'error',
        parse_status: 'error',
        parse_message: row.field_warnings.find((w) => w.includes('公网 IP 数量')),
        field_warnings: warnings,
      }
    }

    if (row.source_deleted) {
      return {
        row_no: row.row_no,
        name: row.name,
        external_onboarding_id: row.external_onboarding_id,
        ...supplierFields,
        action: 'skip',
        skip_reason: 'source_deleted',
        parse_status: 'ok',
        parse_message: '源系统已删除',
        field_warnings: warnings,
      }
    }

    if (!row.name?.trim()) {
      return {
        row_no: row.row_no,
        ...supplierFields,
        action: 'skip',
        skip_reason: 'empty_name',
        parse_status: 'warning',
        parse_message: '名称为空',
        field_warnings: warnings,
      }
    }

    const nameScopeKey =
      context.mode === 'auto'
        ? `${supplierId}:${normalizeDatacenterName(row.name)}`
        : normalizeDatacenterName(row.name)
    if ((nameInFile.get(nameScopeKey) ?? 0) > 1) {
      return {
        row_no: row.row_no,
        name: row.name,
        external_onboarding_id: row.external_onboarding_id,
        ...supplierFields,
        action: 'error',
        parse_status: 'error',
        parse_message: '同文件内名称重复',
        field_warnings: warnings,
      }
    }

    const matched = findMatchingDatacenter(row, scoped)
    if (matched) {
      return {
        row_no: row.row_no,
        name: row.name,
        external_onboarding_id: row.external_onboarding_id,
        ...supplierFields,
        action: 'skip',
        skip_reason: 'already_exists',
        matched_data_center_id: matched.id,
        parse_status: 'ok',
        parse_message: '本地已存在，不更新',
        field_warnings: warnings,
      }
    }

    if (wouldCodeCollide(row, scoped, codeSet)) {
      const derived = deriveDatacenterCode(row, new Set(codeSet))
      const collision = scoped.find((dc) => dc.code === derived)
      if (collision) {
        return {
          row_no: row.row_no,
          name: row.name,
          external_onboarding_id: row.external_onboarding_id,
          ...supplierFields,
          action: 'skip',
          skip_reason: 'code_collision',
          matched_data_center_id: collision.id,
          derived_code: derived,
          parse_status: 'ok',
          parse_message: '编码冲突，视为已存在',
          field_warnings: warnings,
        }
      }
    }

    if (
      context.mode === 'fixed' &&
      row.platform_tenant_id &&
      supplier.platformTenantId &&
      row.platform_tenant_id !== supplier.platformTenantId
    ) {
      warnings.push('租户 ID 与供应商不一致')
    }

    const derived_code = deriveDatacenterCode(row, codeSet)
    const parse_status = warnings.length > 0 ? ('warning' as const) : ('ok' as const)

    return {
      row_no: row.row_no,
      name: row.name,
      external_onboarding_id: row.external_onboarding_id,
      ...supplierFields,
      action: 'create',
      derived_code,
      parse_status,
      parse_message: warnings.length > 0 ? warnings.join('；') : undefined,
      field_warnings: warnings,
    }
  })

  const ok = previewRows.filter((r) => r.parse_status === 'ok').length
  const warn = previewRows.filter((r) => r.parse_status === 'warning').length
  const error = previewRows.filter((r) => r.parse_status === 'error').length

  return {
    fileName,
    originalHeaders,
    mode,
    supplierId: context.mode === 'fixed' ? context.supplierId : undefined,
    rows: previewRows,
    parsedRows,
    summary: {
      total: previewRows.length,
      ok,
      warn,
      error,
      create: previewRows.filter((r) => r.action === 'create' && r.parse_status !== 'error')
        .length,
      skip: previewRows.filter((r) => r.action === 'skip').length,
    },
  }
}

export function buildSuppliersByPlatformTenantId(suppliers: Supplier[]): Map<string, Supplier> {
  const map = new Map<string, Supplier>()
  for (const s of suppliers) {
    const tid = normalizePlatformTenantId(s.platformTenantId)
    if (tid) map.set(tid, s)
  }
  return map
}

export function groupDataCentersBySupplierId(
  dataCenters: DataCenter[],
): Map<string, DataCenter[]> {
  const map = new Map<string, DataCenter[]>()
  for (const dc of dataCenters) {
    const list = map.get(dc.supplierId) ?? []
    list.push(dc)
    map.set(dc.supplierId, list)
  }
  return map
}

function parsedToDatacenterFields(
  row: DatacenterImportParsedRow,
  supplier: Supplier,
): Partial<DataCenter> {
  const platformTenantId =
    row.platform_tenant_id ?? supplier.platformTenantId ?? undefined

  return {
    name: row.name!,
    location: deriveLocation(row),
    address: '',
    status: row.status ?? 'offline',
    externalOnboardingId: row.external_onboarding_id,
    platformTenantId,
    regionTags: buildRegionTags(row),
    containerInstanceRegion: row.container_instance_region,
    bareMetalRegion: row.bare_metal_region,
    description: row.description,
    scale: row.scale,
    publicIpCount: row.public_ip_count,
    internalNetworkCidr: row.internal_network_cidr,
    auditStatus: row.audit_status,
    auditRemark: row.audit_remark,
    sourceDeleted: row.source_deleted ?? false,
    updatedAt: row.source_updated_at ?? new Date().toISOString().slice(0, 10),
  }
}

export function commitDatacenterImportMock(
  preview: DatacenterImportPreviewResult,
  supplier: Supplier,
  existingDataCenters: DataCenter[],
): { dataCenters: DataCenter[]; result: DatacenterImportCommitResult } {
  const scoped = existingDataCenters.filter((dc) => dc.supplierId !== supplier.id)
  const supplierCenters = existingDataCenters.filter((dc) => dc.supplierId === supplier.id)
  const dataCenters = [...supplierCenters]
  const codeSet = new Set(dataCenters.map((dc) => dc.code))

  let created = 0
  let skipped = 0
  let failed = 0
  const errors: DatacenterImportCommitResult['errors'] = []
  const created_ids: string[] = []

  for (const previewRow of preview.rows) {
    if (previewRow.action === 'skip') {
      skipped++
      continue
    }

    if (previewRow.parse_status === 'error' || previewRow.action === 'error') {
      failed++
      if (previewRow.parse_message) {
        errors.push({ row_no: previewRow.row_no, message: previewRow.parse_message })
      }
      continue
    }

    const row = preview.parsedRows.find((p) => p.row_no === previewRow.row_no)
    if (!row) {
      failed++
      errors.push({ row_no: previewRow.row_no, message: '解析行缺失' })
      continue
    }

    const rematch = findMatchingDatacenter(row, dataCenters)
    if (rematch) {
      skipped++
      continue
    }

    const code = previewRow.derived_code ?? deriveDatacenterCode(row, codeSet)
    if (codeSet.has(code)) {
      skipped++
      continue
    }
    codeSet.add(code)

    const id = `dc-import-${Date.now()}-${row.row_no}`
    const fields = parsedToDatacenterFields(row, supplier)
    const newDc: DataCenter = {
      id,
      supplierId: supplier.id,
      supplierName: supplier.name,
      code,
      networkFee: 0,
      managementNodeFee: 0,
      totalDeviceCount: 0,
      onlineDeviceCount: 0,
      createdAt: row.source_created_at ?? new Date().toISOString().slice(0, 10),
      name: fields.name!,
      location: fields.location ?? '',
      address: fields.address ?? '',
      status: fields.status ?? 'offline',
      ...fields,
    }
    dataCenters.push(newDc)
    created_ids.push(id)
    created++
  }

  return {
    dataCenters: [...scoped, ...dataCenters],
    result: { created, skipped, failed, errors, created_ids },
  }
}

export async function previewDatacenterImportFromFile(
  file: File,
  supplier: Supplier,
  existingDataCenters: DataCenter[],
): Promise<DatacenterImportPreviewResult> {
  const buffer = await file.arrayBuffer()
  const { parseDatacenterImportFile } = await import('@/lib/supplier/parse-datacenter-import-xlsx')
  const { rows, originalHeaders } = parseDatacenterImportFile(buffer, file.name)
  return buildDatacenterImportPreview(rows, file.name, originalHeaders, {
    mode: 'fixed',
    supplierId: supplier.id,
    supplier,
    existingDataCenters,
  })
}
