import { db } from '@/lib/db'
import {
  merchantActivity,
  merchantActivityAttachment,
  merchantContact,
  merchantRechargeAttachment,
  merchantRechargeRecord,
} from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

export async function resolveMerchantIdForContact(contactId: string): Promise<string | null> {
  const row = await db.query.merchantContact.findFirst({
    where: eq(merchantContact.id, contactId),
    columns: { merchantId: true },
  })
  return row?.merchantId ?? null
}

export async function resolveMerchantIdForRecharge(rechargeId: string): Promise<string | null> {
  const row = await db.query.merchantRechargeRecord.findFirst({
    where: eq(merchantRechargeRecord.id, rechargeId),
    columns: { merchantId: true },
  })
  return row?.merchantId ?? null
}

export async function resolveMerchantIdForAttachment(attachmentId: string): Promise<string | null> {
  const activityAtt = await db.query.merchantActivityAttachment.findFirst({
    where: eq(merchantActivityAttachment.id, attachmentId),
    columns: { activityId: true },
  })
  if (activityAtt) {
    const activity = await db.query.merchantActivity.findFirst({
      where: eq(merchantActivity.id, activityAtt.activityId),
      columns: { merchantId: true },
    })
    return activity?.merchantId ?? null
  }

  const rechargeAtt = await db.query.merchantRechargeAttachment.findFirst({
    where: eq(merchantRechargeAttachment.id, attachmentId),
    columns: { rechargeId: true },
  })
  if (rechargeAtt) {
    const recharge = await db.query.merchantRechargeRecord.findFirst({
      where: eq(merchantRechargeRecord.id, rechargeAtt.rechargeId),
      columns: { merchantId: true },
    })
    return recharge?.merchantId ?? null
  }

  return null
}
