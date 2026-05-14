import { db } from '@/lib/db'
import { userInvitationCodes, userInvitationRelations, user } from '@workspace/db/schema'
import { and, eq, sql } from 'drizzle-orm'

/**
 * 生成唯一的邀请码
 * 使用6-8位随机字符串（字母+数字）
 */
function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const length = Math.floor(Math.random() * 3) + 6 // 6-8位
  let code = ''

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return code
}

/**
 * 为用户生成邀请码
 */
export async function generateUserInvitationCode(
  userId: string,
  options: {
    maxUsage?: number
    expiresAt?: Date
  } = {}
) {
  // 检查用户是否已有邀请码
  const existingCode = await db.query.userInvitationCodes.findFirst({
    where: eq(userInvitationCodes.userId, userId),
  })

  if (existingCode) {
    // 如果已有邀请码，直接返回
    return existingCode
  }

  // 生成唯一的邀请码
  let code: string
  let attempts = 0
  const maxAttempts = 10

  do {
    code = generateInvitationCode()
    attempts++

    const existing = await db.query.userInvitationCodes.findFirst({
      where: eq(userInvitationCodes.code, code),
    })

    if (!existing) break
  } while (attempts < maxAttempts)

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique invitation code')
  }

  // 创建邀请码记录
  const [newCode] = await db
    .insert(userInvitationCodes)
    .values({
      code: code!,
      userId,
      maxUsage: options.maxUsage,
      expiresAt: options.expiresAt,
    })
    .returning()

  return newCode
}

/**
 * 验证邀请码
 */
export async function verifyInvitationCode(code: string) {
  const invitationCode = await db.query.userInvitationCodes.findFirst({
    where: and(
      eq(userInvitationCodes.code, code),
      eq(userInvitationCodes.isActive, true)
    ),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })

  if (!invitationCode) {
    return { valid: false }
  }

  // 检查是否过期
  if (invitationCode.expiresAt && invitationCode.expiresAt < new Date()) {
    return { valid: false, reason: 'expired' }
  }

  // 检查使用次数限制
  if (
    invitationCode.maxUsage &&
    invitationCode.usageCount >= invitationCode.maxUsage
  ) {
    return { valid: false, reason: 'usage_limit_exceeded' }
  }

  return {
    valid: true,
    inviter: invitationCode.user,
    codeId: invitationCode.id,
  }
}

/**
 * 处理邀请码，建立邀请关系
 */
export async function processInvitationCode(inviteeId: string, code: string) {
  // 验证邀请码
  const verification = await verifyInvitationCode(code)
  if (!verification.valid) {
    throw new Error('Invalid invitation code')
  }

  const { inviter, codeId } = verification

  // 检查被邀请者是否已有邀请关系
  const existingRelation = await db.query.userInvitationRelations.findFirst({
    where: eq(userInvitationRelations.inviteeId, inviteeId),
  })

  if (existingRelation) {
    // 如果已有邀请关系，忽略新邀请码
    return { success: false, reason: 'already_invited' }
  }

  // 检查是否是自己邀请自己
  if (inviter!.id === inviteeId) {
    throw new Error('Cannot invite yourself')
  }

  // 开始事务
  await db.transaction(async (tx) => {
    // 创建邀请关系
    await tx.insert(userInvitationRelations).values({
      inviterId: inviter!.id,
      inviteeId,
      invitationCodeId: codeId,
    })

    // 增加邀请码使用次数
    await tx
      .update(userInvitationCodes)
      .set({
        usageCount: sql`${userInvitationCodes.usageCount} + 1`,
      })
      .where(eq(userInvitationCodes.id, codeId!))

    // 处理奖励机制
    await processInvitationReward(inviter!.id, inviteeId)
  })

  return { success: true, inviter: inviter! }
}

/**
 * 获取用户的邀请统计
 */
export async function getUserInvitationStats(userId: string) {
  // 获取用户的邀请码
  const userCode = await db.query.userInvitationCodes.findFirst({
    where: eq(userInvitationCodes.userId, userId),
  })

  // 获取邀请统计
  const [stats] = await db
    .select({
      totalInvited: sql<number>`count(*)`,
    })
    .from(userInvitationRelations)
    .where(eq(userInvitationRelations.inviterId, userId))

  // 获取被邀请的用户列表
  const invitees = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      joinedAt: userInvitationRelations.createdAt,
    })
    .from(userInvitationRelations)
    .innerJoin(user, eq(userInvitationRelations.inviteeId, user.id))
    .where(eq(userInvitationRelations.inviterId, userId))
    .orderBy(userInvitationRelations.createdAt)

  return {
    code: userCode?.code || null,
    usageCount: userCode?.usageCount || 0,
    totalInvited: stats?.totalInvited || 0,
    invitees,
  }
}

/**
 * 获取用户的邀请码信息
 */
export async function getUserInvitationCode(userId: string) {
  const userCode = await db.query.userInvitationCodes.findFirst({
    where: eq(userInvitationCodes.userId, userId),
  })

  if (!userCode) {
    return null
  }

  return {
    code: userCode.code,
    usageCount: userCode.usageCount,
    maxUsage: userCode.maxUsage,
    expiresAt: userCode.expiresAt,
    isActive: userCode.isActive,
  }
}

/**
 * 处理邀请奖励
 * 为邀请者发放奖励（如积分、优惠券等）
 */
async function processInvitationReward(inviterId: string, inviteeId: string) {
  try {
    // TODO: 根据业务需求实现具体的奖励逻辑
    // 这里可以发放积分、优惠券、会员时长等奖励

    // 示例：为邀请者增加积分奖励
    // await addCreditsToUser(inviterId, 100) // 奖励100积分

    // 更新邀请关系状态为已奖励
    await db
      .update(userInvitationRelations)
      .set({
        rewardGranted: true,
      })
      .where(
        and(
          eq(userInvitationRelations.inviterId, inviterId),
          eq(userInvitationRelations.inviteeId, inviteeId)
        )
      )

    console.log(`Reward granted to user ${inviterId} for inviting ${inviteeId}`)
  } catch (error) {
    console.error('Failed to process invitation reward:', error)
    // 奖励失败不阻断流程，可以后续重试
  }
}
