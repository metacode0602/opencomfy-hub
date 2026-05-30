# 全局大盘 Period 卡时 — M2 实施步骤（主数据 ETL → 设备快照）

**阶段**：M2  
**目标**：由 **D1 主数据** 投影 `device_hourly_snapshot` / `device_daily_snapshot`，支撑 Period 实体扇区阶梯积分，减少 `approximate`。  
**依赖**：无（与 M1 可并行；M3 读路径在 M2 灌数后自动生效）  
**M7**：**本期不实施**（见 [M7 文档](./global-dashboard-period-composition-m7-dws-acceleration.md)）  
**权威口径**：[global-dashboard-period-composition-card-hours-design.md](./global-dashboard-period-composition-card-hours-design.md) §8.2–§8.4、§11；[supplier-device-ops-pool-masterdata-design.md](./supplier-device-ops-pool-masterdata-design.md) D1/D2  

**产品决策（2026-05-29，已确认）**：采用 **「Cron 铺网格 + 导入/API 即时写小时桶」** 组合（见 §0）。**ETL-MD-1 维持 1 小时**（`5 * * * *`），不采用 30 分钟间隔。第三方 API 见 [supplier-device-masterdata-integration-api-design.md](./supplier-device-masterdata-integration-api-design.md)。

**现网说明**：`device_*_snapshot` 表已存在；`compute-period-resource-composition.ts` 已读快照时间轴。**M2 代码已落地**（`dashboard-masterdata-snapshot/*`、import Hook）；**第三方 REST API（MD-4 专文）未实现**。

---

## 0. 业务前提与触发策略（已确认）

### 0.1 主数据何时变更

| 入口 | 写 `supplier_device` | 写快照（本期） |
|------|------------------------|----------------|
| `device_inventory` 导入 commit | ✅ | **ETL-MD-3**：立刻写 **当前小时桶** + 更新日桶 |
| **Web API** 单台/批量更新设备主数据状态 | ✅（新增） | **ETL-MD-4**：与 MD-3 相同投影，立刻写 **当前小时桶** + 更新日桶 |
| **ETL-MD-1** 每小时 Cron | 否（只读当前态） | 写 **每个整点小时桶**（填满导入/API 之间的网格） |
| **ETL-MD-2** 每日 Cron | 否 | 由 **当日 24 条小时快照** 聚合 `device_daily_snapshot`（`online_hours` 阶梯求和，上限 24） |
| `device_changelog` commit | **否**（D2） | **禁止** 写实体快照 |

**说明**：Cron **不** 发现集群新状态，只把 `supplier_device` **当前末态** 抄入各 **整点小时** 桶（**1 小时一格**，与 `device_hourly_snapshot` / Period `view=hourly` 一致）；导入/API 在变更发生的 **当小时** 立即落桶，避免「导入在 :50、Cron 在 :05」的滞后。

### 0.2 三项能力组合 — 为何效果更好

| # | 能力 | 单独作用 | 组合后 |
|---|------|----------|--------|
| 1 | 恢复 **ETL-MD-1 / MD-2** 定时任务 | 24 小时网格 + 日 `online_hours` 由小时聚合，避免日表「覆盖/累加」二选一 | 时间轴连续，专篇 §8.3.1 可对齐 |
| 2 | 导入后 **立刻写小时桶** | 大批量导入后 ≤ 导入完成时刻即可查 Period | 不依赖等下一个整点 Cron |
| 3 | **Web API** 实时改状态 + 同链路写快照 | 运维/系统单台改状态不必走 Excel | API 变更当小时可见；与 Cron 叠加覆盖日内多段 |

**仍不替代**：计划扇区（M1 事件）、M7 DWS、历史区间 **backfill CLI**（上线前一次性）。

### 0.3 各 ETL 任务本期范围

| 任务 | 编号 | 本期 |
|------|------|------|
| 小时快照 Cron | ETL-MD-1 | **★ 实施** `5 * * * *`（Asia/Shanghai） |
| 日快照 Cron | ETL-MD-2 | **★ 实施** `15 0 * * *`（在 MD-1 之后，聚合 **昨日或当日** 需实现时写死） |
| 导入实时投影 | ETL-MD-3 | **★ 实施** |
| API 实时投影 | ETL-MD-4 | **★ 实施**（复用 `projectDeviceSnapshotsForDevices`） |
| 主数据事件表 | 可选 | ○ 二期；同桶多次变更要更高精度时启用 |
| 历史灌数 CLI | backfill | ○ 按需 |

### 0.4 日桶 `online_hours` 规则（已定，无二选一）

