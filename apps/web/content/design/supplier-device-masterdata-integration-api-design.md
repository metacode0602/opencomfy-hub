# 供应域 — 设备主数据 / 变更记录 第三方集成 API

**文档性质**：第三方程序调用规范（REST + JSON）；与 Excel 导入表头对齐，**不替代** `device_inventory` / `device_changelog` 批量导入。  
**版本**：v1.0（2026-05-29）  
**状态**：已确认（**暂缓**；M2 Cron + 导入快照已落地，见 `dashboard-masterdata-snapshot/`）

**关联文档**：

- [supplier-device-import-schema.md](./supplier-device-import-schema.md) §3.4、§4.1、§4.2（Excel 表头权威）
- [supplier-device-ops-pool-masterdata-design.md](./supplier-device-ops-pool-masterdata-design.md) D1/D2
- [global-dashboard-period-composition-m2-masterdata-etl.md](./global-dashboard-period-composition-m2-masterdata-etl.md) ETL-MD-4

**Cron 约定**：实体快照铺网格 **维持 1 小时**（`ETL-MD-1`：`5 * * * *`）；**不** 采用 30 分钟间隔。

---

## 1. 与 Excel 导入的关系

| Excel 批次 | `batch_kind` | 第三方 API 对应 |
|------------|--------------|-----------------|
| **设备表**（主数据） | `device_inventory` | **§3 主数据状态 API** — 对齐 §4.1 表头中「状态类」字段 |
| **设备变更表** | `device_changelog` | **§4 变更记录 API** — 对齐 §4.2 表头 |

**分工**：

- 大批量全量/增量、含卡型与 GPU 数量 → 仍走 **Excel `device_inventory` 导入**。
- 第三方 **高频状态同步** → §3 API；**不开放** `gpu_count` / 显卡型号（见 §2.2）。
- 第三方 **变更流水** → §4 API；走 `supplier_device_change_log` + `refreshBatchProgress`（D2），**不** 写实体快照、**不** 改 `supplier_device`。

---

## 2. 通用约定

### 2.1 传输

| 项 | 约定 |
|----|------|
| 协议 | HTTPS |
| Base URL | `https://{host}/api/integration/v1` |
| 编码 | `Content-Type: application/json; charset=utf-8` |
| 业务时区 | `Asia/Shanghai`；时间字段 ISO 8601，如 `2026-05-29T14:32:10+08:00` |
| 幂等 | 请求头 `Idempotency-Key: {uuid}`（24h 内同 key 返回首次结果） |
| 追踪 | 响应含 `requestId`（UUID） |

### 2.2 鉴权

| 项 | 约定 |
|----|------|
| 方式 | 集成 **API Key**（按第三方租户签发，可轮换） |
| 请求头 | `Authorization: Bearer {api_key}` |
| Scope | `integration:device_masterdata:write` / `integration:device_changelog:write`（可分 key） |
| 失败 | `401` 无效 key；`403` scope 或 IP 白名单不符 |

### 2.3 全局禁止写入（相对 Excel 设备表 §4.1）

以下列 **仅允许** 通过 **`device_inventory` Excel 导入** 维护，**所有 §3 API 均禁止**：

| Excel 列 | 原因 |
|----------|------|
| **显卡型号** | 绑定 `gpu_card_type_id`，需 preview 匹配规则 §4.1.1 |
| **显卡数量** | 影响卡时计量；第三方 API **不得** 改 `gpu_count` |
| 登录用户名 / 登录密码 | 凭据敏感，仅导入 + RBAC 详情 |
| 合作类型 | 设计明确不落库 |

以下列 **本期 API 不开放**（可二期扩展，仍不含 GPU）：

K8s集群、集群中节点名称、集群角色、预期集群提供服务、设备配置、带宽组、限速、备注、设备接收时间 — 若需请继续走 Excel 或单独立项。

---

## 3. 主数据状态 API（对齐设备表 Excel §4.1）

对应 Excel **设备表** 中与 **运行态 / 维修** 相关的列；写入 `supplier_device` 后触发 **ETL-MD-4**（当小时快照 + 日桶末态）。

### 3.1 Excel 列 ↔ API 字段

| Excel 列（§4.1） | API 字段 | 必填 | 写入 `supplier_device` |
|------------------|----------|------|-------------------------|
| 设备ID | `externalDeviceId` | 定位三选一 | 仅查询，不改 ID |
| 内网IP地址 | `internalIp` | 定位可选 | 仅校验，不改 IP |
| 设备标识 | `assetNo` / `sn` | 定位可选 | 仅查询 |
| **设备状态** | `opsStatus` | 更新时必填* | `ops_status`（Excel 原文） |
| **维修中** | `inMaintenance` | 否 | `in_maintenance`，默认 `false` |
| — | `lifecycleStatus` | **禁止请求体传入** | 服务端由 `ops_status` + `in_maintenance` 按 D1 重算 |
| — | `occurredAt` | 否 | 快照桶对齐时刻，默认 `now` |
| — | `reason` | 建议 | 审计日志，最长 500 字 |
| — | `externalRef` | 否 | 第三方关联 ID，写集成日志 |

