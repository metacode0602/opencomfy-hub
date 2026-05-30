# 全局大盘 Period 卡时 — M7 实施步骤（DWS 预聚合与历史回填）

**阶段**：M7  
**产品决策（2026-05-29）**：**本期不实施**。Period 资源构成 **永久走 L3 在线聚合**（`computePeriodResourceComposition`），不建 `pipeline_gap_*` / `resource_composition_*` 四张 DWS 表，不注册 `etl_pg_*` / `etl_rc_*` Cron，不执行 H5 DWS 历史回填。  
**目标（归档）**：若未来性能不足再启动——通过 L2 DWS 预计算计划缺口与互斥构成卡时，缩短 `getPeriod` 延迟；**不改变口径**。  
**依赖（若重启）**：**M1**（`onboarding_batch_progress_event`）、**M2**（`device_*_snapshot`，本期以 **ETL-MD-3 导入投影** 为主，见 [M2 文档](./global-dashboard-period-composition-m2-masterdata-etl.md)）  
**权威口径**：[global-dashboard-period-composition-card-hours-design.md](./global-dashboard-period-composition-card-hours-design.md) §5.6、§3.2.3；[global-dashboard-resource-composition-chart-design.md](./global-dashboard-resource-composition-chart-design.md) §14.8–§14.9  

**现网说明**：`compute-period-resource-composition.ts` 在线积分已满足业务；**不上 M7 对 Period 数值无影响**，仅无预聚合加速。下文步骤保留为 **远景实施手册**，非当前排期。

### 不实施 M7 时的约定

| 项 | 约定 |
|----|------|
| Period 数据正确性 | 与实施 M7 一致（在线路径为权威基准） |
| `approximate` | 仅由 **M2 快照覆盖** 决定，与 M7 无关 |
| 性能 | 长区间 / 按小时 Period 可能较慢；接受或优化在线 SQL/索引 |
| 历史 | 依赖 M1 事件回填 + M2 导入投影 / `backfill-device-snapshots`（H4），**无** H5 |
| 重启条件 | 例如：全局 filter 下 `getPeriod` P95 持续超阈值，或需日终 DWS 对账表 |

---


## 1. 交付物清单

| # | 交付物 | 说明 |
|---|--------|------|
| D1 | `pipeline_gap_daily` / `pipeline_gap_hourly` | 计划缺口截面 + 桶内积分 |
| D2 | `resource_composition_daily` / `resource_composition_hourly` | 互斥 `bucket_key` × 卡型预聚合 |
| D3 | ETL-PG：计划缺口 DWS | 由 `progress_event` + link 日/小时终回放 |
| D4 | ETL-RC：构成 DWS | 由 `device_*_snapshot` + pipeline gap 聚合 |
| D5 | `getPeriod` 读路径优先 DWS | 类似 `tryDailyKpiTrend`，缺失则在线算 |
| D6 | 历史回填 H1–H4 | 批次事件 + 设备快照 + DWS 回灌 |

---

## 2. 前置条件

- [ ] **M1 完成**：`replayPipelineGapAt(T)` 与线上一致；历史 `progress_event` 至少 H1 回填完成。
- [ ] **M2 完成**：目标日期范围内 `device_hourly_snapshot` / `device_daily_snapshot` 覆盖率达标（见 [M2 文档](./global-dashboard-period-composition-m2-masterdata-etl.md) M2-A1–A3）。
- [ ] M3–M6 在线聚合已上线且口径评审通过（作为 DWS 对账基准）。
- [ ] 确认全局 filter 维度：是否预聚合 `filters_hash`（`region/supplier/cardType/dataCenter`）或仅 **全量大盘** 一档（建议一期仅 `filters_hash = 'global'` 降低基数）。

---

## 3. Schema 与 Migration（D1、D2）

### 3.1 `pipeline_gap_daily` / `pipeline_gap_hourly`

在 `packages/db/src/dashboard-schema.ts` 新增（专篇 §5.6）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | |
| `snapshot_date` / `snapshot_hour` | date / timestamptz | UK 组成部分 |
| `gap_kind` | varchar | `pending_access` \| `retiring` |
| `device_count` / `gpu_count` | integer | 日/小时 **末** 缺口截面 |
| `machine_hours` / `card_hours` | numeric(15,4) | 桶内缺口积分（ETL 预计算） |
| `supplier_id` / `data_center_id` / `gpu_card_type_id` | 可选 | 维度拆分时使用 |
| `filters_hash` | jsonb | 预聚合过滤键，如 `{ "region":"all", ... }` |
| `etl_batch_id` | text | 对账 |

