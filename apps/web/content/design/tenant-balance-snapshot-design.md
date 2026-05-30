# 租户账户余额快照设计方案

> 版本：v1.1  
> 日期：2026-05-29  
> 状态：**已实施**  
> 变更：v1.1 — 按 §10 确认项完成编码；§12 记录与初稿差异  
> 关联：`packages/db/src/crm-schema.ts`、`suanli-tenant-api.ts`、`platform-tenant-import-design.md`、`project-billing-scheduled-sync-design.md`、`crm-database.md` §1.1 R3.5

---

## 1. 目标与原则

### 1.1 业务目标

| # | 目标 | 说明 |
|---|------|------|
| G1 | **按小时**追踪账户余额 | 每个计费租户（`tenant`）在东八区每个自然小时保留一条余额快照 |
| G2 | **按天**追踪账户余额 | 每个计费租户在东八区每个自然日保留一条**日末余额**快照 |
| G3 | 与平台真值对齐 | 快照来源于算算力 OpenAPI `coin` / `limit_coin`，换算规则与平台租户导入一致 |
| G4 | 当前余额仍走 `tenant.balance` | 最新快照同步更新 `tenant.balance`（及 `credit_limit`），保持 R3.5 不变 |
| G5 | 可观测 | 记录每次采集任务与租户级成败，Settings 页可查看 |

### 1.2 非目标（本期）

- **不**做余额流水 / ledger（不解释每笔变动原因）
- **不**用「充值 − 消费」反推历史余额（`consumption_usage_daily.balance_amount` 是**余额消费**，不是账户余额）
- **不**改造账单同步时间窗 / 安全窗口（与 `tenant-billing-import` 独立）
- **不**要求平台提供历史余额 API（仅从功能上线日起向前采集；上线前无真值）

### 1.3 设计原则

1. **账户余额 vs 余额消费**：文档与代码中严格区分「账户余额（account balance）」与「余额支付的消费（balance consumption）」。
2. **幂等 upsert**：同一 `(tenant_id, granularity, bucket_start)` 仅一行，重复采集覆盖更新。
3. **复用平台封装**：批量拉取走已有 `fetchPlatformTenantsByIds` + `platformCoinToYuan`（`PLATFORM_COIN_DIVISOR = 1_000_000`）。
4. **与账单同步解耦**：独立 cron、独立 job 表；避免与安全窗口 / 游标逻辑耦合。
5. **单实例互斥**：多副本部署时用 PG advisory lock（与账单同步不同 lock key）。

### 1.4 术语

| 术语 | 含义 |
|------|------|
| 账户余额 | 租户在算算力平台的 `coin`（换算为元），对应 `tenant.balance` |
| 余额消费 | 消费明细中由余额/实付抵扣的金额，对应 `*_balance_amount` |
| 快照桶（bucket） | 小时或日的时间窗口标识，由 `granularity` + `bucket_start` 唯一确定 |
| 日末余额 | 东八区自然日结束时刻的账户余额（由次日 00:05 采集的 `coin` 代表） |

---

## 2. 现状与缺口

### 2.1 已有能力

| 组件 | 说明 |
|------|------|
| `tenant.balance` | 当前账户余额真值；平台导入 / Excel / 手工编辑时更新 |
| `fetchPlatformTenantsByIds` | `GET /admin/tenant/list?tenant_tids=...`，返回 `coin`、`limit_coin` |
| `platformCoinToYuan` | 平台 coin → 人民币元 |
| `billing_sync_job_run` / `item` | 账单同步任务审计（**本期不复用**，职责不同） |
| `node-cron` + `instrumentation.ts` | Web 进程内注册定时任务（见 `register-billing-sync-cron.ts`） |

### 2.2 缺口（v1.1 已闭合）

| 缺口 | 状态 |
|------|------|
| 无余额时间序列表 | ✅ `tenant_balance_snapshot` + 项目详情折线图 |
| `consumption_usage_daily.balance` 列 | ✅ migration `0056` / `0057` 已删除 |
| 无余额采集 job | ✅ `balance_snapshot_job_*` + cron + Settings 立即采集 |

---

## 3. 数据模型

