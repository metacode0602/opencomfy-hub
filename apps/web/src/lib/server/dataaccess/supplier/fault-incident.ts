import { db } from '@/lib/db'
import { CLOSED_FAULT_STATUSES } from '@/lib/server/aggregation/overview-aggregation'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import type {
  FaultIncidentCloseInput,
  FaultIncidentCloseResult,
  FaultIncidentCreateInput,
  FaultIncidentCreateResult,
  FaultIncidentListItem,
} from '@/lib/types/fault-incident-api'
import { faultIncident, supplier, supplierActivity, supplierDevice } from '@workspace/db/schema'
import { and, desc, eq, ilike, inArray, notInArray, or } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function isClosedStatus(status: string) {
  return (CLOSED_FAULT_STATUSES as readonly string[]).includes(status)
}

function mapListRow(row: {
  id: string
  supplierId: string
  supplierName: string
  supplierShortName: string | null
  faultType: string
  supplierDeviceId: string | null
  deviceSn: string | null
  deviceAssetNo: string | null
  computeNodeId: string | null
  severity: string
  incidentStatus: string
  resolutionOutcome: string | null
  openedAt: Date
  closedAt: Date | null
}): FaultIncidentListItem {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    supplierShortName: row.supplierShortName,
    title: row.faultType,
    faultType: row.faultType,
    deviceId: row.supplierDeviceId,
    deviceSn: row.deviceSn,
    deviceAssetNo: row.deviceAssetNo,
    computeNodeId: row.computeNodeId,
    severity: row.severity,
    incidentStatus: row.incidentStatus,
    resolutionOutcome: row.resolutionOutcome,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
  }
}

async function assertDeviceBelongsToSupplier(supplierId: string, deviceId: string) {
  const [device] = await db
    .select({ id: supplierDevice.id })
    .from(supplierDevice)
    .where(and(eq(supplierDevice.id, deviceId), eq(supplierDevice.supplierId, supplierId)))
    .limit(1)
  if (!device) throw new Error('物理机不存在或不属于该供应商')
}

export const faultIncidentDataAccess = {
  async list(params: {
    search?: string
    status?: 'all' | '处理中' | '已关闭'
    supplierId?: string
  }): Promise<{ items: FaultIncidentListItem[]; total: number }> {
    const conditions = []

    if (params.supplierId) {
      conditions.push(eq(faultIncident.supplierId, params.supplierId))
    }

    if (params.status === '处理中') {
      conditions.push(notInArray(faultIncident.incidentStatus, [...CLOSED_FAULT_STATUSES]))
    } else if (params.status === '已关闭') {
      conditions.push(inArray(faultIncident.incidentStatus, [...CLOSED_FAULT_STATUSES]))
    }

    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`
      conditions.push(
        or(
          ilike(faultIncident.faultType, q),
          ilike(faultIncident.severity, q),
          ilike(supplier.shortName, q),
          ilike(supplier.name, q),
        )!,
      )
    }

    const rows = await db
      .select({
        id: faultIncident.id,
        supplierId: faultIncident.supplierId,
        supplierName: supplier.name,
        supplierShortName: supplier.shortName,
        faultType: faultIncident.faultType,
        supplierDeviceId: faultIncident.supplierDeviceId,
        deviceSn: supplierDevice.sn,
        deviceAssetNo: supplierDevice.assetNo,
        computeNodeId: faultIncident.computeNodeId,
        severity: faultIncident.severity,
        incidentStatus: faultIncident.incidentStatus,
        resolutionOutcome: faultIncident.resolutionOutcome,
        openedAt: faultIncident.openedAt,
        closedAt: faultIncident.closedAt,
      })
      .from(faultIncident)
      .innerJoin(supplier, eq(faultIncident.supplierId, supplier.id))
      .leftJoin(supplierDevice, eq(faultIncident.supplierDeviceId, supplierDevice.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(faultIncident.openedAt))

    const items = rows.map(mapListRow)
    return { items, total: items.length }
  },

  async create(input: FaultIncidentCreateInput): Promise<FaultIncidentCreateResult> {
    supplierLog('fault-incident', 'create start', { supplierId: input.supplierId })

    const supplierRow = await db.query.supplier.findFirst({
      where: eq(supplier.id, input.supplierId),
      columns: { id: true },
    })
    if (!supplierRow) throw new Error('供应商不存在')

    const title = input.title.trim()
    const deviceId = input.deviceId?.trim() || null
    const computeNodeId = input.computeNodeId?.trim() || null

    if (deviceId) {
      await assertDeviceBelongsToSupplier(input.supplierId, deviceId)
    }

    const now = new Date()
    const id = newId()

    await db.transaction(async (tx) => {
      await tx.insert(faultIncident).values({
        id,
        supplierId: input.supplierId,
        supplierDeviceId: deviceId,
        computeNodeId,
        faultType: title,
        severity: input.severity,
        incidentStatus: '处理中',
        resolutionOutcome: null,
        openedAt: now,
        closedAt: null,
        createdAt: now,
      })

      await tx.insert(supplierActivity).values({
        id: newId(),
        supplierId: input.supplierId,
        type: 'fault_opened',
        title: `故障 ${input.severity}：${title}`,
        description: null,
        authorStaffId: input.operatorStaffId ?? null,
        authorName: input.operatorName,
        authorRole: 'ops',
        refDomain: 'fault',
        refId: id,
        occurredAt: now,
        createdAt: now,
      })
    })

    supplierLog('fault-incident', 'create done', { id })
    return { id }
  },

  async close(input: FaultIncidentCloseInput): Promise<FaultIncidentCloseResult> {
    const [row] = await db
      .select({
        id: faultIncident.id,
        supplierId: faultIncident.supplierId,
        faultType: faultIncident.faultType,
        incidentStatus: faultIncident.incidentStatus,
      })
      .from(faultIncident)
      .where(eq(faultIncident.id, input.incidentId))
      .limit(1)

    if (!row) throw new Error('故障单不存在')
    if (isClosedStatus(row.incidentStatus)) throw new Error('故障单已关闭')

    const now = new Date()
    const resolution = input.resolution?.trim() || '已处理'

    await db.transaction(async (tx) => {
      await tx
        .update(faultIncident)
        .set({
          incidentStatus: '已关闭',
          resolutionOutcome: resolution,
          closedAt: now,
        })
        .where(eq(faultIncident.id, input.incidentId))

      await tx.insert(supplierActivity).values({
        id: newId(),
        supplierId: row.supplierId,
        type: 'fault_closed',
        title: `故障已关闭：${row.faultType}`,
        description: resolution,
        authorStaffId: input.operatorStaffId ?? null,
        authorName: input.operatorName,
        authorRole: 'ops',
        refDomain: 'fault',
        refId: row.id,
        occurredAt: now,
        createdAt: now,
      })
    })

    return { id: row.id, closedAt: now }
  },
}
