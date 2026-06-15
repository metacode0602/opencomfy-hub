import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { projectsDataAccess } from '@/lib/server/dataaccess/crm/projects'
import { crmLog } from '@/lib/server/dataaccess/crm/logger'
import { newBareMetalId } from '@/lib/server/dataaccess/supplier/bare-metal-order-sync'
import {
  OFFLINE_BARE_METAL_IMPORT_MAX_BYTES,
  parseOfflineBareMetalExcelBuffer,
  summarizeOfflineBareMetalRows,
  type OfflineBareMetalParsedRow,
} from '@/lib/supplier/bare-metal-order-offline-excel-utils'
import type {
  OfflineBareMetalOrderImportResult,
  OfflineBareMetalOrderPreviewResult,
  OfflineBareMetalOrderPreviewRowDto,
} from '@/lib/types/bare-metal-order-api'
import {
  bareMetalOrder,
  bareMetalOrderDevice,
  bareMetalOrderImportBatch,
  billingTenant,
  crmProject,
  gpuCardType,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

const PREVIEW_TTL_MS = 30 * 60 * 1000

type CachedPreview = {
  expiresAt: number
  projectId: string
  tenantId: string
  fileName: string
  fileHash: string
  rows: OfflineBareMetalParsedRow[]
  validatedRows: Array<OfflineBareMetalParsedRow & { gpuCardTypeId: string; gpuCardTypeCode: string }>
  headSummary: OfflineBareMetalOrderPreviewResult['headSummary']
}

const previewCache = new Map<string, CachedPreview>()

function purgeExpiredPreviewCache() {
  const now = Date.now()
  for (const [token, cached] of previewCache) {
    if (cached.expiresAt <= now) previewCache.delete(token)
  }
}

function newPreviewToken() {
  return crypto.randomUUID()
}

function newImportBatchId() {
  return `bmord-imp-${crypto.randomUUID()}`
}

function toMoney(n: number): string {
  return n.toFixed(4)
}

function deriveProjectCode(projectId: string): string {
  return projectId.replace(/^proj-/, '').slice(0, 8).toUpperCase() || 'PROJ'
}

function buildOfflineOrderNo(projectId: string, importBatchId: string): string {
  const date = new Date()
  const ymd = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('')
  const shortCode = importBatchId.replace(/-/g, '').slice(-4).toUpperCase()
  return `OFF-${deriveProjectCode(projectId)}-${ymd}-${shortCode}`
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

async function loadGpuCardTypeByCode(): Promise<Map<string, { id: string; code: string }>> {
  const rows = await db
    .select({ id: gpuCardType.id, code: gpuCardType.code })
    .from(gpuCardType)
    .where(eq(gpuCardType.status, 'active'))
  const map = new Map<string, { id: string; code: string }>()
  for (const row of rows) {
    map.set(row.code.trim().toLowerCase(), { id: row.id, code: row.code })
  }
  return map
}

function validateRows(
  rows: OfflineBareMetalParsedRow[],
  cardTypeByCode: Map<string, { id: string; code: string }>,
): OfflineBareMetalOrderPreviewRowDto[] {
  return rows.map((row) => {
    const errors = [...row.errors]
    const warnings: string[] = []

    const cardKey = row.cardType.trim().toLowerCase()
    const card = cardTypeByCode.get(cardKey)
    if (!card && row.cardType.trim()) {
      errors.push(`卡型「${row.cardType}」无法匹配系统卡型`)
    }

    if (row.rentStartsAt.getTime() > 0 && row.rentEndsAt.getTime() > 0) {
      const diffHours = hoursBetween(row.rentStartsAt, row.rentEndsAt)
      if (Math.abs(diffHours - row.durationHours) > 1) {
        warnings.push(
          `时长 ${row.durationHours}h 与起止时间差 ${diffHours.toFixed(1)}h 不一致（长租可忽略）`,
        )
      }
    }

    return {
      rowNo: row.rowNo,
      cardType: row.cardType,
      gpuCardTypeId: card?.id ?? null,
      gpuCardTypeCode: card?.code ?? null,
      gpuCount: row.gpuCount,
      rentStartsAt: row.rentStartsAt.toISOString(),
      rentEndsAt: row.rentEndsAt.toISOString(),
      durationHours: row.durationHours,
      unitPricePerCardHour: row.unitPricePerCardHour,
      lineAmount: row.lineAmount,
      errors,
      warnings,
    }
  })
}

async function assertTenantBelongsToProject(projectId: string, tenantId: string) {
  const tenantIds = await projectsDataAccess.getBillingTenantIdsForProject(projectId)
  if (!tenantIds.includes(tenantId)) {
    throw new Error('所选计费租户不属于当前项目')
  }
}

export const bareMetalOrderOfflineImportDataAccess = {
  async preview(input: {
    projectId: string
    tenantId: string
    fileName: string
    fileBase64: string
  }): Promise<OfflineBareMetalOrderPreviewResult> {
    const project = await db.query.crmProject.findFirst({
      where: eq(crmProject.id, input.projectId),
      columns: { id: true, name: true },
    })
    if (!project) throw new Error('项目不存在')

    await assertTenantBelongsToProject(input.projectId, input.tenantId)

    const tenant = await db.query.billingTenant.findFirst({
      where: eq(billingTenant.id, input.tenantId),
      columns: { id: true, name: true },
    })
    if (!tenant) throw new Error('计费租户不存在')

    const buffer = Buffer.from(input.fileBase64, 'base64')
    if (buffer.byteLength > OFFLINE_BARE_METAL_IMPORT_MAX_BYTES) {
      throw new Error('文件大小超过限制')
    }

    const parsed = parseOfflineBareMetalExcelBuffer(buffer)
    if (parsed.headerErrors.length > 0 || parsed.missingColumns.length > 0) {
      return {
        previewToken: '',
        fileName: input.fileName,
        projectId: input.projectId,
        projectName: project.name,
        tenantId: input.tenantId,
        tenantName: tenant.name,
        headSummary: {
          deviceLineCount: 0,
          gpuCount: 0,
          finalAmount: 0,
          rentStartsAt: null,
          rentEndsAt: null,
          purchaseQtyText: '',
        },
        rows: [],
        headerErrors: parsed.headerErrors.length
          ? parsed.headerErrors
          : [`缺少必填列：${parsed.missingColumns.join('、')}`],
        selectable: false,
      }
    }

    const cardTypeByCode = await loadGpuCardTypeByCode()
    const previewRows = validateRows(parsed.rows, cardTypeByCode)
    const okRows = previewRows.filter((r) => r.errors.length === 0)
    const summary = summarizeOfflineBareMetalRows(
      parsed.rows.filter((r) => {
        const cardKey = r.cardType.trim().toLowerCase()
        return r.errors.length === 0 && cardTypeByCode.has(cardKey)
      }),
    )

    const purchaseQtyText =
      summary.deviceLineCount > 0
        ? `${summary.deviceLineCount} 行明细 / ${summary.gpuCount} 卡`
        : ''

    const previewToken = newPreviewToken()
    const fileHash = createHash('sha256').update(buffer).digest('hex')

    const validatedRows = okRows.map((row) => {
      const parsedRow = parsed.rows.find((p) => p.rowNo === row.rowNo)!
      const card = cardTypeByCode.get(row.cardType.trim().toLowerCase())!
      return { ...parsedRow, gpuCardTypeId: card.id, gpuCardTypeCode: card.code }
    })

    previewCache.set(previewToken, {
      expiresAt: Date.now() + PREVIEW_TTL_MS,
      projectId: input.projectId,
      tenantId: input.tenantId,
      fileName: input.fileName,
      fileHash,
      rows: parsed.rows,
      validatedRows,
      headSummary: {
        deviceLineCount: summary.deviceLineCount,
        gpuCount: summary.gpuCount,
        finalAmount: summary.finalAmount,
        rentStartsAt: summary.rentStartsAt?.toISOString() ?? null,
        rentEndsAt: summary.rentEndsAt?.toISOString() ?? null,
        purchaseQtyText,
      },
    })

    crmLog('bare-metal-offline-import', 'preview done', {
      projectId: input.projectId,
      rows: previewRows.length,
      errors: previewRows.filter((r) => r.errors.length > 0).length,
    })

    return {
      previewToken,
      fileName: input.fileName,
      projectId: input.projectId,
      projectName: project.name,
      tenantId: input.tenantId,
      tenantName: tenant.name,
      headSummary: {
        deviceLineCount: summary.deviceLineCount,
        gpuCount: summary.gpuCount,
        finalAmount: summary.finalAmount,
        rentStartsAt: summary.rentStartsAt?.toISOString() ?? null,
        rentEndsAt: summary.rentEndsAt?.toISOString() ?? null,
        purchaseQtyText,
      },
      rows: previewRows,
      headerErrors: parsed.headerErrors,
      selectable: okRows.length > 0 && parsed.headerErrors.length === 0,
    }
  },

  async commit(input: {
    previewToken: string
    operatorStaffId: string | null
  }): Promise<OfflineBareMetalOrderImportResult> {
    purgeExpiredPreviewCache()
    const cached = previewCache.get(input.previewToken)
    if (!cached) {
      throw new Error('预览已过期，请重新上传文件')
    }
    if (cached.validatedRows.length === 0) {
      throw new Error('没有可导入的有效明细行')
    }

    const tenant = await db.query.billingTenant.findFirst({
      where: eq(billingTenant.id, cached.tenantId),
      columns: {
        id: true,
        platformTenantId: true,
        customerId: true,
      },
    })
    if (!tenant?.platformTenantId) {
      throw new Error('计费租户缺少平台租户 ID')
    }
    const platformTenantId = tenant.platformTenantId

    const importBatchId = newImportBatchId()
    const orderId = newBareMetalId('bmord')
    const platformOrderId = `offline-${importBatchId}`
    const orderNo = buildOfflineOrderNo(cached.projectId, importBatchId)
    const summary = cached.headSummary
    const now = new Date()

    await db.transaction(async (tx) => {
      await tx.insert(bareMetalOrderImportBatch).values({
        id: importBatchId,
        projectId: cached.projectId,
        tenantId: cached.tenantId,
        fileName: cached.fileName,
        fileHash: cached.fileHash,
        rowCount: cached.validatedRows.length,
        createdByStaffId: input.operatorStaffId,
      })

      await tx.insert(bareMetalOrder).values({
        id: orderId,
        platformOrderId,
        orderNo,
        orderMark: 'offline',
        tenantId: cached.tenantId,
        platformTenantId: platformTenantId,
        customerId: tenant.customerId,
        projectId: cached.projectId,
        dataCenterId: null,
        supplierId: null,
        status: 'completed',
        payStatus: 'paid',
        billingUnit: 'hour',
        purchaseQtyText: summary.purchaseQtyText,
        deviceCount: summary.deviceLineCount,
        gpuCount: summary.gpuCount,
        orderAmount: toMoney(summary.finalAmount),
        refundAmount: '0',
        finalAmount: toMoney(summary.finalAmount),
        orderedAt: cached.validatedRows.reduce(
          (min, row) => (row.rentStartsAt < min ? row.rentStartsAt : min),
          cached.validatedRows[0]!.rentStartsAt,
        ),
        paidAt: now,
        completedAt: now,
        rentStartsAt: summary.rentStartsAt ? new Date(summary.rentStartsAt) : null,
        rentEndsAt: summary.rentEndsAt ? new Date(summary.rentEndsAt) : null,
        importBatchId,
        source: 'offline_excel',
        platformPayload: {},
        matchFlags: {},
      })

      const deviceRows = cached.validatedRows.map((row, index) => ({
        id: newBareMetalId('bmord-dev'),
        bareMetalOrderId: orderId,
        lineNo: index + 1,
        allocationStatus: 'planned' as const,
        gpuCardTypeId: row.gpuCardTypeId,
        deviceModelText: row.cardType,
        gpuCount: row.gpuCount,
        durationHours: toMoney(row.durationHours),
        unitPricePerCardHour: toMoney(row.unitPricePerCardHour),
        lineAmount: toMoney(row.lineAmount),
        rentStartsAt: row.rentStartsAt,
        rentEndsAt: row.rentEndsAt,
        platformPayload: {
          import_row_no: row.rowNo,
          raw: {
            卡型: row.cardType,
            卡数: row.gpuCount,
            开始时间: row.rentStartsAt.toISOString(),
            结束时间: row.rentEndsAt.toISOString(),
            时长: row.durationHours,
            卡时单价: row.unitPricePerCardHour,
            总价: row.lineAmount,
          },
        },
      }))

      await tx.insert(bareMetalOrderDevice).values(deviceRows)

      await tx
        .update(bareMetalOrderImportBatch)
        .set({ bareMetalOrderId: orderId, committedAt: now })
        .where(eq(bareMetalOrderImportBatch.id, importBatchId))
    })

    previewCache.delete(input.previewToken)

    crmLog('bare-metal-offline-import', 'commit done', {
      importBatchId,
      orderId,
      orderNo,
      lines: cached.validatedRows.length,
    })

    return {
      importBatchId,
      bareMetalOrderId: orderId,
      orderNo,
      deviceLineCount: cached.validatedRows.length,
      finalAmount: toMoney(summary.finalAmount),
      errors: [],
    }
  },
}
