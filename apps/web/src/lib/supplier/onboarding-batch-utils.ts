import type { OnboardingBatchKind, OnboardingParsedRow, SupplierDevice } from "@/lib/types/supplier-domain"
import type { OnboardingBatchRow } from "@workspace/db/schema"
import type { SupplierOpsInventoryRow } from "@/lib/types/supplier-ops-batch"

export type PlannedBatchKind = "online" | "order_access" | "device_retire" | "internal_occupancy"

export type PlannedBatchKindFilter = PlannedBatchKind | "all"

export const PLANNED_BATCH_KINDS: PlannedBatchKind[] = [
  "online",
  "order_access",
  "device_retire",
  "internal_occupancy",
]

export function batchKindFromRoute(kind: "online-tasks" | "order-access"): OnboardingBatchKind {
  return kind === "online-tasks" ? "online" : "order_access"
}

export function routeKindFromBatch(batchKind: OnboardingBatchKind): "online-tasks" | "order-access" {
  return batchKind === "online" ? "online-tasks" : "order-access"
}

export function isPlannedBatchKind(kind: string): kind is PlannedBatchKind {
  return (PLANNED_BATCH_KINDS as readonly string[]).includes(kind)
}

export const BATCH_KIND_BADGE: Record<
  PlannedBatchKind,
  { label: string; className: string }
> = {
  online: {
    label: "设备上架",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  order_access: {
    label: "订单接入",
    className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
  device_retire: {
    label: "设备下架",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  internal_occupancy: {
    label: "内部占用",
    className: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  },
}

export function onboardingBatchDetailPath(
  batch: Pick<OnboardingBatchRow, "id" | "batchKind">,
): string {
  const kind = batch.batchKind
  if (kind === "device_retire") return `/supplier/offline-tasks/${batch.id}`
  if (kind === "order_access") return `/supplier/order-access/${batch.id}`
  if (kind === "internal_occupancy") return `/supplier/online-tasks/${batch.id}`
  return `/supplier/online-tasks/${batch.id}`
}

export function generateBatchCode(batchKind: OnboardingBatchKind): string {
  const prefix =
    batchKind === "online"
      ? "ONB"
      : batchKind === "order_access"
        ? "ORD"
        : batchKind === "device_inventory"
          ? "DINV"
        : batchKind === "device_changelog"
          ? "DCHG"
          : batchKind === "device_retire"
            ? "RET"
            : batchKind === "internal_occupancy"
              ? "IO"
              : "BAT"
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}-${y}${m}-${seq}`
}

export function inventoryRowsToParsed(rows: SupplierOpsInventoryRow[]): OnboardingParsedRow[] {
  return rows.map((r, i) => ({
    row_no: i + 2,
    public_ip: r.public_ip,
    private_ip: r.private_ip,
    root_account: r.root_account,
    root_password: r.root_password,
    parse_status: "ok" as const,
    parse_message: null,
  }))
}

export function maskPassword(pwd: string): string {
  if (pwd.length <= 2) return "***"
  return `${pwd.slice(0, 1)}***${pwd.slice(-1)}`
}

export const IMPORT_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  none: "未上传清单",
  uploaded: "已上传",
  parsing: "解析中",
  parsed: "待确认入库",
  parse_failed: "解析失败",
  committing: "入库中",
  committed: "已入库",
  cancelled: "已取消",
}

export const BATCH_STATUS_LABELS: Record<string, string> = {
  待开始: "待开始",
  接入中: "接入中",
  占用中: "占用中",
  下架中: "下架中",
  已完成: "已完成",
  已取消: "已取消",
}

export function buildDevicesFromBatch(params: {
  batchId: string
  supplierId: string
  contractId: string | null
  dataCenterId: string
  idcCode: string
  idcRegion: string
  cardTypeDefault: string
  rows: OnboardingParsedRow[]
  createId: (prefix: string) => string
}): SupplierDevice[] {
  const { batchId, supplierId, contractId, dataCenterId, idcCode, idcRegion, cardTypeDefault, rows, createId } =
    params
  const okRows = rows.filter((r) => r.parse_status === "ok")
  return okRows.map((row, idx) => {
    const sn = row.sn?.trim() || `SN-${Date.now().toString(36).slice(-6)}-${idx + 1}`
    const asset = row.asset_no?.trim() || `AST-${idcCode}-${String(idx + 1).padStart(5, "0")}`
    return {
      id: createId("dev"),
      supplier_id: supplierId,
      contract_id: contractId,
      onboarding_batch_id: batchId,
      data_center_id: dataCenterId,
      asset_no: asset,
      sn,
      lifecycle_status: "接入中",
      onboarding_substage: "待施工",
      idc_region: idcRegion,
      idc_code: idcCode,
      gpu_count: String(row.gpu_count ?? 8),
      card_type: row.card_type_code ?? cardTypeDefault,
      external_ip: row.public_ip,
      internal_ip: row.private_ip,
      platform_resource_id: null,
    }
  })
}

export const LIFECYCLE_STATUS_COLORS: Record<string, string> = {
  待接入: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  接入中: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  在线: "bg-green-500/20 text-green-400 border-green-500/30",
  离线: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  维护中: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  下线中: "bg-red-500/20 text-red-400 border-red-500/30",
}
