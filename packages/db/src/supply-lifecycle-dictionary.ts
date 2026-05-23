/**
 * 运维设备状态 / 变更动作字典种子（与 lifecycle_state_definition 对齐）
 *
 * 设计：supplier-onboarding-plan-changelog-tracking-design.md §3.4
 * 落库：lifecycle_state_definition.domain = device_ops_status | device_change_action
 * 应用：device-import-utils.ts（OPS_STATUS_TO_LIFECYCLE、CHANGE_ACTION_DEFAULT_OPS）
 */

export type DeviceOpsStatusPayload = {
  lifecycle_status: string
  overview_bucket: string
  tags?: string[]
}

export type DeviceChangeActionPayload = {
  default_ops_status?: string | null
  updates_compute_node?: boolean
}

/** device_ops_status — 11 条，state_code 与 Excel 原文一致 */
export const DEVICE_OPS_STATUS_SEEDS: Array<{
  stateCode: string
  displayName: string
  sortOrder: number
  payload: DeviceOpsStatusPayload
}> = [
  {
    stateCode: "预留闲置中",
    displayName: "预留闲置中",
    sortOrder: 10,
    payload: { lifecycle_status: "待接入", overview_bucket: "reserved" },
  },
  {
    stateCode: "在集群中",
    displayName: "在集群中",
    sortOrder: 20,
    payload: {
      lifecycle_status: "在线",
      overview_bucket: "in_cluster",
      tags: ["sellable_candidate"],
    },
  },
  {
    stateCode: "集群组件运行中",
    displayName: "集群组件运行中",
    sortOrder: 30,
    payload: {
      lifecycle_status: "在线",
      overview_bucket: "in_cluster",
      tags: ["sellable_candidate"],
    },
  },
  {
    stateCode: "网关直连裸金属上架中",
    displayName: "网关直连裸金属上架中",
    sortOrder: 40,
    payload: {
      lifecycle_status: "接入中",
      overview_bucket: "bare_metal_onboarding",
      tags: ["bare_metal"],
    },
  },
  {
    stateCode: "网关代理裸金属上架中",
    displayName: "网关代理裸金属上架中",
    sortOrder: 50,
    payload: {
      lifecycle_status: "接入中",
      overview_bucket: "bare_metal_onboarding",
      tags: ["bare_metal"],
    },
  },
  {
    stateCode: "线下裸金属交付中",
    displayName: "线下裸金属交付中",
    sortOrder: 60,
    payload: {
      lifecycle_status: "接入中",
      overview_bucket: "offline_delivery",
      tags: ["bare_metal"],
    },
  },
  {
    stateCode: "其他部门使用中",
    displayName: "其他部门使用中",
    sortOrder: 70,
    payload: {
      lifecycle_status: "维护中",
      overview_bucket: "other_dept",
      tags: ["not_sellable"],
    },
  },
  {
    stateCode: "不可调度节点运行中",
    displayName: "不可调度节点运行中",
    sortOrder: 80,
    payload: {
      lifecycle_status: "在线",
      overview_bucket: "in_cluster",
      tags: ["online_not_sellable"],
    },
  },
  {
    stateCode: "网关节点上架中",
    displayName: "网关节点上架中",
    sortOrder: 90,
    payload: { lifecycle_status: "接入中", overview_bucket: "gateway_onboarding" },
  },
  {
    stateCode: "已退订",
    displayName: "已退订",
    sortOrder: 100,
    payload: { lifecycle_status: "退订", overview_bucket: "retired" },
  },
]

/** device_change_action — 20 条 */
export const DEVICE_CHANGE_ACTION_SEEDS: Array<{
  stateCode: string
  displayName: string
  sortOrder: number
  payload: DeviceChangeActionPayload
}> = [
  { stateCode: "设备接收", displayName: "设备接收", sortOrder: 10, payload: { default_ops_status: "预留闲置中" } },
  { stateCode: "加入集群", displayName: "加入集群", sortOrder: 20, payload: { default_ops_status: "在集群中" } },
  { stateCode: "配置变更", displayName: "配置变更", sortOrder: 30, payload: {} },
  { stateCode: "故障维修", displayName: "故障维修", sortOrder: 40, payload: {} },
  { stateCode: "维护结束", displayName: "维护结束", sortOrder: 50, payload: {} },
  { stateCode: "状态更新", displayName: "状态更新", sortOrder: 60, payload: {} },
  { stateCode: "带宽组调整", displayName: "带宽组调整", sortOrder: 70, payload: {} },
  { stateCode: "带宽限制调整", displayName: "带宽限制调整", sortOrder: 80, payload: {} },
  {
    stateCode: "上架接入平台网关",
    displayName: "上架接入平台网关",
    sortOrder: 90,
    payload: { default_ops_status: "网关节点上架中" },
  },
  {
    stateCode: "上架单机模式裸金属",
    displayName: "上架单机模式裸金属",
    sortOrder: 100,
    payload: { default_ops_status: "网关直连裸金属上架中" },
  },
  {
    stateCode: "上架网关代理裸金属",
    displayName: "上架网关代理裸金属",
    sortOrder: 110,
    payload: { default_ops_status: "网关代理裸金属上架中" },
  },
  {
    stateCode: "上架网关直连裸金属",
    displayName: "上架网关直连裸金属",
    sortOrder: 120,
    payload: { default_ops_status: "网关直连裸金属上架中" },
  },
  { stateCode: "下架裸金属", displayName: "下架裸金属", sortOrder: 130, payload: { default_ops_status: "预留闲置中" } },
  {
    stateCode: "线下裸金属交付",
    displayName: "线下裸金属交付",
    sortOrder: 140,
    payload: { default_ops_status: "线下裸金属交付中" },
  },
  {
    stateCode: "集群角色增加",
    displayName: "集群角色增加",
    sortOrder: 150,
    payload: { updates_compute_node: true },
  },
  {
    stateCode: "集群角色删除",
    displayName: "集群角色删除",
    sortOrder: 160,
    payload: { updates_compute_node: true },
  },
  { stateCode: "设备退订", displayName: "设备退订", sortOrder: 170, payload: { default_ops_status: "已退订" } },
  { stateCode: "非常规下线", displayName: "非常规下线", sortOrder: 180, payload: { default_ops_status: "已退订" } },
  {
    stateCode: "交给其他部门使用",
    displayName: "交给其他部门使用",
    sortOrder: 190,
    payload: { default_ops_status: "其他部门使用中" },
  },
]

/** 由种子推导的 ops_status → lifecycle（应用层常量，与 DB 种子保持一致） */
export const OPS_STATUS_TO_LIFECYCLE_FROM_SEEDS = Object.fromEntries(
  DEVICE_OPS_STATUS_SEEDS.map((s) => [s.stateCode, s.payload.lifecycle_status]),
) as Record<string, string>

/** 变更动作 → 默认 ops_status（无变更内容状态时使用） */
export const CHANGE_ACTION_DEFAULT_OPS_FROM_SEEDS = Object.fromEntries(
  DEVICE_CHANGE_ACTION_SEEDS.filter((s) => s.payload.default_ops_status).map((s) => [
    s.stateCode,
    s.payload.default_ops_status!,
  ]),
) as Record<string, string>