\* 至少变更 `opsStatus` 或 `inMaintenance` 之一。

**不接受的字段**：`gpuCount`、`gpuCardTypeCode`、`gpuCardTypeId` 及 §2.3 禁止列。

### 3.2 `opsStatus` 合法值

与 `device_ops_status` 字典一致（`packages/db/src/supply-lifecycle-dictionary.ts` `DEVICE_OPS_STATUS_SEEDS`）：

`预留闲置中`、`在集群中`、`集群组件运行中`、`网关直连裸金属上架中`、`网关代理裸金属上架中`、`单机直连裸金属上架中`、`线下裸金属交付中`、`其他部门使用中`、`不可调度节点运行中`、`网关节点上架中`、`已退订`。

非法 → `400` `INVALID_OPS_STATUS`。

### 3.3 设备定位（每台请求三选一）

| 字段 | 说明 |
|------|------|
| `deviceId` | `supplier_device.id`（推荐） |
| `externalDeviceId` | Excel「设备ID」 |
| `sn` + `supplierId` | SN 在供应商内唯一时使用 |
| `internalIp` + `supplierId` | 与 Excel IP 校验一致 |

### 3.4 `PATCH /supplier/devices/{deviceId}/masterdata-state`

**单台更新**（路径已含 `deviceId` 时可省略 body 定位字段）。

**Request**

```json
{
  "opsStatus": "在集群中",
  "inMaintenance": false,
  "occurredAt": "2026-05-29T14:32:10+08:00",
  "reason": "集群调度上报",
  "externalRef": "k8s-node-abc"
}
```

**Response `200`**

```json
{
  "ok": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "deviceId": "dev_xxx",
    "externalDeviceId": "ext-1",
    "sn": "SN001",
    "opsStatus": "在集群中",
    "inMaintenance": false,
    "lifecycleStatus": "在线",
    "gpuCount": 8,
    "updatedAt": "2026-05-29T14:32:11+08:00",
    "snapshot": {
      "snapshotHour": "2026-05-29T14:00:00+08:00",
      "snapshotDate": "2026-05-29",
      "projected": true
    }
  }
}
```

> `gpuCount` 仅 **只读回显** 当前库值，请求体传入将被 **忽略** 或 `400` `FIELD_NOT_ALLOWED`（实现时二选一并写死）。

### 3.5 `POST /supplier/devices/masterdata-state/batch`

**批量**，单次 ≤ `200` 条（可配置）。

**Request**

```json
{
  "items": [
    { "deviceId": "dev_1", "opsStatus": "在集群中", "inMaintenance": false },
    { "externalDeviceId": "ext-2", "supplierId": "sup_1", "opsStatus": "网关节点上架中" }
  ],
  "defaultReason": "第三方批量同步",
  "occurredAt": "2026-05-29T14:00:00+08:00"
}
```

**Response `200`**：`total` / `succeeded` / `failed` / `results[]`（与单台错误结构相同，支持部分成功）。

### 3.6 `GET /supplier/devices/{deviceId}/masterdata-state`

只读当前主数据末态（不写快照）。

---

## 4. 变更记录 API（对齐设备变更表 Excel §4.2）

对应 Excel **设备变更表**；写入 `supplier_device_change_log`，触发 `refreshBatchProgress`（计划管道），**不** 更新 `supplier_device`（D2），**不** 触发 ETL-MD 实体快照。

### 4.1 Excel 列 ↔ API 字段

| Excel 列（§4.2） | API 字段 | 必填 | 写入 |
|------------------|----------|------|------|
| 设备ID | `externalDeviceId` 或 `deviceId` | 是 | 解析 `supplier_device_id` |
| 内网IP | `internalIp` | 否 | `change_log.internal_ip` 校验冗余 |
| **操作时间** | `occurredAt` | 是 | `occurred_at` |
| **变更动作** | `changeAction` | 是 | `change_action`（字典 `device_change_action`） |
| **变更内容** | `changeContent` | 否 | `change_content` |
| **详细说明** | `description` | 否 | `description` |
| **工单** | `ticketNo` | 否 | `ticket_no`；可匹配 `business_onboarding_batch_id` |
| 附件 | — | — | **不落库**（与 Excel 一致） |

### 4.2 `changeAction` 合法值

与 `DEVICE_CHANGE_ACTION_SEEDS` 一致，例如：`设备接收`、`加入集群`、`配置变更`、`故障维修`、`维护结束`、`状态更新`、`带宽组调整`、`带宽限制调整`、`上架接入平台网关`、`上架单机模式裸金属`、`上架网关代理裸金属`、`网关直连裸金属上架中`、`下架裸金属`、`线下裸金属交付`、`集群角色增加`、`集群角色删除`、`设备退订`、`非常规下线`、`交给其他部门使用`。

