import type { CooperationMode, Supplier, SupplierOnboardingType } from '@/lib/data/types'
import type { UserStaff } from '@/lib/types/crm'
import type {
  SupplierImportCommitResult,
  SupplierImportParsedRow,
  SupplierImportPreviewResult,
  SupplierImportPreviewRow,
} from '@/lib/types/supplier-import'

export function normalizeHeaderKey(h: string): string {
  return h.trim().replace(/\s+/g, '').toLowerCase()
}

export function normalizeImportCell(raw: string | null | undefined): string {
  if (raw == null) return ''
  return raw
    .trim()
    .replace(/^\ufeff/, '')
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .normalize('NFKC')
}

export function mapOnboardingType(raw: string | null): SupplierOnboardingType | null {
  const s = normalizeImportCell(raw).toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  const enterpriseExact = new Set(['企业', '公司', 'enterprise', 'ent'])
  const individualExact = new Set(['个人', '自然人', 'individual', 'personal'])

  if (enterpriseExact.has(s)) return 'enterprise'
  if (individualExact.has(s)) return 'individual'

  if (['企业', '公司', 'enterprise'].some((k) => s.includes(k))) return 'enterprise'
  if (['个人', '自然人', 'individual', 'personal'].some((k) => s.includes(k))) return 'individual'

  return null
}

export function mapCooperationMode(raw: string | null): {
  mode: CooperationMode
  warning?: string
} {
  if (!raw) return { mode: 'card_time', warning: '合作模式为空，默认卡时' }
  const s = raw.trim().toLowerCase()
  if (['卡时', '固定卡时', 'card_time'].some((k) => s.includes(k))) return { mode: 'card_time' }
  if (['分成', '收益分成', 'revenue_share'].some((k) => s.includes(k))) {
    return { mode: 'revenue_share' }
  }
  return { mode: 'card_time', warning: `无法识别合作模式「${raw}」，默认卡时` }
}

export function mapAuditStatus(raw: string | null): {
  audit_status: string
  status: Supplier['status']
  warning?: string
} {
  if (!raw) {
    return { audit_status: 'pending', status: 'negotiating', warning: '审核状态为空' }
  }
  const s = raw.trim()
  if (['已通过', '审核通过', 'approved'].some((k) => s.includes(k))) {
    return { audit_status: 'approved', status: 'cooperating' }
  }
  if (['待审核', '审核中', 'pending'].some((k) => s.includes(k))) {
    return { audit_status: 'pending', status: 'negotiating' }
  }
  if (['已驳回', 'rejected'].some((k) => s.includes(k))) {
    return { audit_status: 'rejected', status: 'negotiating' }
  }
  if (s.includes('已暂停') || s.includes('suspended')) {
    return { audit_status: 'suspended', status: 'suspended' }
  }
  if (['已终止', '已注销', 'terminated'].some((k) => s.includes(k))) {
    return { audit_status: 'terminated', status: 'terminated' }
  }
  return {
    audit_status: s,
    status: 'negotiating',
    warning: `无法识别审核状态「${raw}」`,
  }
}

export function parseAuditConfirmed(raw: string | null): boolean {
  if (!raw) return false
  const s = raw.trim().toLowerCase()
  return s === '是' || s === 'true' || s === '1' || s === 'yes' || s === 'y'
}