- **日表 `online_hours`**：由 **ETL-MD-2** 对当日该设备 **24 条小时快照** 按专篇 §8.3.1 **阶梯求和**（上限 24）；**不在** MD-3/MD-4 用「覆盖/累加」手填日字段。
- **MD-3/MD-4**：只保证 **当前小时桶** 即时正确 + **日桶末态字段**（`lifecycle/ops/in_maintenance/gpu_count`）与当前一致；`online_hours` 以 MD-2 聚合为准（当日 MD-2 未跑前可为暂估值或仅更新末态，实现时在注释中写清）。

### 0.5 对 Period 视图的预期

| 视图 | 预期 |
|------|------|
| **hourly** | 有 MD-1 后各整点有行；导入/API 当小时由 MD-3/4 即时对齐 |
| **daily** | MD-2 聚合后 `online_hours` 与小时积分一致；读路径仍可用小时时间轴 rollup |
| **approximate** | 区间内有快照覆盖 → `false`；Cron 长期失败或新设备未灌数 → 仍可能 `true` |

---

## 1. 交付物清单

| # | 交付物 | 说明 |
|---|--------|------|
| D1 | ETL-MD-1 小时快照作业 | Cron 每小时 → `device_hourly_snapshot` |
| D2 | ETL-MD-2 日快照作业 | 每日 00:15 → 由小时表聚合 `device_daily_snapshot` |
| D3 | ETL-MD-3 导入实时投影 | `device_inventory` commit → 当前小时桶 + 日桶末态 |
| D4 | **ETL-MD-4 API 实时投影** | 主数据 API 成功 → 同 D3 投影 |
| D5 | **第三方集成 REST API** | 见 [supplier-device-masterdata-integration-api-design.md](./supplier-device-masterdata-integration-api-design.md)；**禁止** API 改 `gpu_count` |
| D6 | `dashboard_etl_batch` 跑批审计 | `etl_md_hourly` / `etl_md_daily` / `etl_md_inventory_realtime` / `etl_md_api_realtime` |
| D7 | （可选）`supplier_device_masterdata_event` | 同桶多段精度 |
| D8 | 监控与告警 | Cron 延迟、MD-2 未跑、快照行数偏差 |
| D9 | `backfill-device-snapshots.ts` | 历史灌数（按需） |

---

## 2. 前置条件

- [ ] D2：`device_changelog` commit **不** 调用快照投影。
- [ ] D1/D5 字段范围与 [supplier-device-ops-pool-masterdata-design.md](./supplier-device-ops-pool-masterdata-design.md) 字典一致。
- [ ] 时区：**Asia/Shanghai**，与 `period-time.ts` 一致。
- [ ] GPU 计量：`metricGpuCount`。

---

## 3. 实施步骤

### 步骤 1 — 共享投影模块（D6）

1. 新建 `apps/web/src/lib/server/jobs/dashboard-masterdata-snapshot/project-devices.ts`：
   - `projectDeviceSnapshotsForDevices({ deviceIds, occurredAt })`
   - `projectHourlyRow(device, bucketStart)` → UPSERT 当前小时
   - `touchDailySnapshotFromHourly(deviceId, snapshotDate)` → 更新日桶 **末态**（`online_hours` 留给 MD-2）
2. `job_code` / `dashboard_etl_batch` 见 §0.3。

---

### 步骤 2 — ETL-MD-1 小时快照 Cron（D1）

- 表达式：`5 * * * *`
- 输入：`supplier_device` 当前态（排除已退订，与构成一致）
- 输出：每台设备 **当前整点桶** 一行；`online_hours` 默认 **1**（该小时整段采用当前末态）或按可选 `masterdata_event` 分段
- 与 MD-3/4 关系：**幂等 UPSERT**；导入/API 已写当小时则 Cron 同值覆盖

---

### 步骤 3 — ETL-MD-2 日快照 Cron（D2）

- 表达式：`15 0 * * *`（上海）
- 输入：当日（或昨日，团队实现时 **写死一种**）每台设备的 24 条 `device_hourly_snapshot`
- 输出：`device_daily_snapshot`；`online_hours` = §8.3.1 阶梯求和；末态 = **当日最后一小时** 快照
- 依赖：MD-1 已稳定运行

---

### 步骤 4 — ETL-MD-3 导入实时投影（D3）

1. `device-import.ts`：inventory commit 成功 → `projectDeviceSnapshotsForDevices({ deviceIds, occurredAt: commitTime })`
2. **必须**写 **commit 所在小时桶**（勿只写日桶）

---

### 步骤 5 — ETL-MD-4 + 第三方 API（D4、D5）

