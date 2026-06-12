import { db } from '@/lib/db'
import type {
  SupplyChainLeadActivityDto,
  SupplyChainLeadCardTypeFilterOption,
  SupplyChainLeadContactDto,
  SupplyChainLeadGpuSnapshotDto,
  SupplyChainLeadListItemDto,
  SupplyChainLeadStatsDto,
} from '@/lib/types/supply-chain-lead-api'
import type {
  DatacenterDockingScope,
  SupplyChainLeadAuthorRole,
  SupplyChainLeadPriority,
  SupplyChainLeadStatus,
  SupplyChainLeadType,
} from '@/lib/supply-chain-leads/types'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import {
  gpuCardType,
  supplyChainLead,
  supplyChainLeadActivity,
  supplyChainLeadContact,
  supplyChainLeadGpuSnapshot,
  supplyChainLeadTag,
  supplyChainLeadTagAssignment,
  userStaff,
} from '@workspace/db/schema'
import {
  and,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
  sum,
} from 'drizzle-orm'

const logTag = 'supply-chain-leads'

function newId() {
  return crypto.randomUUID()
}

function toIso(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString()
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString()
}

function toDateOnly(d: Date | string | null | undefined): string | undefined {
  if (!d) return undefined
  if (typeof d === 'string') return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

function mapContactRow(row: typeof supplyChainLeadContact.$inferSelect): SupplyChainLeadContactDto {
  return {
    name: row.name,
    title: row.title,
    phone: row.phone,
    email: row.email,
    wechat: row.wechatId,
  }
}

function mapGpuRow(row: typeof supplyChainLeadGpuSnapshot.$inferSelect): SupplyChainLeadGpuSnapshotDto {
  return {
    id: row.id,
    cardType: row.cardTypeName,
    gpuCardTypeId: row.gpuCardTypeId,
    total: row.totalQuantity,
    idle: row.idleQuantity,
    reserved: row.reservedQuantity,
    inUse: row.inUseQuantity,
    unitPrice: row.unitPricePerHour != null ? Number(row.unitPricePerHour) : null,
    availableTime: row.availableTime,
    notes: row.notes,
    updatedAt: toIso(row.snapshotAt),
  }
}

function mapLeadRow(
  row: typeof supplyChainLead.$inferSelect,
  ownerName: string,
  contacts: (typeof supplyChainLeadContact.$inferSelect)[],
  gpuRows: (typeof supplyChainLeadGpuSnapshot.$inferSelect)[],
  tags: string[],
): SupplyChainLeadListItemDto {
  const resource = contacts.find((c) => c.contactRole === 'resource' && c.isPrimary)
    ?? contacts.find((c) => c.contactRole === 'resource')
  const business = contacts.find((c) => c.contactRole === 'business' && c.isPrimary)
    ?? contacts.find((c) => c.contactRole === 'business')

  return {
    id: row.id,
    type: row.type as SupplyChainLeadType,
    name: row.name,
    code: row.code,
    status: row.status as SupplyChainLeadStatus,
    priority: row.priority as SupplyChainLeadPriority,
    supplierName: row.supplierNameText,
    location: row.address,
    province: row.province,
    city: row.city,
    description: row.description,
    source: row.source,
    ownerStaffName: ownerName || '—',
    resourceContact: resource
      ? mapContactRow(resource)
      : { name: '—' },
    businessContact: business ? mapContactRow(business) : null,
    gpuResources: gpuRows.map(mapGpuRow),
    dockingScope: (row.dockingScope as DatacenterDockingScope | null) ?? null,
    tags,
    estimatedOnlineDate: toDateOnly(row.estimatedOnlineDate),
    convertedSupplierId: row.convertedSupplierId,
    convertedDataCenterId: row.convertedDataCenterId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    lastActivityAt: toIso(row.lastActivityAt),
  }
}

async function resolveStaffId(user: {
  id: string
  email?: string | null
  phoneNumber?: string | null
}): Promise<string | null> {
  return staffDataAccess.resolveStaffIdForAuthUser(user)
}

async function loadLeadBundles(leadIds: string[]) {
  if (leadIds.length === 0) {
    return {
      contactsByLead: new Map<string, (typeof supplyChainLeadContact.$inferSelect)[]>(),
      gpuByLead: new Map<string, (typeof supplyChainLeadGpuSnapshot.$inferSelect)[]>(),
      tagsByLead: new Map<string, string[]>(),
      ownerNames: new Map<string, string>(),
    }
  }

  const [contacts, gpuRows, tagRows, leads] = await Promise.all([
    db.select().from(supplyChainLeadContact).where(inArray(supplyChainLeadContact.leadId, leadIds)),
    db
      .select()
      .from(supplyChainLeadGpuSnapshot)
      .where(inArray(supplyChainLeadGpuSnapshot.leadId, leadIds)),
    db
      .select({
        leadId: supplyChainLeadTagAssignment.leadId,
        tagName: supplyChainLeadTag.name,
      })
      .from(supplyChainLeadTagAssignment)
      .innerJoin(supplyChainLeadTag, eq(supplyChainLeadTagAssignment.tagId, supplyChainLeadTag.id))
      .where(inArray(supplyChainLeadTagAssignment.leadId, leadIds)),
    db
      .select({
        id: supplyChainLead.id,
        ownerStaffId: supplyChainLead.ownerStaffId,
      })
      .from(supplyChainLead)
      .where(inArray(supplyChainLead.id, leadIds)),
  ])

  const ownerStaffIds = [
    ...new Set(leads.map((l) => l.ownerStaffId).filter((id): id is string => Boolean(id))),
  ]
  const staffRows =
    ownerStaffIds.length > 0
      ? await db
          .select({ id: userStaff.id, displayName: userStaff.displayName })
          .from(userStaff)
          .where(inArray(userStaff.id, ownerStaffIds))
      : []
  const staffNameById = new Map(staffRows.map((s) => [s.id, s.displayName]))

  const contactsByLead = new Map<string, (typeof supplyChainLeadContact.$inferSelect)[]>()
  for (const c of contacts) {
    const list = contactsByLead.get(c.leadId) ?? []
    list.push(c)
    contactsByLead.set(c.leadId, list)
  }

  const gpuByLead = new Map<string, (typeof supplyChainLeadGpuSnapshot.$inferSelect)[]>()
  for (const g of gpuRows) {
    const list = gpuByLead.get(g.leadId) ?? []
    list.push(g)
    gpuByLead.set(g.leadId, list)
  }

  const tagsByLead = new Map<string, string[]>()
  for (const t of tagRows) {
    const list = tagsByLead.get(t.leadId) ?? []
    list.push(t.tagName)
    tagsByLead.set(t.leadId, list)
  }

  const ownerNames = new Map<string, string>()
  for (const l of leads) {
    ownerNames.set(
      l.id,
      l.ownerStaffId ? (staffNameById.get(l.ownerStaffId) ?? '—') : '—',
    )
  }

  return { contactsByLead, gpuByLead, tagsByLead, ownerNames }
}

async function upsertTagsForLead(leadId: string, tagNames: string[]) {
  const normalized = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))]
  await db
    .delete(supplyChainLeadTagAssignment)
    .where(eq(supplyChainLeadTagAssignment.leadId, leadId))

  if (normalized.length === 0) return

  for (const name of normalized) {
    const [existing] = await db
      .select()
      .from(supplyChainLeadTag)
      .where(eq(supplyChainLeadTag.name, name))
      .limit(1)

    const tagId = existing?.id ?? newId()
    if (!existing) {
      await db.insert(supplyChainLeadTag).values({ id: tagId, name })
    }

    await db
      .insert(supplyChainLeadTagAssignment)
      .values({ leadId, tagId })
      .onConflictDoNothing()
  }
}