非法 → `400` `INVALID_CHANGE_ACTION`。

### 4.3 `POST /supplier/device-change-logs`

**单条或少量**（建议 ≤ 50 条/请求）。

**Request**

```json
{
  "items": [
    {
      "deviceId": "dev_xxx",
      "occurredAt": "2026-05-29T10:15:00+08:00",
      "changeAction": "加入集群",
      "changeContent": "设备状态: 预留闲置中 -> 在集群中",
      "description": "第三方工单系统自动回写",
      "ticketNo": "FS-2026-001234",
      "internalIp": "10.0.1.88"
    }
  ],
  "source": "integration_api",
  "idempotencyKey": "optional-in-body-if-no-header"
}
```

**Response `201`**

```json
{
  "ok": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "data": {
    "accepted": 1,
    "changeLogIds": ["clog_xxx"],
    "batchProgressRefreshed": true
  }
}
```

**副作用**：`refreshBatchProgress` → 可能追加 `onboarding_batch_progress_event`（M1）；**Period 计划扇区** 可能变化；**实体扇区** 不变直至 §3 主数据 API 或 `device_inventory` 导入。

### 4.4 `POST /supplier/device-change-logs/batch`

大批量变更流水（≤ 500 条/请求，与 Excel 导入行数上限对齐），语义同 §4.3；服务端可为集成来源创建虚拟 `onboarding_batch`（`batch_kind=device_changelog`，`source=integration_api`）以满足 `onboarding_batch_id` NOT NULL。

---

## 5. 错误码

| HTTP | code | 说明 |
|------|------|------|
| 400 | `INVALID_REQUEST` | 参数错误 |
| 400 | `INVALID_OPS_STATUS` | 主数据 API 状态非法 |
| 400 | `INVALID_CHANGE_ACTION` | 变更 API 动作非法 |
| 400 | `FIELD_NOT_ALLOWED` | 含 `gpuCount` / `gpuCardType*` 等禁止字段 |
| 401 | `UNAUTHORIZED` | API Key 无效 |
| 403 | `FORBIDDEN` | 无 scope |
| 404 | `DEVICE_NOT_FOUND` | 设备不存在 |
| 409 | `AMBIGUOUS_DEVICE` | 定位不唯一 |
| 422 | `NO_EFFECTIVE_CHANGE` | 主数据 API 与当前态相同 |
| 429 | `RATE_LIMITED` | 限流 |
| 500 | `INTERNAL_ERROR` | 服务错误 |
| 503 | `SNAPSHOT_PROJECTION_FAILED` | 主数据已更新但 MD-4 投影失败（仅 §3） |

---

## 6. 限流与审计

| 项 | 建议 |
|----|------|
| 主数据 API | 单设备 ≤ 60 次/小时；批量 ≤ 10 次/小时 |
| 变更 API | ≤ 500 条/分钟（按租户） |
| 审计 | 保留 `requestId`、API Key id、`externalRef`、请求/响应摘要 90 天 |
| 对账 | 第三方宜按 `occurredAt` + `deviceId` 与 Excel 导入批次区分来源 |

---

## 7. 与 ETL / Period 的关系

| API | `supplier_device` | 实体快照 ETL | 计划管道 |
|-----|-------------------|--------------|----------|
| §3 主数据状态 | ✅ 更新 `ops_status` / `in_maintenance` | **ETL-MD-4** 即时当小时 + 日末态 | 否 |
| §4 变更记录 | ❌ 不改（D2） | ❌ 禁止 | ✅ `refreshBatchProgress` |
| Excel inventory | ✅ 全量列含 GPU | **ETL-MD-3** | 否 |
| Excel changelog | 见 import-schema 与 D2 口径 | ❌ | ✅ |

**ETL-MD-1**：**1 小时** Cron，在导入/API 之间铺齐整点网格（[M2](./global-dashboard-period-composition-m2-masterdata-etl.md)）。

---

## 8. 实现索引（待开发）

| 组件 | 路径（建议） |
|------|----------------|
| Route Handler | `apps/web/src/app/api/integration/v1/supplier/...` |
| 鉴权 | `apps/web/src/lib/server/integration/api-key-auth.ts` |
| 主数据写 | `device-masterdata-integration.ts` → 复用 D1 重算 + `projectDeviceSnapshotsForDevices` |
| 变更写 | `device-changelog-integration.ts` → 复用 `commitChangelog` 核心逻辑（无 Excel 文件） |

---

## 9. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-29 | 初稿：对齐设备表/变更表 Excel 表头；禁止 API 改 `gpu_count`；Cron 维持 1 小时 |
