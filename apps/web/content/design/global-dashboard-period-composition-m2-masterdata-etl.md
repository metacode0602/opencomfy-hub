# 全局大盘 Period 卡时 — M2 实施步骤（主数据 ETL → 设备快照）

**阶段**：M2  
**目标**：由 **D1 主数据**（`device_inventory` 导入 + 定时扫描）投影 `device_hourly_snapshot` / `device_daily_snapshot`，消除 Period 实体卡时 `approximate` 回填。  
**依赖**：无（与 M1 可并行；M3 已实现的读路径在 M2 灌数后自动生效）  
**阻塞**：M7 实体侧 `resource_composition_*` DWS 回灌  
**权威口径**：[global-dashboard-period-composition-card-hours-design.md](./global-dashboard-period-composition-card-hours-design.md) §8.2–§8.4、§11 ETL-MD-1/2/3；[supplier-device-ops-pool-masterdata-design.md](./supplier-device-ops-pool-masterdata-design.md) D1/D2  

**现网说明**：`packages/db/src/dashboard-schema.ts` 已定义 `device_*_snapshot`；`compute-period-resource-composition.ts` 已读这两张表，无行时 `approximate: true`。

---

## 1. 交付物清单

| # | 交付物 | 说明 |
|---|--------|------|
| D1 | ETL-MD-1 小时快照作业 | cron 每小时 → `device_hourly_snapshot` |
| D2 | ETL-MD-2 日快照作业 | 每日 00:15（Asia/Shanghai）→ `device_daily_snapshot` |
| D3 | ETL-MD-3 导入实时投影 | `device_inventory` commit 后写当前小时/日桶 |
| D4 | `dashboard_etl_batch` 跑批审计 | 成功/失败、行数、`etl_batch_id` 回写 |
| D5 | （可选）`supplier_device_masterdata_event` | 提高桶内分段精度，再投影快照 |
| D6 | 监控与告警 | 快照延迟、空跑、与 `supplier_device` 行数偏差 |

---

## 2. 前置条件

- [ ] 专篇 §8.3 **禁止** 路径已对齐：`device_changelog` commit **不** 调用本 ETL（仅 M1 批次事件）。
- [ ] `supplier_device` 为实体态真源（D1）；导入入口 `device-import.ts`、扫描策略已确认频率（§10.1 Q2）。
- [ ] 明确时区：**桶界 Asia/Shanghai**，与 `period-time.ts` / `buildPeriodBuckets` 一致。
- [ ] GPU 计量使用 `metricGpuCount`（与构成聚合一致）。

---

## 3. 实施步骤

### 步骤 1 — ETL 模块骨架（D4）

1. 新建目录 `apps/web/src/lib/server/jobs/dashboard-masterdata-snapshot/`（或 `etl/dashboard/`）。
2. 复用 / 对齐 `dashboard_etl_batch`（`dashboard-schema.ts`）：
   - `job_code`: `etl_md_hourly` | `etl_md_daily` | `etl_md_inventory_realtime`
   - `granularity`: `hour` | `day`
   - `bucket_start` / `bucket_end`、`status`、`rows_affected`
3. 统一日志：`dashboardLog` / `dashboardWarn` / `dashboardError`（`dataaccess/dashboard/logger.ts`）。
4. 单设备行 ID 建议：`${snapshotHour|snapshotDate}:${supplierDeviceId}`（与 UK 一致）。

---

### 步骤 2 — ETL-MD-1 小时快照（D1）

**输入**：`supplier_device` 当前态 +（可选）上一小时同设备快照（用于 `online_hours` 子段计算）。

**输出**：`device_hourly_snapshot` 一行 / 设备 / 整点桶 `[h:00, h+1:00)`。

**逐步实施**：

1. **确定桶时刻 `snapshot_hour`**：当前业务时刻对齐 `startOfLocalHour`（`period-time.ts`）。
2. **扫描设备全集**（或增量：过去 1h 内 `updated_at` 变化的设备）：
   ```sql
   SELECT id, supplier_id, data_center_id, gpu_card_type_id, gpu_count,
          lifecycle_status, ops_status, in_maintenance, ...
   FROM supplier_device
   WHERE lifecycle_status != '退订' AND ops_status != '已退订'  -- 与构成排除一致
   ```