export function isHttpUrl(v: string): boolean {
  return /^https?:\/\//i.test(v.trim())
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

export function deriveShortName(name: string): string {
  const stripped = name
    .replace(/股份有限公司|有限责任公司|有限公司|科技有限公司/g, '')
    .trim()
  const base = stripped || name
  return base.length > 16 ? base.slice(0, 16) : base
}

export function deriveSupplierCode(
  row: SupplierImportParsedRow,
  existingCodes: Set<string>,
): string {
  let candidate: string
  if (row.identity_no && row.identity_no.length >= 6) {
    candidate = `SUP-${row.identity_no.slice(-6).toUpperCase()}`
  } else if (row.external_onboarding_id) {
    candidate = `SUP-${row.external_onboarding_id}`
  } else {
    candidate = `SUP-${row.row_no}`
  }
  let code = candidate
  let n = 2
  while (existingCodes.has(code)) {
    code = `${candidate}-${n}`
    n++
  }
  return code
}

function findMatchingSupplier(
  row: SupplierImportParsedRow,
  suppliers: Supplier[],
): Supplier | undefined {
  if (row.external_onboarding_id) {
    const hit = suppliers.find((s) => s.externalOnboardingId === row.external_onboarding_id)
    if (hit) return hit
  }
  const tenantId = normalizePlatformTenantId(row.platform_tenant_id)
  if (tenantId) {
    const hit = suppliers.find((s) => s.platformTenantId === tenantId)
    if (hit) return hit
  }
  if (row.name && row.contact_phone?.trim()) {
    const hit = suppliers.find(
      (s) => s.name === row.name && s.contactPhone === row.contact_phone,
    )
    if (hit) return hit
  }
  return undefined
}

export function normalizePlatformTenantId(raw?: string | null): string | undefined {
  const s = raw?.trim()
  return s ? s : undefined
}

/** 导入行租户 ID → supplier.external_tenant_id（无租户 ID 时为空字符串） */
export function resolveExternalTenantId(row: SupplierImportParsedRow): string {
  return normalizePlatformTenantId(row.platform_tenant_id) ?? ''
}

function maskIdentity(no: string | undefined): string {
  if (!no) return '—'
  if (no.length <= 8) return no
  return `${no.slice(0, 4)}****${no.slice(-4)}`
}

function errorFieldsToColumnIndexes(
  errorFields: string[],
  columnCanonicalByIndex: (string | null)[],
): number[] {
  const set = new Set<number>()
  for (const field of errorFields) {
    columnCanonicalByIndex.forEach((canonical, idx) => {
      if (canonical === field) set.add(idx)
    })
  }
  return [...set].sort((a, b) => a - b)
}

type PreviewRowBuild = Pick<
  SupplierImportPreviewRow,
  | 'row_no'
  | 'name'
  | 'onboarding_type'
  | 'identity_no'
  | 'action'
  | 'matched_supplier_id'
  | 'business_manager_note'
  | 'business_manager_label'
  | 'field_warnings'
>

function finalizePreviewRow(
  base: PreviewRowBuild,
  columnCanonicalByIndex: (string | null)[],
  errorFields: string[],
  hardErrors: string[],
  softWarnings: string[],
): SupplierImportPreviewRow {
  const errors = hardErrors
  const warnings = softWarnings
  const hasError = errors.length > 0
  const parse_status = hasError ? 'error' : warnings.length > 0 ? 'warning' : 'ok'
  const parse_message = hasError
    ? errors.join('；')
    : warnings.length > 0
      ? warnings.join('；')
      : undefined

  return {
    ...base,
    parse_status,
    parse_message,
    errors,
    warnings,
    errorFields,
    errorColumnIndexes: errorFieldsToColumnIndexes(errorFields, columnCanonicalByIndex),
    selectable: !hasError,
    action: hasError ? 'skip' : base.action,
  }
}

export function buildSupplierImportPreview(
  parsedRows: SupplierImportParsedRow[],
  fileName: string,
  originalHeaders: string[],
  columnCanonicalByIndex: (string | null)[],
  existingSuppliers: Supplier[],
  defaultBusinessManagerStaffId: string | null,
  activeStaff: UserStaff[],
): SupplierImportPreviewResult {
  const staff = activeStaff.find((s) => s.id === defaultBusinessManagerStaffId)
  const staffLabel = staff?.display_name ?? '—'

  const tenantInFile = new Map<string, number>()
  for (const row of parsedRows) {
    const tid = normalizePlatformTenantId(row.platform_tenant_id)
    if (!tid) continue
    tenantInFile.set(tid, (tenantInFile.get(tid) ?? 0) + 1)
  }

  const previewRows: SupplierImportPreviewRow[] = parsedRows.map((row) => {
    const softWarnings = [...row.field_warnings]

    if (!row.contact_person?.trim() && !row.contact_phone?.trim()) {
      softWarnings.push('联系人、联系人电话均为空')
    } else if (!row.contact_person?.trim() || !row.contact_phone?.trim()) {
      softWarnings.push('联系人或联系人电话为空')
    }

    if (!defaultBusinessManagerStaffId) {
      return finalizePreviewRow(
        {
          row_no: row.row_no,
          name: row.name,
          onboarding_type: row.onboarding_type,
          identity_no: maskIdentity(row.identity_no),
          action: 'skip',
          business_manager_note: 'will_set',
          field_warnings: softWarnings,
        },
        columnCanonicalByIndex,
        [],
        ['请选择默认商务经理'],
        softWarnings,
      )
    }

    if (!row.onboarding_type) {
      const onboardingErrors =
        softWarnings.length > 0 ? softWarnings : ['入驻类型无法识别']
      return finalizePreviewRow(
        {
          row_no: row.row_no,
          name: row.name,
          action: 'skip',
          business_manager_note: 'will_set',
          field_warnings: softWarnings,
        },
        columnCanonicalByIndex,
        ['入驻类型'],
        onboardingErrors,
        [],
      )
    }

    const tenantId = normalizePlatformTenantId(row.platform_tenant_id)
    if (tenantId && (tenantInFile.get(tenantId) ?? 0) > 1) {
      return finalizePreviewRow(
        {
          row_no: row.row_no,
          name: row.name,
          onboarding_type: row.onboarding_type,
          identity_no: maskIdentity(row.identity_no),
          action: 'skip',
          business_manager_note: 'will_set',
          field_warnings: softWarnings,
        },
        columnCanonicalByIndex,
        ['租户ID'],
        ['同文件内平台租户 ID 重复'],
        softWarnings,
      )
    }

    if (tenantId) {
      const existingByExternalTenant = existingSuppliers.find(
        (s) => s.externalTenantId === tenantId,
      )
      if (existingByExternalTenant) {
        return {
          row_no: row.row_no,
          name: row.name,
          onboarding_type: row.onboarding_type,
          identity_no: maskIdentity(row.identity_no),
          action: 'skip',
          matched_supplier_id: existingByExternalTenant.id,
          business_manager_note: 'keep_existing',
          business_manager_label: existingByExternalTenant.businessManager,
          parse_status: 'ok',
          parse_message: '租户 ID 已存在，跳过',
          field_warnings: softWarnings,
          errors: [],
          warnings: [],
          errorFields: [],
          errorColumnIndexes: [],
          selectable: false,
        }
      }
    }

    const matched = findMatchingSupplier(row, existingSuppliers)
    if (tenantId) {
      const other = existingSuppliers.find(
        (s) => s.platformTenantId === tenantId && s.id !== matched?.id,
      )
      if (other) {
        return finalizePreviewRow(
          {
            row_no: row.row_no,
            name: row.name,
            onboarding_type: row.onboarding_type,
            identity_no: maskIdentity(row.identity_no),
            action: 'skip',
            business_manager_note: 'keep_existing',
            field_warnings: softWarnings,
          },
          columnCanonicalByIndex,
          ['租户ID'],
          ['平台租户 ID 已被其它供应商占用'],
          softWarnings,
        )
      }
    }

    const action = matched ? ('update' as const) : ('create' as const)

    return finalizePreviewRow(
      {
        row_no: row.row_no,
        name: row.name,
        onboarding_type: row.onboarding_type,
        identity_no: maskIdentity(row.identity_no),
        action,
        matched_supplier_id: matched?.id,
        business_manager_note: action === 'create' ? 'will_set' : 'keep_existing',
        business_manager_label:
          action === 'create' ? staffLabel : (matched?.businessManager ?? '—'),
        field_warnings: softWarnings,
      },
      columnCanonicalByIndex,
      [],
      [],
      softWarnings,
    )
  })

  const ok = previewRows.filter((r) => r.parse_status === 'ok').length
  const warn = previewRows.filter((r) => r.parse_status === 'warning').length
  const error = previewRows.filter((r) => r.parse_status === 'error').length
  const selectableRows = previewRows.filter((r) => r.selectable)

  return {
    fileName,
    originalHeaders,
    columnCanonicalByIndex,
    rows: previewRows,
    parsedRows,
    parsedSnapshot: parsedRows.map((row) => ({
      row_no: row.row_no,
      originalCells: row.originalCells,
    })),
    summary: {
      total: previewRows.length,
      ok,
      warn,
      error,
      create: selectableRows.filter((r) => r.action === 'create').length,
      update: selectableRows.filter((r) => r.action === 'update').length,
      skip: previewRows.filter((r) => !r.selectable).length,
    },
  }
}

function parsedToSupplierFields(row: SupplierImportParsedRow): Partial<Supplier> {
  return {
    name: row.name!,
    contactPerson: row.contact_person?.trim() || '',
    contactPhone: row.contact_phone?.trim() || '',
    contactEmail: row.admin_email?.trim() || '',
    address: row.address?.trim() || '',
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    cooperationMode: row.cooperation_mode ?? 'card_time',
    status: row.status ?? 'negotiating',
    externalOnboardingId: row.external_onboarding_id,
    externalTenantId: resolveExternalTenantId(row) || undefined,
    platformTenantId: normalizePlatformTenantId(row.platform_tenant_id),
    onboardingType: row.onboarding_type,
    identityNo: row.identity_no,
    businessScope: row.business_scope,
    businessLicenseUri: row.business_license_uri,
    idCardFrontUri: row.id_card_front_uri,
    idCardBackUri: row.id_card_back_uri,
    bankBranchName: row.bank_branch_name,
    bankBranchAddress: row.bank_branch_address,
    adminPhone: row.admin_phone,
    adminEmail: row.admin_email,
    deviceInfoRaw: row.device_info_raw,
    auditStatus: row.audit_status,
    auditConfirmed: row.audit_confirmed,
    auditRemark: row.audit_remark,
    updatedAt: row.source_updated_at ?? new Date().toISOString().slice(0, 10),
  }
}

export function commitSupplierImportMock(
  preview: SupplierImportPreviewResult,
  existingSuppliers: Supplier[],
  defaultBusinessManagerStaffId: string,
  activeStaff: UserStaff[],
): { suppliers: Supplier[]; result: SupplierImportCommitResult } {
  const staff = activeStaff.find((s) => s.id === defaultBusinessManagerStaffId)
  const businessManagerName = staff?.display_name ?? '未指定'

  const suppliers = [...existingSuppliers]
  const codeSet = new Set(suppliers.map((s) => s.code).filter(Boolean) as string[])

  let created = 0
  let updated = 0
  let failed = 0
  let skipped = 0
  const errors: SupplierImportCommitResult['errors'] = []

  for (const previewRow of preview.rows) {
    if (!previewRow.selectable) {
      skipped++
      if (previewRow.errors.length > 0) {
        errors.push({
          row_no: previewRow.row_no,
          message: previewRow.errors.join('；'),
        })
      }
      continue
    }

    const row = preview.parsedRows.find((p) => p.row_no === previewRow.row_no)
    if (!row) {
      failed++
      errors.push({ row_no: previewRow.row_no, message: '解析行缺失' })
      continue
    }

    const fields = parsedToSupplierFields(row)

    if (previewRow.action === 'create') {
      const code = deriveSupplierCode(row, codeSet)
      codeSet.add(code)
      const id = `sup-import-${Date.now()}-${row.row_no}`
      const newSupplier: Supplier = {
        id,
        code,
        shortName: deriveShortName(row.name!),
        businessManager: businessManagerName,
        createdAt: row.source_created_at ?? new Date().toISOString().slice(0, 10),
        dataCenterCount: 0,
        totalDeviceCount: 0,
        monthlySettlement: 0,
        ...fields,
        name: fields.name!,
        contactPerson: fields.contactPerson ?? '',
        contactPhone: fields.contactPhone ?? '',
        contactEmail: fields.contactEmail ?? '',
        address: fields.address ?? '',
        status: fields.status ?? 'negotiating',
        cooperationMode: fields.cooperationMode ?? 'card_time',
      }
      suppliers.push(newSupplier)
      created++
      continue
    }

    if (previewRow.action === 'update' && previewRow.matched_supplier_id) {
      const idx = suppliers.findIndex((s) => s.id === previewRow.matched_supplier_id)
      if (idx === -1) {
        failed++
        errors.push({ row_no: row.row_no, message: '匹配供应商不存在' })
        continue
      }
      const prev = suppliers[idx]!
      suppliers[idx] = {
        ...prev,
        ...fields,
        code: prev.code,
        shortName: prev.shortName,
        businessManager: prev.businessManager,
        createdAt: prev.createdAt,
        dataCenterCount: prev.dataCenterCount,
        totalDeviceCount: prev.totalDeviceCount,
        monthlySettlement: prev.monthlySettlement,
        name: fields.name ?? prev.name,
        contactPerson: fields.contactPerson ?? prev.contactPerson,
        contactPhone: fields.contactPhone ?? prev.contactPhone,
        contactEmail: fields.contactEmail ?? prev.contactEmail,
        address: fields.address ?? prev.address,
        status: fields.status ?? prev.status,
        cooperationMode: fields.cooperationMode ?? prev.cooperationMode,
      }
      updated++
    }
  }

  return {
    suppliers,
    result: { created, updated, failed, skipped, errors },
  }
}

export async function previewSupplierImportFromFile(
  file: File,
  existingSuppliers: Supplier[],
  defaultBusinessManagerStaffId: string | null,
  activeStaff: UserStaff[],
): Promise<SupplierImportPreviewResult> {
  const buffer = await file.arrayBuffer()
  const { parseSupplierImportFile } = await import('@/lib/supplier/parse-supplier-import-xlsx')
  const { rows, originalHeaders, columnCanonicalByIndex } = parseSupplierImportFile(
    buffer,
    file.name,
  )
  return buildSupplierImportPreview(
    rows,
    file.name,
    originalHeaders,
    columnCanonicalByIndex,
    existingSuppliers,
    defaultBusinessManagerStaffId,
    activeStaff,
  )
}