### 3.1 新增：`tenant_balance_snapshot`

租户账户余额快照（小时 / 日）。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | text | PK | 应用层 UUID 或确定性 ID |
| `tenant_id` | text | FK→`tenant.id` NOT NULL | 计费主体 |
| `customer_id` | text | FK→`customer.id` NULL | 冗余，便于客户维度报表 |
| `granularity` | varchar(8) | NOT NULL | `hour` \| `day` |
| `bucket_start` | timestamptz | NOT NULL | 桶起始时刻（东八区对齐，见 §3.2） |
| `bucket_date` | date | NOT NULL | 东八区自然日；冗余便于按日范围查询 |
| `balance` | numeric(20,4) | NOT NULL | 账户余额（元），`tenantMoney` |
| `credit_limit` | numeric(20,4) | NULL | 授信额度（元），来自 `limit_coin` |
| `source` | varchar(32) | NOT NULL DEFAULT `platform_sync` | 见 §3.4 |
| `platform_tenant_id` | varchar(128) | NULL | 采集时平台 ID 快照 |
| `platform_coin_raw` | numeric(20,4) | NULL | 平台原始 coin（未除 divisor），便于对账 |
| `captured_at` | timestamptz | NOT NULL | 实际采集时刻 |
| `job_run_id` | text | FK→`balance_snapshot_job_run.id` NULL | 关联任务 |
| `created_at` / `updated_at` | timestamptz | NOT NULL | 与现有 `crmTimestamps` 一致 |

**唯一约束**：

```sql
CREATE UNIQUE INDEX tenant_balance_snapshot_uk
  ON tenant_balance_snapshot (tenant_id, granularity, bucket_start);
```

**查询索引**：

```sql
CREATE INDEX tenant_balance_snapshot_tenant_date_idx
  ON tenant_balance_snapshot (tenant_id, bucket_date);

CREATE INDEX tenant_balance_snapshot_granularity_date_idx
  ON tenant_balance_snapshot (granularity, bucket_date);
```

**Drizzle 定义位置**：`packages/db/src/crm-schema.ts`（§3.7 经营扩展之后或独立 §3.9）。

### 3.2 时间桶规则（东八区 `Asia/Shanghai`）

统一使用 `@/lib/crm/timezone` 或现有账单工具中的东八区日界 helpers（若无则新增 `crm-time.ts`）。

#### 小时桶 `granularity = 'hour'`

| 字段 | 规则 |
|------|------|
| `bucket_start` | 所属小时的 **整点**（如 `2026-05-29 14:00:00+08:00`） |
| `bucket_date` | `bucket_start` 对应的东八区自然日 |
| 采集 cron | 每小时 **第 5 分**（`5 * * * *`），写入**当前整点**桶（`currentHourBucket`） |

> 例：cron 在 `14:05` 触发 → `bucket_start = 14:00+08:00`，`balance = 14:05 拉取的 coin`。

#### 日桶 `granularity = 'day'`

| 字段 | 规则 |
|------|------|
| `bucket_start` | 该自然日 **00:00:00+08:00**（标识日，非采集时刻） |
| `bucket_date` | 与 `bucket_start` 同日 |
| 日末语义 | `2026-05-28` 的日末余额 = **`2026-05-29 00:05`** 采集的 `coin` |
| 采集 cron | 每日 **00:05**（`5 0 * * *`），`bucket_date = 昨天` |

### 3.3 主键 / 确定性 ID（可选）

```text
hour: balance-hour-{tenant_id}-{bucket_start_iso}
day:  balance-day-{tenant_id}-{bucket_date}
```

upsert 以唯一索引为准；ID 策略与 `consumption_usage_daily` 一致即可。

### 3.4 `source` 枚举

| 值 | 写入场景 |
|----|----------|
| `platform_sync` | 定时 hourly / daily job |
| `platform_import` | 平台租户 ID 批量导入 commit |
| `manual_edit` | 租户详情手工改余额 / Excel 导入余额 |
| `admin_trigger` | Settings「立即采集」手动触发 |

### 3.5 删除：`consumption_usage_daily.balance`

该列注释为「平台同步租户金额」，但：

