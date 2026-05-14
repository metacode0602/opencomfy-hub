import { db } from '@/lib/db'
import { member, organization } from '@workspace/db/schema'
import { eq, inArray, and } from 'drizzle-orm'
import { getCurrentUser } from './users'

export async function getOrganizations() {
  const { currentUser } = await getCurrentUser()

  const members = await db.query.member.findMany({
    where: eq(member.userId, currentUser.id),
  })

  const organizations = await db.query.organization.findMany({
    where: inArray(
      organization.id,
      members.map((member: any) => member.organizationId)
    ),
  })

  return organizations
}

export async function getActiveOrganization(userId: string) {
  const memberUser = await db.query.member.findFirst({
    where: eq(member.userId, userId),
  })

  if (!memberUser) {
    return { organization: null, member: null }
  }

  const activeOrganization = await db.query.organization.findFirst({
    where: eq(organization.id, memberUser.organizationId),
  })

  return { organization: activeOrganization, member: memberUser }
}

/**
 * 获取用户的所有组织（审核通过的）
 * 使用直接的 SQL join 查询，避免关系查询的性能问题
 */
export async function getUserOrganizations(userId: string) {
  try {
    // 使用直接的 join 查询，性能更好
    const result = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        status: organization.status,
        entryApproved: organization.entryApproved,
        isCurrent: organization.isCurrent,
        role: member.role,
        memberId: member.id,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(
        and(
          eq(member.userId, userId),
          eq(organization.entryApproved, true),
          eq(organization.isCurrent, true)
        )
      )

    return result
  } catch (error) {
    console.error('获取用户组织失败:', error)
    return []
  }
}

export async function getOrganizationBySlug(slug: string) {
  try {
    const organizationBySlug = await db.query.organization.findFirst({
      where: eq(organization.slug, slug),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    })

    return organizationBySlug
  } catch (error) {
    console.error(error)
    return null
  }
}
