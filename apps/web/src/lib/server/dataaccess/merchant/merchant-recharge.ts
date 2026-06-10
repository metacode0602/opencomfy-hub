import { db } from '@/lib/db'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import {
  mapMerchantRechargeAttachment,
  mapMerchantRechargeAuditRow,
  mapMerchantRechargeRow,
} from '@/lib/server/mappers/merchant'
import type { MerchantRechargeRecord } from '@/lib/types/merchant'
import {
  merchant,
  merchantActivity,
  merchantRechargeAttachment,
  merchantRechargeAuditLog,
  merchantRechargeRecord,
  userStaff,
} from '@workspace/db/schema'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { saveMerchantAttachmentFile } from './merchant-attachment-storage'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5
const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
])

function newId() {
  return crypto.randomUUID()
}

async function resolveOperator(user: {
  id: string
  email?: string | null
  name?: string | null
}) {
  const staffId = await staffDataAccess.resolveStaffIdForAuthUser(user)
  if (!staffId) throw new Error('当前账号未关联员工信息')
  const staff = await db.query.userStaff.findFirst({
    where: eq(userStaff.id, staffId),
    columns: { id: true, displayName: true },
  })
  if (!staff) throw new Error('员工信息不存在')
  return { staffId, operatorName: staff.displayName }
}

export type MerchantRechargeFileInput = {
  fileName: string
  mimeType: string
  fileBase64: string
}

export type MerchantRechargeWriteInput = {
  amount: number
  paymentMethod: string
  status: MerchantRechargeRecord['status']
  transactionId?: string
  rechargeDate: string
  remark?: string
  files: MerchantRechargeFileInput[]
  keepAttachmentIds?: string[]
}

function validateVoucherFile(file: MerchantRechargeFileInput, buffer: Buffer) {
  if (buffer.length === 0) throw new Error(`文件 ${file.fileName} 为空`)
  if (buffer.length > MAX_FILE_BYTES) throw new Error(`文件 ${file.fileName} 超过 20MB`)
  const lower = file.fileName.toLowerCase()
  const okMime = ACCEPTED_MIME.has(file.mimeType)
  const okExt =
    lower.endsWith('.pdf') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  if (!okMime && !okExt) throw new Error(`「${file.fileName}」格式不支持，仅支持图片与 PDF`)
}

async function loadRechargeWithAttachments(rechargeId: string) {
  const row = await db.query.merchantRechargeRecord.findFirst({
    where: eq(merchantRechargeRecord.id, rechargeId),
  })
  if (!row) return null

  const attachments = await db
    .select()
    .from(merchantRechargeAttachment)
    .where(eq(merchantRechargeAttachment.rechargeId, rechargeId))

  const createdBy = row.createdByStaffId
    ? (
        await db.query.userStaff.findFirst({
          where: eq(userStaff.id, row.createdByStaffId),
          columns: { displayName: true },
        })
      )?.displayName
    : undefined
  const updatedBy = row.updatedByStaffId
    ? (
        await db.query.userStaff.findFirst({
          where: eq(userStaff.id, row.updatedByStaffId),
          columns: { displayName: true },
        })
      )?.displayName
    : undefined

  return {
    ...mapMerchantRechargeRow(row, { createdBy, updatedBy }),
    attachments: attachments.map(mapMerchantRechargeAttachment),
  }
}