**唯一键建议**：`(snapshot_date|snapshot_hour, gap_kind, filters_hash)` 或再加维度列。

### 3.2 `resource_composition_daily` / `resource_composition_hourly`

| 字段 | 类型 | 说明 |
|------|------|------|
| `snapshot_date` / `snapshot_hour` | 时间键 | |
| `bucket_key` | varchar | 与 `RESOURCE_COMPOSITION_BUCKET_KEYS` 一致 |
| `kind` | varchar | `entity` \| `pipeline_virtual` |
| `gpu_card_type_id` | text FK | 可选；`NULL` 表示扇区合计 |
| `device_count` / `gpu_count` | integer | 期末截面（辅助） |
| `machine_hours` / `card_hours` | numeric(15,4) | 桶内积分 |
| `filters_hash` / `etl_batch_id` | | 同上 |

### 3.3 Migration

1. `pnpm db:generate --name dashboard_dws_composition_pipeline_gap`
2. 评审索引：`(snapshot_date, bucket_key)`、`(snapshot_hour, gap_kind)` 等。
3. `pnpm db:migrate`

---

## 4. ETL 实施步骤

### 步骤 1 — ETL-PG：计划缺口 DWS（D3）

**作业**：`etl_pg_daily` / `etl_pg_hourly`

对每个 **自然日 D**（或整点 H）：

1. 初始化 `filters_hash` 列表（一期可只跑 `global` 全量）。
2. 对每个 `gap_kind ∈ { pending_access, retiring }`：
   - `at_end` = 日末 23:59:59.999 上海 / 小时末
   - `gap = pipelineGapAt(kind, at_end, filters)`（M1 回放函数）
   - 对日内每个小时桶 τ（或小时作业仅当前 H）：
     - `gap_start = pipelineGapAt(kind, τ.start, filters)`
     - `card_hours += gap_start.gpu × |τ|`，`machine_hours += gap_start.device × |τ|`
3. UPSERT 入 `pipeline_gap_*`。
4. 写 `dashboard_etl_batch`（`job_code=etl_pg_daily`）。

**Cron**：每日 00:30（在 ETL-MD-2 之后）；小时作业可选每小时第 10 分钟。

---

### 步骤 2 — ETL-RC：构成 DWS（D4）

**作业**：`etl_rc_daily` / `etl_rc_hourly`

输入：

- 当日/当小时 `device_*_snapshot`
- 同桶 `pipeline_gap_*`（计划扇区 `pending_access_pipeline` / `retiring_pipeline`）

处理：

1. 调用与线上一致的纯函数（避免重复实现）：
   - `aggregateCompositionCardHoursFromSnapshots(...)` → 实体各 `bucket_key`
   - 计划扇区卡时从 `pipeline_gap_*` 或再次 `aggregatePipelineCardHoursFromGapSeries`
2. 按 `(bucket_key, gpu_card_type_id?)` 展开行写入 `resource_composition_*`。
3. **闭合对账**：`Σ card_hours` 应等于在线 `computePeriodResourceComposition` 同 filters 同区间结果（抽样）。

---

### 步骤 3 — 读路径改造（D5）

1. 在 `compute-period-resource-composition.ts`（或薄封装 `tryPeriodCompositionFromDws`）：
   - `granularity === 'day'` 且区间对齐自然日时，查询 `resource_composition_daily` + `pipeline_gap_daily`。
   - 命中且 `etl_batch_id` 新鲜度 < 阈值（如 36h）→ 组装 `GlobalResourceCompositionPayload`。
2. 未命中 → **现有在线积分**（当前逻辑），`dashboardLog` phase=`period-composition-fallback`。
3. 与 `global-period.ts` 中 `tryDailyKpiTrend` 模式保持一致，便于运维理解。

**注意**：DWS 行若只存 `filters_hash=global`，带 `supplierId` 过滤的请求仍走在线算。

---

## 5. 历史回填（D6）

按 resource-composition §14.9 + 专篇 §14 阶段表：