- 账单同步 **从未写入**
- 与 `balance_amount`（余额消费）易混淆

**迁移**：`ALTER TABLE consumption_usage_daily DROP COLUMN balance;`  
同步更新 Drizzle schema 与设计文档 `project-tenant-daily-consumption-design.md` 中的列说明。

### 3.6 不变：`tenant.balance`

| 规则 | 说明 |
|------|------|
| 真值 | 仍以 `tenant.balance` 为当前余额（R3.5） |
| 更新时机 | 每次成功采集 / 导入 / 手工编辑后 **同步更新** |
| Customer 聚合 | `SUM(tenant.balance)`，逻辑不变 |

---

## 4. 任务与调度

### 4.1 新增 Job 表（独立于账单同步）

#### `balance_snapshot_job_run`

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | |
| `trigger` | varchar(32) | `scheduled` \| `manual` |
| `granularity` | varchar(8) | `hour` \| `day` \| `all`（manual 一次跑两种） |
| `started_at` / `finished_at` | timestamptz | |
| `status` | varchar(32) | `running` \| `success` \| `partial` \| `failed` |
| `tenant_count` | int | 目标租户数 |
| `success_count` / `failed_count` / `skipped_count` | int | |
| `error_summary` | text | |

#### `balance_snapshot_job_item`

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | |
| `job_run_id` | text FK | |
| `tenant_id` | text FK | |
| `status` | varchar(32) | `success` \| `failed` \| `skipped` |
| `granularity` | varchar(8) | 本条写入的粒度 |
| `bucket_start` | timestamptz | |
| `error` | text | |

索引：`job_run_id`、`tenant_id`。

### 4.2 采集范围

逻辑（与账单定时同步 `collectTenantTargets` 一致）：

1. 查 `project.status IN (BILLING_SYNC_PROJECT_STATUSES)`，默认 `active`
2. 对每个项目调用 `getBillingTenantIdsForProject`（primary → project_tenant → 客户默认 tenant）
3. 租户 ID 去重后，过滤 `platform_tenant_id` 非空

| 项 | 规则 |
|----|------|
| 租户过滤 | **活跃项目**（`project.status`，默认 `active`，与 `BILLING_SYNC_PROJECT_STATUSES` 一致）关联租户；去重后仅保留有 `platform_tenant_id` 的 |
| 批量请求 | `fetchPlatformTenantsByIds`，每批 ≤100（已有） |
| 平台未返回 | item 标记 `skipped`，不更新 `tenant.balance` |
| 部分失败 | job `partial`；其它租户继续 |

### 4.3 采集流程（核心）

```typescript
async function captureBalanceSnapshots(input: {
  granularity: 'hour' | 'day'
  trigger: 'scheduled' | 'manual'
  bucketStart: Date      // 由调度层按 §3.2 计算
  bucketDate: string     // YYYY-MM-DD
}): Promise<BalanceSnapshotRunResult>
```

1. `pg_try_advisory_lock(BALANCE_SNAPSHOT_LOCK_KEY)` — 失败则跳过并打日志  
2. 插入 `balance_snapshot_job_run`（`running`）  
3. 查询目标租户列表  
4. 按 `platform_tenant_id` 批量调 OpenAPI  
5. 对每个租户（事务内）：
   - `balance = platformCoinToYuan(coin).toFixed(4)`
   - `credit_limit = limit_coin != null ? platformCoinToYuan(limit_coin).toFixed(4) : null`
   - upsert `tenant_balance_snapshot`
   - `UPDATE tenant SET balance = ..., credit_limit = ... WHERE id = ?`
   - 写 `balance_snapshot_job_item`
6. 更新 job_run 汇总状态，释放 lock  

**幂等**：同桶重复跑覆盖 `balance`、`captured_at`、`updated_at`。

### 4.4 Cron 注册

新增 `register-balance-snapshot-cron.ts`，在 `instrumentation.ts` 中与账单 cron **并列注册**。