专文：[supplier-device-masterdata-integration-api-design.md](./supplier-device-masterdata-integration-api-design.md)。

#### 5.1 主数据状态 API（触发 MD-4）

| 项 | 约定 |
|----|------|
| 对齐 Excel | 设备表 §4.1：**设备状态** → `opsStatus`；**维修中** → `inMaintenance` |
| 可写 | `ops_status`、`in_maintenance`；`lifecycle_status` **服务端重算** |
| **禁止** | `gpu_count`、显卡型号/卡型 ID、登录凭据、合作类型（§2.3 专文） |
| 传输 | `PATCH .../masterdata-state`、批量 `POST .../batch`；`Authorization: Bearer` |

#### 5.2 变更记录 API（不触发 MD-4）

| 项 | 约定 |
|----|------|
| 对齐 Excel | 变更表 §4.2：操作时间、变更动作、变更内容、详细说明、工单等 |
| 写入 | `supplier_device_change_log` + `refreshBatchProgress`（D2） |
| **禁止** | 更新 `supplier_device`；写实体快照 |

#### 5.3 快照 Hook（仅 §5.1 主数据 API）

1. 主数据 API 成功 → `projectDeviceSnapshotsForDevices({ deviceIds, occurredAt })`
2. `dashboard_etl_batch.job_code = etl_md_api_realtime`
3. 投影失败：告警 + 可重试；主数据是否回滚由实现配置（建议与 MD-3 一致）

---

### 步骤 6 — （可选）主数据事件表（D7）

同 v1.0 专篇 §5.5；API 与导入均 `source=api_update` | `inventory_import`。

---

### 步骤 7 — 测试与验收

| 用例 | 期望 |
|------|------|
| PC-T1 | 导入后当小时快照存在；当日 MD-2 后日 `online_hours` 与小时和一致 |
| PC-T2 | API 改 `维护中` → 当小时桶更新；**无** changelog 快照 |
| PC-T6 | 同日导入 + API + Cron：日积分 ≈ 小时积分之和 |
| — | changelog commit 后无新快照 |
| — | Cron 停跑 >2h 告警 |

---

## 4. 涉及文件（建议）

| 路径 | 动作 |
|------|------|
| `jobs/dashboard-masterdata-snapshot/project-devices.ts` | **新建** |
| `jobs/dashboard-masterdata-snapshot/etl-md-hourly.ts` | **新建** + 注册 Cron |
| `jobs/dashboard-masterdata-snapshot/etl-md-daily.ts` | **新建** + 注册 Cron |
| `dataaccess/supplier/device-import.ts` | MD-3 Hook |
| `app/api/integration/v1/supplier/...` | 第三方 REST（专文 §8） |
| `lib/server/integration/device-masterdata-integration.ts` | MD-4 + 主数据 API |
| `lib/server/integration/device-changelog-integration.ts` | 变更 API（无快照） |
| `scripts/backfill-device-snapshots.ts` | 按需 |

---

## 5. 验收标准

| ID | 条件 |
|----|------|
| M2-A1 | 每小时 MD-1 有新快照行（或增量设备覆盖） |
| M2-A2 | 每日 MD-2 有日快照且 `online_hours` ∈ [0,24] |
| M2-A3 | 导入后 5 分钟内当小时桶可见 |
| M2-A4 | API 更新后 1 分钟内当小时桶可见 |
| M2-A5 | 覆盖区间内 Period `approximate: false`（有计划侧除外） |
| M2-A6 | changelog commit 后无新快照行 |
| M2-A7 | PC-T6 / PC-T7 通过 |

---

## 6. 风险与回滚

- **双倍计数**：changelog 不得调投影；code review grep `projectDeviceSnapshots`。
- **Cron 与 API 竞态**：同 UK 幂等 UPSERT；以 `occurred_at` 较大者末态为准（或最后写入覆盖，需单测固定）。
- **回滚**：停 Cron + 停 import/API Hook → 读路径 fallback `approximate`。

---

## 7. 完成后衔接

- **M3–M6**：复核在线读路径。
- **M7**：不做。

---

## 8. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-29 | 初稿 ETL-MD-1/2/3 |
| v1.1 | 2026-05-29 | 仅导入、取消 Cron |
| v1.2 | 2026-05-29 | **已确认**：恢复 MD-1/2 + MD-3 导入即时小时桶 + **MD-4/API**；日 `online_hours` 仅 MD-2 聚合 |
| v1.3 | 2026-05-29 | Cron **维持 1 小时**；API 专文拆分；禁止 API 改 `gpu_count` |