| 阶段 | 依赖 | 动作 | 脚本建议 |
|------|------|------|----------|
| **H1** | M1 | 批次 `progress_event` 最小回填 | `backfill-batch-progress-events.ts`（见 [M1](./global-dashboard-period-composition-m1-progress-event.md) 步骤 6） |
| **H2** | H1 | 按 link 合成触达跃迁事件 | `backfill-progress-events-from-links.ts` |
| **H3** | H2 | 补 `plan_revised`（有审计则解析） | 可选 |
| **H4** | M2 + H2 | 设备快照回填 N 天 | `backfill-device-snapshots.ts --from YYYY-MM-DD --to YYYY-MM-DD` |
| **H5** | H4 | 从回填日起向前跑 `etl_pg_*` + `etl_rc_*` | `backfill-dws-composition.ts` |

**回填顺序**：H1 → H2 → H4（可与 M2 并行）→ H5；禁止未灌快照先跑 ETL-RC。

**对账抽样**（每个阶段结束）：

- 随机 5 个自然日、全局 filter：`DWS` vs `在线 computePeriodResourceComposition` 总卡时误差 < 0.5%。
- 计划缺口：`pipeline_gap_daily` 日末 `gpu_count` vs `pipelineGapAt(end)`。

---

## 6. 涉及文件（建议）

| 路径 | 动作 |
|------|------|
| `packages/db/src/dashboard-schema.ts` | 新增 4 张 DWS 表 |
| `packages/db/drizzle/00xx_*.sql` | migration |
| `apps/web/src/lib/server/jobs/dashboard-dws/etl-pipeline-gap-daily.ts` | **新建** |
| `apps/web/src/lib/server/jobs/dashboard-dws/etl-resource-composition-daily.ts` | **新建** |
| `apps/web/src/lib/server/dataaccess/dashboard/compute-period-resource-composition.ts` | DWS 优先读 |
| `apps/web/src/lib/server/dataaccess/dashboard/try-period-composition-dws.ts` | **新建**（可选） |
| `apps/web/scripts/backfill-device-snapshots.ts` | H4 |
| `apps/web/scripts/backfill-dws-composition.ts` | H5 |

---

## 7. 验收标准

| ID | 条件 |
|----|------|
| M7-A1 | 4 张 DWS 表 migration 成功 |
| M7-A2 | 昨日 `pipeline_gap_daily` 与 `replayPipelineGapAt(日末)` 一致 |
| M7-A3 | 昨日 `resource_composition_daily` 与在线聚合总卡时一致（global filter） |
| M7-A4 | `getPeriod` 在 DWS 命中时 P95 延迟显著低于纯在线（团队自定阈值，如 < 500ms） |
| M7-A5 | DWS 缺失时自动 fallback，大盘不白屏 |
| M7-A6 | 历史回填完成后，过去 90 天 Period 查询不再标 `approximate`（有计划侧标记的区间除外） |

---

## 8. 运维与监控

| 项 | 建议 |
|----|------|
| 跑批失败 | `dashboard_etl_batch.status=failed` 告警 |
| 新鲜度 | 日表最新 `snapshot_date < today-1` 告警 |
| 容量 | `resource_composition_*` 行数 ≈ 天数 × 桶数 × 卡型数 × filters 档数，提前评估分区/归档 |
| 重跑 | 支持按 `snapshot_date` 幂等 UPSERT 重算 |

---

## 9. 风险与回滚

- **口径漂移**：DWS ETL 必须复用 M3/M4 纯函数，禁止复制公式。
- **过滤维度爆炸**：过早支持多维 `filters_hash` 会导致存储膨胀；一期建议仅 global。
- **回滚**：`getPeriod`  Feature flag `USE_PERIOD_COMPOSITION_DWS=false` 即回在线聚合；DWS 表可保留。

---

## 10. 与实施阶段总表关系

| 总表阶段 | M7 对应 |
|----------|---------|
| M1 | H1–H3 批次事件回填 |
| M2 | H4 设备快照回填 |
| M7 | Schema + ETL-PG/RC + 读路径 + H5 |

**建议排期（已废止）**：~~M1 → M2 → M3–M6 → M7~~ → **当前**：M1 → M2（ETL-MD-3）→ M3–M6；**M7 关闭**。

---

## 11. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-29 | 初稿：M7 DWS + 历史回填可执行步骤 |
| v1.1 | 2026-05-29 | **产品决策：本期不实施**；Period 永久在线聚合；文档改为远景手册 |
