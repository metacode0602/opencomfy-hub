import { db } from '@/lib/db'
import { projectTag, projectTagAssignment } from '@workspace/db/schema'
import { asc, eq, inArray } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

export const DEFAULT_PROJECT_TAG_NAMES = [
  '销售新客',
  '平台老客',
  '公海池-无人跟踪',
  '中台直客',
  '产品直客',
] as const

export type ProjectTagOption = {
  id: string
  name: string
}

async function ensureDefaultTags(): Promise<void> {
  const existing = await db.select({ name: projectTag.name }).from(projectTag)
  const existingNames = new Set(existing.map((t) => t.name))
  const toInsert = DEFAULT_PROJECT_TAG_NAMES.filter((name) => !existingNames.has(name))
  if (toInsert.length === 0) return

  await db.insert(projectTag).values(
    toInsert.map((name, index) => ({
      id: newId(),
      name,
      sortOrder: index,
    })),
  )
}

export const projectTagsDataAccess = {
  async listAll(): Promise<ProjectTagOption[]> {
    await ensureDefaultTags()
    const rows = await db
      .select()
      .from(projectTag)
      .orderBy(asc(projectTag.sortOrder), asc(projectTag.name))
    return rows.map((r) => ({ id: r.id, name: r.name }))
  },

  async listByProjectId(projectId: string): Promise<ProjectTagOption[]> {
    const rows = await db
      .select({ id: projectTag.id, name: projectTag.name })
      .from(projectTagAssignment)
      .innerJoin(projectTag, eq(projectTagAssignment.tagId, projectTag.id))
      .where(eq(projectTagAssignment.projectId, projectId))
      .orderBy(asc(projectTag.sortOrder), asc(projectTag.name))
    return rows
  },

  async create(name: string): Promise<ProjectTagOption> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('标签名称不能为空')

    const existing = await db.query.projectTag.findFirst({
      where: eq(projectTag.name, trimmed),
    })
    if (existing) return { id: existing.id, name: existing.name }

    const id = newId()
    const existingTags = await db.select({ sortOrder: projectTag.sortOrder }).from(projectTag)
    const nextSortOrder =
      existingTags.length === 0
        ? 0
        : Math.max(...existingTags.map((t) => t.sortOrder)) + 1

    await db.insert(projectTag).values({
      id,
      name: trimmed,
      sortOrder: nextSortOrder,
    })
    return { id, name: trimmed }
  },

  async setForProject(projectId: string, tagIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(tagIds)]
    if (uniqueIds.length > 0) {
      const found = await db
        .select({ id: projectTag.id })
        .from(projectTag)
        .where(inArray(projectTag.id, uniqueIds))
      if (found.length !== uniqueIds.length) {
        throw new Error('存在无效的标签')
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(projectTagAssignment).where(eq(projectTagAssignment.projectId, projectId))
      if (uniqueIds.length === 0) return
      await tx.insert(projectTagAssignment).values(
        uniqueIds.map((tagId) => ({
          projectId,
          tagId,
        })),
      )
    })
  },
}