| 环境变量 | 默认 | 说明 |
|----------|------|------|
| `BALANCE_SNAPSHOT_ENABLED` | `false` | `true` 才注册 cron |
| `BALANCE_SNAPSHOT_HOURLY_CRON` | `5 * * * *` | 小时快照 |
| `BALANCE_SNAPSHOT_DAILY_CRON` | `5 0 * * *` | 日末快照 |
| `BALANCE_SNAPSHOT_TIMEZONE` | `Asia/Shanghai` | 与账单同步一致 |

**Advisory lock key**：`89451236790`（与 `billing-scheduled-sync` 的 `89451236789` 错开）。

### 4.4.1 与账单同步的关系

| 维度 | 账单同步 | 余额快照 |
|------|----------|----------|
| 数据源 | 账单 / 用量 / 充值 API | `tenant/list` 的 `coin` |
| 频率 | 日（默认 05:00） | 小时 + 日（00:05） |
| 安全窗口 | 有（默认 T-2） | **无** |
| Job 表 | `billing_sync_job_*` | `balance_snapshot_job_*` |

两者 **不合并** 为同一 job，避免失败互相影响。

### 4.5 同步写入钩子（非 cron）

在以下路径 **commit 成功后** 调用 `writeManualSnapshot`（hour + day 双桶，`job_run_id` 为空）：

| 路径 | source | 状态 |
|------|--------|------|
| `platform-tenant-import.ts` commit | `platform_import` | ✅ 已实施 |
| `billing-tenants.ts` Excel 导入 | `manual_edit` | ⏸ 未接 |
| `billing-tenants.ts` update 改 balance | `manual_edit` | ⏸ 未接 |

桶规则：

- 写 **hour** 桶：当前东八区整点
- 写 **day** 桶：当前东八区自然日（覆盖当日最新手工值）

---

## 5. API 与读路径

### 5.1 tRPC（已实施）

| 过程 | 权限 | 说明 |
|------|------|------|
| `crm.projects.listBalanceSnapshots` | `protectedProcedure` | 项目维度多租户折线数据（`listForProject`） |
| `crm.balanceSnapshot.runNow` | `adminProcedure` | `{ granularity?: 'hour' \| 'day' \| 'all' }` |
| `crm.balanceSnapshot.getConfig` | `adminProcedure` | `BALANCE_SNAPSHOT_*` env |
| `crm.balanceSnapshot.listRuns` / `getRunById` | `adminProcedure` | job 审计 |

**未单独暴露**（本期无 UI 需求，可在 data access 层扩展）：`listSnapshots`、`getBalanceAt`、`listCustomerSnapshots`。

### 5.2 查询示例

**租户日余额曲线（近 30 天）**：

```sql
SELECT bucket_date, balance, credit_limit, captured_at
FROM tenant_balance_snapshot
WHERE tenant_id = $1
  AND granularity = 'day'
  AND bucket_date BETWEEN $2 AND $3
ORDER BY bucket_date;
```

**某时刻余额（小时优先）**：

```sql
SELECT *
FROM tenant_balance_snapshot
WHERE tenant_id = $1
  AND granularity = 'hour'
  AND bucket_start <= $2
ORDER BY bucket_start DESC
LIMIT 1;
```

**客户级当前余额**：仍 `SUM(tenant.balance)`；历史曲线如需客户级，API 层对下属 tenant 分别返回或在 UI 选 tenant。

---

## 6. UI

### 6.1 项目详情 · 概览 Tab（**本期实施**）

| 组件 | 路径 | 说明 |
|------|------|------|
| `ProjectBalanceTrendChart` | `project-balance-trend-chart.tsx` | 全宽卡片，置于消费趋势图上方 |
| 数据 API | `crm.projects.listBalanceSnapshots` | 按项目关联租户聚合快照 |

**交互**：

| 控件 | 行为 |
|------|------|
| Tab「按天 / 按小时」 | 切换 `granularity` |
| 月份选择（按天） | 过滤 `usageMonth`，X 轴为 `MM-DD` |
| 日期选择（按小时） | 过滤 `usageDate`，X 轴为 `HH:00` |
| 多租户 | 每个关联租户一条折线，Legend 显示租户名 |
| 空态 | 无关联租户 / 无快照时提示开启采集或手动采集 |