export const merchantRechargeDataAccess = {
  async listByMerchantId(merchantId: string) {
    const rows = await db
      .select()
      .from(merchantRechargeRecord)
      .where(eq(merchantRechargeRecord.merchantId, merchantId))
      .orderBy(desc(merchantRechargeRecord.rechargeDate))

    if (rows.length === 0) return []

    const ids = rows.map((r) => r.id)
    const allAttachments = await db
      .select()
      .from(merchantRechargeAttachment)
      .where(inArray(merchantRechargeAttachment.rechargeId, ids))

    const byRecharge = new Map<string, ReturnType<typeof mapMerchantRechargeAttachment>[]>()
    for (const att of allAttachments) {
      const list = byRecharge.get(att.rechargeId) ?? []
      list.push(mapMerchantRechargeAttachment(att))
      byRecharge.set(att.rechargeId, list)
    }

    const result = []
    for (const row of rows) {
      const createdBy = row.createdByStaffId
        ? (
            await db.query.userStaff.findFirst({
              where: eq(userStaff.id, row.createdByStaffId),
              columns: { displayName: true },
            })
          )?.displayName
        : undefined
      const updatedBy = row.updatedByStaffId
        ? (
            await db.query.userStaff.findFirst({
              where: eq(userStaff.id, row.updatedByStaffId),
              columns: { displayName: true },
            })
          )?.displayName
        : undefined
      result.push({
        ...mapMerchantRechargeRow(row, { createdBy, updatedBy }),
        attachments: byRecharge.get(row.id) ?? [],
      })
    }
    return result
  },

  async listAuditByMerchantId(merchantId: string, limit = 20) {
    const rows = await db
      .select()
      .from(merchantRechargeAuditLog)
      .where(eq(merchantRechargeAuditLog.merchantId, merchantId))
      .orderBy(desc(merchantRechargeAuditLog.occurredAt))
      .limit(limit)
    return rows.map(mapMerchantRechargeAuditRow)
  },

  async listAuditByRechargeId(rechargeId: string) {
    const rows = await db
      .select()
      .from(merchantRechargeAuditLog)
      .where(eq(merchantRechargeAuditLog.rechargeId, rechargeId))
      .orderBy(desc(merchantRechargeAuditLog.occurredAt))
    return rows.map(mapMerchantRechargeAuditRow)
  },

  async create(
    merchantId: string,
    input: MerchantRechargeWriteInput,
    user: { id: string; email?: string | null; name?: string | null },
  ) {
    if (input.files.length === 0) throw new Error('请至少上传 1 个充值凭证')
    if (input.files.length > MAX_FILES) throw new Error(`最多上传 ${MAX_FILES} 个凭证`)

    const merchantRow = await db.query.merchant.findFirst({
      where: eq(merchant.id, merchantId),
      columns: { id: true },
    })
    if (!merchantRow) throw new Error('商户不存在')

    const operator = await resolveOperator(user)
    const rechargeId = newId()
    const now = new Date()

    await db.insert(merchantRechargeRecord).values({
      id: rechargeId,
      merchantId,
      amount: String(input.amount),
      paymentMethod: input.paymentMethod,
      status: input.status,
      transactionId: input.transactionId ?? null,
      rechargeDate: input.rechargeDate,
      remark: input.remark ?? null,
      source: 'manual',
      completedAt: input.status === 'completed' ? now : null,
      createdByStaffId: operator.staffId,
      createdAt: now,
      updatedAt: now,
    })

    for (const file of input.files) {
      const buffer = Buffer.from(file.fileBase64, 'base64')
      validateVoucherFile(file, buffer)
      const storageUri = await saveMerchantAttachmentFile({
        kind: 'recharge',
        merchantId,
        parentId: rechargeId,
        fileName: file.fileName,
        buffer,
        mimeType: file.mimeType,
      })
      await db.insert(merchantRechargeAttachment).values({
        id: newId(),
        rechargeId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: buffer.length,
        storageUri,
        uploadedByStaffId: operator.staffId,
      })
    }

    await db.insert(merchantRechargeAuditLog).values({
      id: newId(),
      rechargeId,
      merchantId,
      action: 'create',
      operatorStaffId: operator.staffId,
      operatorName: operator.operatorName,
      occurredAt: now,
      remark: `手工录入充值记录，凭证 ${input.files.length} 个`,
    })

    await db.insert(merchantActivity).values({
      id: newId(),
      merchantId,
      type: 'recharge_created',
      title: `新增充值记录 ¥${input.amount.toLocaleString('zh-CN')}`,
      description: `${input.paymentMethod} · ${input.status === 'completed' ? '已完成' : input.status === 'pending' ? '待支付' : '已取消'}`,
      authorStaffId: operator.staffId,
      authorName: operator.operatorName,
      authorRole: 'staff',
      refDomain: 'recharge',
      refId: rechargeId,
      occurredAt: now,
      createdAt: now,
    })

    return loadRechargeWithAttachments(rechargeId)
  },

  async update(
    rechargeId: string,
    input: MerchantRechargeWriteInput,
    user: { id: string; email?: string | null; name?: string | null },
  ) {
    const prev = await db.query.merchantRechargeRecord.findFirst({
      where: eq(merchantRechargeRecord.id, rechargeId),
    })
    if (!prev) throw new Error('充值记录不存在')
    if (prev.source === 'manual' && input.files.length === 0 && !(input.keepAttachmentIds?.length)) {
      const existing = await db
        .select({ id: merchantRechargeAttachment.id })
        .from(merchantRechargeAttachment)
        .where(eq(merchantRechargeAttachment.rechargeId, rechargeId))
      const keep = new Set(input.keepAttachmentIds ?? [])
      const remaining = existing.filter((e) => keep.has(e.id)).length + input.files.length
      if (remaining === 0) throw new Error('请至少保留 1 个充值凭证')
    }

    const operator = await resolveOperator(user)
    const now = new Date()
    const changes: Record<string, { from: unknown; to: unknown }> = {}

    if (Number(prev.amount) !== input.amount) {
      changes.amount = { from: Number(prev.amount), to: input.amount }
    }
    if (prev.paymentMethod !== input.paymentMethod) {
      changes.paymentMethod = { from: prev.paymentMethod, to: input.paymentMethod }
    }
    if (prev.status !== input.status) changes.status = { from: prev.status, to: input.status }
    if ((prev.transactionId ?? '') !== (input.transactionId ?? '')) {
      changes.transactionId = { from: prev.transactionId ?? '', to: input.transactionId ?? '' }
    }
    if (String(prev.rechargeDate) !== input.rechargeDate) {
      changes.rechargeDate = { from: String(prev.rechargeDate), to: input.rechargeDate }
    }
    if ((prev.remark ?? '') !== (input.remark ?? '')) {
      changes.remark = { from: prev.remark ?? '', to: input.remark ?? '' }
    }

    await db
      .update(merchantRechargeRecord)
      .set({
        amount: String(input.amount),
        paymentMethod: input.paymentMethod,
        status: input.status,
        transactionId: input.transactionId ?? null,
        rechargeDate: input.rechargeDate,
        remark: input.remark ?? null,
        updatedByStaffId: operator.staffId,
        updatedAt: now,
        completedAt:
          input.status === 'completed'
            ? prev.completedAt ?? now
            : input.status === 'pending'
              ? null
              : prev.completedAt,
      })
      .where(eq(merchantRechargeRecord.id, rechargeId))

    const keepIds = new Set(input.keepAttachmentIds ?? [])
    const existingAttachments = await db
      .select()
      .from(merchantRechargeAttachment)
      .where(eq(merchantRechargeAttachment.rechargeId, rechargeId))

    for (const att of existingAttachments) {
      if (!keepIds.has(att.id)) {
        await db
          .delete(merchantRechargeAttachment)
          .where(eq(merchantRechargeAttachment.id, att.id))
      }
    }

    for (const file of input.files) {
      const buffer = Buffer.from(file.fileBase64, 'base64')
      validateVoucherFile(file, buffer)
      const storageUri = await saveMerchantAttachmentFile({
        kind: 'recharge',
        merchantId: prev.merchantId,
        parentId: rechargeId,
        fileName: file.fileName,
        buffer,
        mimeType: file.mimeType,
      })
      await db.insert(merchantRechargeAttachment).values({
        id: newId(),
        rechargeId,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: buffer.length,
        storageUri,
        uploadedByStaffId: operator.staffId,
      })
    }

    const finalAttachments = await db
      .select({ id: merchantRechargeAttachment.id })
      .from(merchantRechargeAttachment)
      .where(eq(merchantRechargeAttachment.rechargeId, rechargeId))
    changes.attachments = {
      from: `${existingAttachments.length} 个`,
      to: `${finalAttachments.length} 个`,
    }

    await db.insert(merchantRechargeAuditLog).values({
      id: newId(),
      rechargeId,
      merchantId: prev.merchantId,
      action: 'update',
      operatorStaffId: operator.staffId,
      operatorName: operator.operatorName,
      occurredAt: now,
      changes: Object.keys(changes).length ? changes : undefined,
      remark: '修改充值记录',
    })

    await db.insert(merchantActivity).values({
      id: newId(),
      merchantId: prev.merchantId,
      type: 'recharge_updated',
      title: `修改充值记录 ¥${input.amount.toLocaleString('zh-CN')}`,
      description:
        Object.keys(changes).length > 0
          ? `变更：${Object.keys(changes).join('、')}`
          : undefined,
      authorStaffId: operator.staffId,
      authorName: operator.operatorName,
      authorRole: 'staff',
      refDomain: 'recharge',
      refId: rechargeId,
      occurredAt: now,
      createdAt: now,
    })

    return loadRechargeWithAttachments(rechargeId)
  },

  async getAttachmentForDownload(attachmentId: string) {
    const row = await db.query.merchantRechargeAttachment.findFirst({
      where: eq(merchantRechargeAttachment.id, attachmentId),
    })
    if (!row) return null
    const { readMerchantAttachmentFile } = await import('./merchant-attachment-storage')
    const buffer = await readMerchantAttachmentFile(row.storageUri)
    return {
      buffer,
      fileName: row.fileName,
      mimeType: row.mimeType ?? 'application/octet-stream',
    }
  },
}