3. **投影字段**（§5.3）：
   | 字段 | 规则 |
   |------|------|
   | `lifecycle_status` / `ops_status` / `in_maintenance` | 直读主数据 |
   | `gpu_count` | 直读 |
   | `is_online_at_end` | `lifecycle='在线' AND NOT in_maintenance` |
   | `online_hours` | 默认 **1**（整小时在线）或 **0**；若桶内有多段变更见步骤 5 |
   | `pool_codes` | 由 `ops_status` 推导 memberships 写入辅助列（非分桶依据） |
   | `idc_*` / `cooperation_type` | 从 `data_center` / `supplier_device` 冗余 |
4. **UPSERT**：`ON CONFLICT (snapshot_hour, supplier_device_id) DO UPDATE`。
5. 写 `dashboard_etl_batch` 记录；失败时 `status=failed` 且 **不** 部分提交（事务）。

**Cron 注册**（示例）：

- `apps/web/src/lib/server/jobs/register-dashboard-snapshot-cron.ts`
- 表达式：`5 * * * *`（每小时第 5 分钟，避免整点竞争）

---

### 步骤 3 — ETL-MD-2 日快照（D2）

**输入**：优先 **当日小时快照序列**；若无小时数据则 **日末主数据末态** 一次投影。

**输出**：`device_daily_snapshot` 一行 / 设备 / `snapshot_date`。

**逐步实施**：

1. **自然日键**：`formatDateKey`（Asia/Shanghai）。
2. **末态字段**（§8.3.1 第 4 点）：取当日 **最后一条** 小时快照或当日最后一次主数据变更的 `lifecycle/ops/in_maintenance/gpu_count`。
3. **`online_hours` 阶梯聚合**（§8.3.1）：
   - 对当日每个小时子段：`online_hours += |段| × I(online(d,段))`，上限 24。
   - 若仅有日末一次投影、无小时明细：可用 `is_online_at_end ? 24 : 0` 作为 **MVP 简化**（文档标注精度限制）。
4. **UPSERT**：`ON CONFLICT (snapshot_date, supplier_device_id) DO UPDATE`。
5. Cron：`15 0 * * *`（上海 00:15，处理 **昨日** 或 **当日 0 点刚结束的日** — 团队需二选一并写死）。

**与 Period `view=daily` 对齐**：`compute-period-resource-composition` 已读 `device_daily_snapshot`。

---

### 步骤 4 — ETL-MD-3 导入实时投影（D3）

1. 打开 `apps/web/src/lib/server/dataaccess/supplier/device-import.ts`。
2. 在 **`device_inventory` commit 成功**、且 `supplier_device` UPSERT 完成之后：
   - 对 **本批次变更设备 ID 列表** 调用 `projectDeviceSnapshotsForDevices({ deviceIds, occurredAt: commitTime })`。
   - 写 **当前小时桶**（ETL-MD-1 逻辑）+ **当前自然日桶**（日末态可先按当前态写，日终 ETL-MD-2 再修正 `online_hours`）。
3. **禁止** 在 `commitChangelog` 路径调用本函数（D2）。
4. 记录 `etl_batch_id` 关联到 `onboarding_batch`（inventory 批次 ID 可选写入 `payload`）。

---

### 步骤 5 — （可选）主数据事件表 + 分段精度（D5）

若需满足 §8.4.1「同桶多次变更分段积分」：

1. 新增 `supplier_device_masterdata_event`（专篇 §5.5，可选 migration）。
2. 在 ETL-MD-1/3 写入快照前 append 事件（`source=inventory_import|scheduled_scan`）。
3. 小时 `online_hours` 改为按事件时间轴切段累加（0~1）。

**无此表时**：读路径仍可用「桶末态 × |τ|」（现网 `aggregateCompositionCardHoursFromSnapshots` 已实现）。

---

### 步骤 6 — 数据质量与对账

1. **行数对账**（每日）：
   - `COUNT(DISTINCT supplier_device_id)` 快照 vs 主数据（排除退订）偏差 < 阈值（如 0.5%）。