**租户范围**：与账单同步一致，走 `getBillingTenantIdsForProject`（primary → project_tenant → 客户默认 tenant）。

### 6.2 Settings · 余额快照

并入 `billing-sync-settings-content.tsx`：

- 调度配置（`BALANCE_SNAPSHOT_*` env）
- 「立即采集」按钮（`crm.balanceSnapshot.runNow`）
- 最近采集 job 列表

### 6.3 客户 / 租户详情

**本期不改**；后续可复用 `listSnapshots` 按单 tenant 展示。

---

## 7. 文件清单（已实施）

| 层级 | 文件 | 状态 |
|------|------|------|
| Schema | `packages/db/src/crm-schema.ts` | ✅ 3 表 + relations |
| Migration | `packages/db/drizzle/0056_tenant_balance_snapshot.sql`、`0057_yielding_pestilence.sql` | ✅ 建表 + 删 `consumption_usage_daily.balance` |
| 集成 | `suanli-tenant-api.ts` | ✅ 复用，无改动 |
| 时间桶 | `apps/web/src/lib/crm/balance-snapshot-utils.ts` | ✅ 东八区 hour/day 桶 |
| Data access | `apps/web/src/lib/server/dataaccess/crm/balance-snapshot.ts` | ✅ 采集、upsert、`listForProject` |
| Config | `apps/web/src/lib/server/dataaccess/crm/balance-snapshot-config.ts` | ✅ |
| Job | `apps/web/src/lib/server/jobs/register-balance-snapshot-cron.ts` | ✅ |
| Hook | `platform-tenant-import.ts` | ✅ `writeManualSnapshot`（`platform_import`） |
| Hook | `billing-tenants.ts` | ⏸ Excel / 手工改余额未挂钩子（见 §12.2） |
| Router | `apps/web/src/lib/server/routers/crm/index.ts` | ✅ `balanceSnapshot` + `projects.listBalanceSnapshots` |
| Types | `apps/web/src/lib/types/balance-snapshot.ts` | ✅ |
| UI · Settings | `billing-sync-settings-content.tsx` | ✅ `BalanceSnapshotSettingsSection`（并入账单同步设置页） |
| UI · 项目 | `project-balance-trend-chart.tsx`、`project-detail-content.tsx` | ✅ 概览 Tab 全宽折线图 |
| Instrumentation | `apps/web/src/instrumentation.ts` | ✅ 与账单 cron 并列注册 |
| 设计 | `crm-database.md` | ⏸ R3.5 快照表说明待补（见 §12.2） |

---

## 8. 迁移与上线

### 8.1 部署顺序

1. 跑 migration（新表 + 删列）
2. 部署 web（含 data access + cron 注册，**默认 ENABLED=false**）
3. 运维设置 `BALANCE_SNAPSHOT_ENABLED=true`
4. 手动 **立即采集** 验证；观察 job run
5. 等待 24h 确认 hourly / daily 桶数据正常

### 8.2 历史数据

| 场景 | 处理 |
|------|------|
| 上线日前 | **无快照**；UI 展示「暂无历史」 |
| 是否需要回填 | **本期不做**；若未来平台提供历史 coin API 再开回填 job |
| 当前 `tenant.balance` | 首次 successful job 后与平台对齐；此前手工值可能被覆盖 |

### 8.3 容量估算

假设 500 租户：

| 粒度 | 行/租户/年 | 500 租户/年 |
|------|------------|-------------|
| hour | 8,760 | ~438 万 |
| day | 365 | ~18 万 |

单行 ~200B → 年增量约 **1GB 内**。可按 `bucket_date` 分区或 2 年后归档（**本期不实施归档**）。

---

## 9. 测试计划