async function resolveGpuCardTypeId(cardTypeName: string): Promise<string | null> {
  const [row] = await db
    .select({ id: gpuCardType.id })
    .from(gpuCardType)
    .where(eq(gpuCardType.name, cardTypeName.trim()))
    .limit(1)
  return row?.id ?? null
}

async function touchLeadActivity(leadId: string, at = new Date()) {
  await db
    .update(supplyChainLead)
    .set({ lastActivityAt: at, updatedAt: at })
    .where(eq(supplyChainLead.id, leadId))
}

async function insertSystemActivity(
  leadId: string,
  input: {
    type: string
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
) {
  const now = new Date()
  await db.insert(supplyChainLeadActivity).values({
    id: newId(),
    leadId,
    type: input.type,
    title: input.title,
    description: input.description,
    authorName: '系统',
    authorRole: 'system',
    metadata: input.metadata ?? null,
    occurredAt: now,
    createdAt: now,
  })
  await touchLeadActivity(leadId, now)
}

export type SupplyChainLeadCreateInput = {
  type: SupplyChainLeadType
  name: string
  priority: SupplyChainLeadPriority
  supplierNameText?: string
  dockingScope?: DatacenterDockingScope
  province?: string
  city?: string
  address?: string
  source?: string
  description?: string
  estimatedOnlineDate?: string
  resourceContact: SupplyChainLeadContactDto
  businessContact?: SupplyChainLeadContactDto
  gpuSnapshots?: Array<{
    cardType: string
    total: number
    idle: number
    reserved?: number
    inUse?: number
    unitPrice?: number
    availableTime?: string
    notes?: string
  }>
  tags?: string[]
}

export type SupplyChainLeadUpdateInput = Omit<SupplyChainLeadCreateInput, 'type'>

export type SupplyChainLeadListInput = {
  search?: string
  type?: SupplyChainLeadType | 'all'
  status?: SupplyChainLeadStatus | 'all'
  priority?: SupplyChainLeadPriority | 'all'
  cardTypeNames?: string[]
  ownerStaffId?: string
  page?: number
  pageSize?: number
}

export const supplyChainLeadsDataAccess = {
  async list(input: SupplyChainLeadListInput): Promise<{
    items: SupplyChainLeadListItemDto[]
    total: number
  }> {
    const page = input.page ?? 1
    const pageSize = input.pageSize ?? 20
    const offset = (page - 1) * pageSize

    const conditions = []

    if (input.type && input.type !== 'all') {
      conditions.push(eq(supplyChainLead.type, input.type))
    }
    if (input.status && input.status !== 'all') {
      conditions.push(eq(supplyChainLead.status, input.status))
    }
    if (input.priority && input.priority !== 'all') {
      conditions.push(eq(supplyChainLead.priority, input.priority))
    }
    if (input.ownerStaffId) {
      conditions.push(eq(supplyChainLead.ownerStaffId, input.ownerStaffId))
    }

    const q = input.search?.trim()
    if (q) {
      const pattern = `%${q}%`
      conditions.push(
        or(
          ilike(supplyChainLead.name, pattern),
          ilike(supplyChainLead.supplierNameText, pattern),
          ilike(supplyChainLead.city, pattern),
          ilike(supplyChainLead.address, pattern),
        )!,
      )
    }

    if (input.cardTypeNames && input.cardTypeNames.length > 0) {
      conditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(supplyChainLeadGpuSnapshot)
            .where(
              and(
                eq(supplyChainLeadGpuSnapshot.leadId, supplyChainLead.id),
                inArray(supplyChainLeadGpuSnapshot.cardTypeName, input.cardTypeNames),
              ),
            ),
        ),
      )
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [countRow] = await db
      .select({ total: count() })
      .from(supplyChainLead)
      .where(whereClause)

    const rows = await db
      .select()
      .from(supplyChainLead)
      .where(whereClause)
      .orderBy(desc(supplyChainLead.lastActivityAt))
      .limit(pageSize)
      .offset(offset)

    const leadIds = rows.map((r) => r.id)
    const bundles = await loadLeadBundles(leadIds)

    const items = rows.map((row) =>
      mapLeadRow(
        row,
        bundles.ownerNames.get(row.id) ?? '—',
        bundles.contactsByLead.get(row.id) ?? [],
        bundles.gpuByLead.get(row.id) ?? [],
        bundles.tagsByLead.get(row.id) ?? [],
      ),
    )

    return { items, total: Number(countRow?.total ?? 0) }
  },

  async getById(id: string): Promise<SupplyChainLeadListItemDto | null> {
    const [row] = await db.select().from(supplyChainLead).where(eq(supplyChainLead.id, id)).limit(1)
    if (!row) return null

    const bundles = await loadLeadBundles([id])
    return mapLeadRow(
      row,
      bundles.ownerNames.get(id) ?? '—',
      bundles.contactsByLead.get(id) ?? [],
      bundles.gpuByLead.get(id) ?? [],
      bundles.tagsByLead.get(id) ?? [],
    )
  },

  async stats(): Promise<SupplyChainLeadStatsDto> {
    const [totals] = await db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${supplyChainLead.status} not in ('converted', 'lost'))`,
        datacenters: sql<number>`count(*) filter (where ${supplyChainLead.type} = 'datacenter')`,
        suppliers: sql<number>`count(*) filter (where ${supplyChainLead.type} = 'supplier')`,
      })
      .from(supplyChainLead)

    const [gpu] = await db
      .select({
        gpuTotal: sum(supplyChainLeadGpuSnapshot.totalQuantity),
        gpuIdle: sum(supplyChainLeadGpuSnapshot.idleQuantity),
      })
      .from(supplyChainLeadGpuSnapshot)
      .innerJoin(supplyChainLead, eq(supplyChainLeadGpuSnapshot.leadId, supplyChainLead.id))
      .where(eq(supplyChainLead.type, 'datacenter'))

    return {
      total: Number(totals?.total ?? 0),
      active: Number(totals?.active ?? 0),
      datacenters: Number(totals?.datacenters ?? 0),
      suppliers: Number(totals?.suppliers ?? 0),
      gpuTotal: Number(gpu?.gpuTotal ?? 0),
      gpuIdle: Number(gpu?.gpuIdle ?? 0),
    }
  },

  async listCardTypeFilterOptions(): Promise<SupplyChainLeadCardTypeFilterOption[]> {
    const rows = await db
      .select({
        name: supplyChainLeadGpuSnapshot.cardTypeName,
        leadCount: sql<number>`count(distinct ${supplyChainLeadGpuSnapshot.leadId})`,
      })
      .from(supplyChainLeadGpuSnapshot)
      .groupBy(supplyChainLeadGpuSnapshot.cardTypeName)
      .orderBy(supplyChainLeadGpuSnapshot.cardTypeName)

    return rows.map((r) => ({
      name: r.name,
      leadCount: Number(r.leadCount),
    }))
  },

  async create(
    input: SupplyChainLeadCreateInput,
    user: { id: string; email?: string | null; phoneNumber?: string | null; name?: string | null },
  ): Promise<SupplyChainLeadListItemDto> {
    const staffId = await resolveStaffId(user)
    const now = new Date()
    const leadId = newId()

    if (input.type === 'datacenter' && !input.dockingScope) {
      throw new Error('机房线索请选择对接范围')
    }
    if (!input.resourceContact.name?.trim()) {
      throw new Error('请填写资源对接人')
    }

    await db.transaction(async (tx) => {
      await tx.insert(supplyChainLead).values({
        id: leadId,
        type: input.type,
        name: input.name.trim(),
        status: 'new',
        priority: input.priority,
        description: input.description?.trim() || null,
        source: input.source?.trim() || null,
        province: input.province?.trim() || null,
        city: input.city?.trim() || null,
        address: input.address?.trim() || null,
        supplierNameText:
          input.type === 'datacenter' ? input.supplierNameText?.trim() || null : null,
        dockingScope: input.type === 'datacenter' ? input.dockingScope ?? 'normal' : null,
        estimatedOnlineDate: input.estimatedOnlineDate || null,
        ownerStaffId: staffId,
        createdBy: staffId,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      })

      await tx.insert(supplyChainLeadContact).values({
        id: newId(),
        leadId,
        contactRole: 'resource',
        name: input.resourceContact.name.trim(),
        title: input.resourceContact.title?.trim() || '资源对接人',
        phone: input.resourceContact.phone?.trim() || null,
        email: input.resourceContact.email?.trim() || null,
        wechatId: input.resourceContact.wechat?.trim() || null,
        isPrimary: true,
      })

      if (input.businessContact?.name?.trim()) {
        await tx.insert(supplyChainLeadContact).values({
          id: newId(),
          leadId,
          contactRole: 'business',
          name: input.businessContact.name.trim(),
          title: input.businessContact.title?.trim() || null,
          phone: input.businessContact.phone?.trim() || null,
          email: input.businessContact.email?.trim() || null,
          wechatId: input.businessContact.wechat?.trim() || null,
          isPrimary: true,
        })
      }

      for (const snap of input.gpuSnapshots ?? []) {
        if (!snap.cardType.trim()) continue
        const total = snap.total ?? 0
        const idle = snap.idle ?? 0
        const reserved = snap.reserved ?? 0
        const inUse = snap.inUse ?? Math.max(0, total - idle - reserved)
        const gpuCardTypeId = await resolveGpuCardTypeId(snap.cardType)

        await tx.insert(supplyChainLeadGpuSnapshot).values({
          id: newId(),
          leadId,
          gpuCardTypeId,
          cardTypeName: snap.cardType.trim(),
          totalQuantity: total,
          idleQuantity: idle,
          reservedQuantity: reserved,
          inUseQuantity: inUse,
          unitPricePerHour: snap.unitPrice != null ? String(snap.unitPrice) : null,
          availableTime: snap.availableTime?.trim() || null,
          notes: snap.notes?.trim() || null,
          source: 'manual',
          snapshotAt: now,
          createdBy: staffId,
        })
      }

      await tx.insert(supplyChainLeadActivity).values({
        id: newId(),
        leadId,
        type: 'comment',
        title: '线索登记',
        description: `登记${input.type === 'supplier' ? '供应商' : '机房'}线索「${input.name.trim()}」。`,
        authorStaffId: staffId,
        authorName: user.name ?? '当前用户',
        authorRole: 'supply',
        occurredAt: now,
        createdAt: now,
      })
    })

    if (input.tags?.length) {
      await upsertTagsForLead(leadId, input.tags)
    }

    const created = await this.getById(leadId)
    if (!created) throw new Error('线索创建失败')
    supplierLog(logTag, 'create', { leadId })
    return created
  },

  async update(
    leadId: string,
    input: SupplyChainLeadUpdateInput,
    user: { id: string; email?: string | null; phoneNumber?: string | null; name?: string | null },
  ): Promise<SupplyChainLeadListItemDto> {
    const staffId = await resolveStaffId(user)
    const [existing] = await db
      .select()
      .from(supplyChainLead)
      .where(eq(supplyChainLead.id, leadId))
      .limit(1)

    if (!existing) throw new Error('线索不存在')
    if (existing.status === 'converted') {
      throw new Error('已转正线索不可编辑')
    }
    if (existing.type === 'datacenter' && !input.dockingScope) {
      throw new Error('机房线索请选择对接范围')
    }
    if (!input.resourceContact.name?.trim()) {
      throw new Error('请填写资源对接人')
    }

    const now = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(supplyChainLead)
        .set({
          name: input.name.trim(),
          priority: input.priority,
          description: input.description?.trim() || null,
          source: input.source?.trim() || null,
          province: input.province?.trim() || null,
          city: input.city?.trim() || null,
          address: input.address?.trim() || null,
          supplierNameText:
            existing.type === 'datacenter' ? input.supplierNameText?.trim() || null : null,
          dockingScope:
            existing.type === 'datacenter' ? input.dockingScope ?? 'normal' : null,
          estimatedOnlineDate: input.estimatedOnlineDate || null,
          updatedAt: now,
          lastActivityAt: now,
        })
        .where(eq(supplyChainLead.id, leadId))

      await tx
        .delete(supplyChainLeadContact)
        .where(
          and(
            eq(supplyChainLeadContact.leadId, leadId),
            inArray(supplyChainLeadContact.contactRole, ['resource', 'business']),
          ),
        )

      await tx.insert(supplyChainLeadContact).values({
        id: newId(),
        leadId,
        contactRole: 'resource',
        name: input.resourceContact.name.trim(),
        title: input.resourceContact.title?.trim() || '资源对接人',
        phone: input.resourceContact.phone?.trim() || null,
        email: input.resourceContact.email?.trim() || null,
        wechatId: input.resourceContact.wechat?.trim() || null,
        isPrimary: true,
      })

      if (input.businessContact?.name?.trim()) {
        await tx.insert(supplyChainLeadContact).values({
          id: newId(),
          leadId,
          contactRole: 'business',
          name: input.businessContact.name.trim(),
          title: input.businessContact.title?.trim() || null,
          phone: input.businessContact.phone?.trim() || null,
          email: input.businessContact.email?.trim() || null,
          wechatId: input.businessContact.wechat?.trim() || null,
          isPrimary: true,
        })
      }

      await tx
        .delete(supplyChainLeadGpuSnapshot)
        .where(eq(supplyChainLeadGpuSnapshot.leadId, leadId))

      for (const snap of input.gpuSnapshots ?? []) {
        if (!snap.cardType.trim()) continue
        const total = snap.total ?? 0
        const idle = snap.idle ?? 0
        const reserved = snap.reserved ?? 0
        const inUse = snap.inUse ?? Math.max(0, total - idle - reserved)
        const gpuCardTypeId = await resolveGpuCardTypeId(snap.cardType)

        await tx.insert(supplyChainLeadGpuSnapshot).values({
          id: newId(),
          leadId,
          gpuCardTypeId,
          cardTypeName: snap.cardType.trim(),
          totalQuantity: total,
          idleQuantity: idle,
          reservedQuantity: reserved,
          inUseQuantity: inUse,
          unitPricePerHour: snap.unitPrice != null ? String(snap.unitPrice) : null,
          availableTime: snap.availableTime?.trim() || null,
          notes: snap.notes?.trim() || null,
          source: 'manual',
          snapshotAt: now,
          createdBy: staffId,
        })
      }
    })

    await upsertTagsForLead(leadId, input.tags ?? [])

    await insertSystemActivity(leadId, {
      type: 'comment',
      title: '线索信息更新',
      description: `更新了线索「${input.name.trim()}」的基本信息与资源数据。`,
    })

    const updated = await this.getById(leadId)
    if (!updated) throw new Error('线索更新失败')
    supplierLog(logTag, 'update', { leadId })
    return updated
  },

  async updateStatus(
    leadId: string,
    status: SupplyChainLeadStatus,
    user: { id: string; email?: string | null; phoneNumber?: string | null; name?: string | null },
    lostReason?: string,
  ): Promise<void> {
    const [existing] = await db
      .select()
      .from(supplyChainLead)
      .where(eq(supplyChainLead.id, leadId))
      .limit(1)
    if (!existing) throw new Error('线索不存在')
    if (existing.status === 'converted') {
      throw new Error('已转正线索不可修改状态')
    }

    const now = new Date()
    await db
      .update(supplyChainLead)
      .set({
        status,
        lostReason: status === 'lost' ? lostReason?.trim() || null : null,
        lostAt: status === 'lost' ? now : null,
        updatedAt: now,
        lastActivityAt: now,
      })
      .where(eq(supplyChainLead.id, leadId))

    await insertSystemActivity(leadId, {
      type: 'stage_change',
      title: '状态变更',
      description: `线索状态已更新为「${status}」。`,
    })
    supplierLog(logTag, 'updateStatus', { leadId, status })
  },

  async listActivities(leadId: string, limit = 100): Promise<SupplyChainLeadActivityDto[]> {
    const rows = await db
      .select()
      .from(supplyChainLeadActivity)
      .where(eq(supplyChainLeadActivity.leadId, leadId))
      .orderBy(desc(supplyChainLeadActivity.occurredAt))
      .limit(limit)

    return rows.map((row) => ({
      id: row.id,
      leadId: row.leadId,
      type: row.type as SupplyChainLeadActivityDto['type'],
      title: row.title,
      description: row.description ?? '',
      author: row.authorName ?? '—',
      authorRole: (row.authorRole as SupplyChainLeadAuthorRole) ?? 'supply',
      authorStaffId: row.authorStaffId,
      createdAt: toIso(row.occurredAt),
      editedAt: row.updatedAt ? toIso(row.updatedAt) : null,
      metadata: row.metadata as Record<string, string | string[]> | null,
    }))
  },

  async createActivity(input: {
    leadId: string
    description: string
    user: { id: string; email?: string | null; phoneNumber?: string | null; name?: string | null }
  }): Promise<void> {
    const staffId = await resolveStaffId(input.user)
    if (!staffId) throw new Error('当前账号未关联员工信息')

    const staff = await db.query.userStaff.findFirst({
      where: eq(userStaff.id, staffId),
      columns: { displayName: true },
    })

    const now = new Date()
    await db.insert(supplyChainLeadActivity).values({
      id: newId(),
      leadId: input.leadId,
      type: 'comment',
      title: '评论',
      description: input.description.trim(),
      authorStaffId: staffId,
      authorName: staff?.displayName ?? input.user.name ?? '当前用户',
      authorRole: 'supply',
      occurredAt: now,
      createdAt: now,
    })
    await touchLeadActivity(input.leadId, now)
  },

  async updateActivity(input: {
    activityId: string
    description: string
    user: { id: string; email?: string | null; phoneNumber?: string | null }
  }): Promise<void> {
    const staffId = await resolveStaffId(input.user)
    if (!staffId) throw new Error('当前账号未关联员工信息')

    const [activity] = await db
      .select()
      .from(supplyChainLeadActivity)
      .where(eq(supplyChainLeadActivity.id, input.activityId))
      .limit(1)

    if (!activity) throw new Error('活动不存在')
    if (activity.type !== 'comment') throw new Error('仅评论可编辑')
    if (activity.authorRole === 'system') throw new Error('系统记录不可编辑')
    if (activity.authorStaffId !== staffId) throw new Error('只能编辑自己的评论')

    const now = new Date()
    await db
      .update(supplyChainLeadActivity)
      .set({
        description: input.description.trim(),
        updatedAt: now,
      })
      .where(eq(supplyChainLeadActivity.id, input.activityId))
  },
}