2. **延迟告警**：最新 `snapshot_hour` 落后当前时间 > 2h。
3. **空桶**：节假日无扫描时 Period hourly 需 UI 提示（§10.1）— 可在 M6 已实现的 `approximate` 文案上扩展。
4. 手动修复：提供 `pnpm dashboard:snapshot:backfill --from --to` CLI（见 M7 实体回填可合并）。

---

### 步骤 7 — 测试

| 用例 | 期望 |
|------|------|
| PC-T1 | 设备 8 卡、`在集群中` 24h 小时快照 → Period daily 积分 `pool_elastic_only` 卡时 192 |
| PC-T2 | 仅主数据改为 `维护中` → 维护扇区卡时升；**无** change_log 触发快照 |
| PC-T6 | 同一区间日积分 ≈ 小时积分之和（误差 < 1% 或文档约定） |
| — | `getPeriod` 不再出现 `approximate: true`（在区间内有快照覆盖） |

单测：ETL 纯函数 `projectHourlyRow(device, bucketStart)`、`aggregateOnlineHoursFromHourlyRows`。

---

## 4. 涉及文件（建议）

| 路径 | 动作 |
|------|------|
| `packages/db/src/dashboard-schema.ts` | 已存在；可选加 `masterdata_event` |
| `apps/web/src/lib/server/jobs/dashboard-masterdata-snapshot/etl-md-hourly.ts` | **新建** |
| `apps/web/src/lib/server/jobs/dashboard-masterdata-snapshot/etl-md-daily.ts` | **新建** |
| `apps/web/src/lib/server/jobs/dashboard-masterdata-snapshot/project-devices.ts` | **新建**（共享投影） |
| `apps/web/src/lib/server/jobs/register-dashboard-snapshot-cron.ts` | **新建** |
| `apps/web/src/lib/server/dataaccess/supplier/device-import.ts` | ETL-MD-3 Hook |
| `apps/web/src/main.ts` 或现有 job 注册入口 | 注册 cron |
| `apps/web/scripts/backfill-device-snapshots.ts` | 历史灌数（可与 M7 合并） |

**勿改**：`supplier_device_change_log` 写入链；`global-period.ts` KPI 用 change_log 回放可保留（专篇 Q4 另议）。

---

## 5. 验收标准

| ID | 条件 |
|----|------|
| M2-A1 | 每小时有新 `device_hourly_snapshot` 行（或符合增量策略） |
| M2-A2 | 每日有 `device_daily_snapshot` 行，且 `online_hours` ∈ [0,24] |
| M2-A3 | inventory 导入后 5 分钟内对应设备在当前小时/日桶可见 |
| M2-A4 | Period 资源构成 `approximate` 在覆盖区间内为 false |
| M2-A5 | changelog commit 后 **无** 新快照行（抽样审计） |
| M2-A6 | PC-T7：Period 期末各扇区 `gpuCount` 与 Snapshot `resourceComposition` 一致 |

---

## 6. 产品 / 运维约定（§10.1）

| 主数据频率 | Period hourly | Period daily |
|------------|---------------|--------------|
| 每小时扫描 | ✅ 推荐 | ✅ 可聚合 |
| 仅每日扫描 | ⚠️ 需 UI 提示或禁用 hourly | ✅ 推荐 |

实施时在 `ResourcePoolChartCard` 或 meta 增加 `snapshotGranularityHint`（可选）。

---

## 7. 风险与回滚

- **双倍计数**：严禁 change_log 触发 ETL；代码评审 grep `projectDeviceSnapshots` 调用点。
- **桶界错误**：UTC 与 Shanghai 混用会导致 PC-T6 失败；统一用 `period-time.ts`。
- **回滚**：停 cron + 停 import Hook；读路径自动 fallback `approximate`（已实现）。

---

## 8. 完成后衔接

1. **M3**：已为现网代码则复核单测 PC-T1/T5/T6 即可。
2. **M7**：`resource_composition_daily/hourly` 由本 ETL 输出聚合（见 [M7 文档](./global-dashboard-period-composition-m7-dws-acceleration.md)）。

---

## 9. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-29 | 初稿：M2 ETL-MD-1/2/3 可执行步骤 |