| # | 用例 | 预期 | 状态 |
|---|------|------|------|
| T1 | 单租户 hourly upsert 两次 | 同桶仅一行，`captured_at` 更新 | 联调 / 立即采集 |
| T2 | daily job 在 00:05 | `bucket_date = 昨天`，balance 来自平台 coin | 需 `BALANCE_SNAPSHOT_ENABLED=true` 观察 24h |
| T3 | 平台未返回某 ID | item `skipped`，tenant.balance 不变 | 代码路径已实现 |
| T4 | 平台导入 commit | snapshot `source=platform_import` + tenant.balance 更新 | ✅ `platform-tenant-import.ts` |
| T5 | advisory lock 占用 | 第二次 run 跳过或抛错 | ✅ `89451236790`；`runNow` 抛「任务正在运行」 |
| T6 | 项目折线图日期范围 | 月 / 日过滤与排序正确 | ✅ `listBalanceSnapshots` |
| T7 | migration 删 `consumption_usage_daily.balance` | 现有 import / billing 不受影响 | ✅ `0056`/`0057` |

> 未新增独立 `*.test.ts`；上线前建议按 §8.1 做一次「立即采集」+ 项目详情图 spot check。

---

## 10. 待确认项

| # | 问题 | 结论 | 确认 |
|---|------|------|------|
| Q1 | 小时桶用「上一整点」还是「当前整点」？ | **当前整点**（`:05` 写入所属小时，与 §3.2 示例 `14:05→14:00` 一致；`currentHourBucket`） | ☑ |
| Q2 | 日末用「次日 00:05 采集」还是「当日 23:05 最后 hour 快照」？ | **次日 00:05 独立 daily job**（`previousDayBucket`） | ☑ |
| Q3 | 采集范围 | **仅 active 项目关联租户**（`listSnapshotTargets` + `getBillingTenantIdsForProject`） | ☑ |
| Q4 | 是否删除 `consumption_usage_daily.balance`？ | **删除** | ☑ |
| Q5 | Settings UI | **并入** `billing-sync-settings-content.tsx` | ☑ |
| Q6 | tRPC 权限 | **项目图表 protected；runNow / job 列表 admin** | ☑ |
| Q7 | 项目详情页余额折线图 | **概览 Tab** `ProjectBalanceTrendChart` | ☑ |

---

## 11. 实施里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| **M1** | Schema + migration | ✅ |
| **M2** | `balance-snapshot.ts` 采集核心 | ✅（无独立单元测试文件） |
| **M3** | Cron + env + instrumentation | ✅ 默认 `BALANCE_SNAPSHOT_ENABLED=false` |
| **M4** | 导入 / 编辑钩子 | ✅ 平台导入；⏸ `billing-tenants` 手工路径 |
| **M5** | tRPC + Settings UI + 项目详情折线图 | ✅ |
| **M6** | 文档 | ⏸ `crm-database.md` 快照表说明待补 |

---

## 12. 实施记录（v1.1）

### 12.1 上线检查（运维）

1. 执行 migration `0056` / `0057`
2. 部署 web（cron 已注册，**默认不开启**）
3. 设置 `BALANCE_SNAPSHOT_ENABLED=true` 后重启
4. Settings → **余额快照采集** → **立即采集** 验证 job run
5. 项目详情 → 概览 → **余额变动** 折线图有数据
6. 观察 24h 确认 hourly / daily 桶写入正常

### 12.2 与初稿差异（已知）

| 项 | 初稿 | 实现 |
|----|------|------|
| 小时桶 | §10 Q1 文案写「上一整点」 | 与 §3.2 示例一致：**当前整点**（`currentHourBucket`） |
| Settings UI 文件 | 独立 `balance-snapshot-settings-content.tsx` | 并入 `billing-sync-settings-content.tsx` |
| tRPC 读路径 | `crm.balanceSnapshot.listSnapshots` 等 | 项目读路径：`crm.projects.listBalanceSnapshots` |
| `billing-tenants` 钩子 | Excel / update 写 `manual_edit` | **未接**；仅平台导入写 `platform_import` |
| `crm-database.md` | §3.7 / R3.5 补充快照表 | **未更新** |
| 单元测试 | M2 提及 | **未新增** `*.test.ts` |

### 12.3 后续可选

- `billing-tenants.ts` commit 后调用 `writeManualSnapshot`（`manual_edit`）
- 客户 / 租户详情复用 `listSnapshots` 单租户曲线
- `crm-database.md` 补充 `tenant_balance_snapshot` 与 job 表说明
- 余额快照归档 / 分区（§8.3 容量规划）
