# 全局大盘 Period 卡时 — M1 实施步骤（批次进度事件）

**阶段**：M1  
**目标**：建立 `onboarding_batch_progress_event` 权威时间轴，并在批次 CRUD / `refreshBatchProgress` 链路上自动落事件。  
**依赖**：无（可先于 M2 启动）  
**阻塞**：M4（`aggregatePipelineCardHoursFromEvents`）、M7 计划侧历史回填  
**权威口径**：[global-dashboard-period-composition-card-hours-design.md](./global-dashboard-period-composition-card-hours-design.md) §5.4、§9、§11 ETL-BE-1/BE-2；[global-dashboard-resource-composition-chart-design.md](./global-dashboard-resource-composition-chart-design.md) §14.4–§14.9  

**现网说明**：M3–M6 已落地时，计划卡时仍用 `computePipelineGapsAt`（batch+link）近似；M1 完成后需切换 M4 读路径并去掉 `approximate` 计划标记。

---

## 1. 交付物清单

| # | 交付物 | 说明 |
|---|--------|------|
| D1 | Drizzle 表 `onboarding_batch_progress_event` | `supply-schema.ts` + migration |
| D2 | `appendBatchProgressEvent` | 统一写入函数（建议路径见下） |
| D3 | Hook：批次创建 / 修订 / 状态变更 | `onboarding-batch.ts` 等 |
| D4 | Hook：`refreshBatchProgress` 末尾 | `batch-progress.ts` |
| D5 | 历史回填脚本 ETL-BE-2 | 一次性 `batch_created` + `progress_synced` |
| D6 | 单测 + 集成校验 | 回放 `replayPipelineGapAt(T)` 与现网 `computePipelineGapsAt` 在 `T=now` 一致 |
| D7 | **手动调整批次** API | 运营修正计划/状态，双写审计 + `progress_event` |
| D8 | **审计记录** | `supplier_activity` + 事件 `payload` 结构化 diff |
| D9 | **页面入口** | 批次详情「调整计划」+ 全局大盘差异表跳转 |

---

## 2. 前置条件

- [ ] 已阅读专篇 §4（`change_log` **不** 写实体快照）、§9.2–§9.3（缺口时点 + 阶梯积分）。
- [ ] `refreshBatchProgress` 现网行为稳定（`apps/web/src/lib/server/dataaccess/supplier/batch-progress.ts`）。
- [ ] 确认 `onboarding_batch` 字段齐全：`planned_device_count`、`planned_gpu_count`、`touched_device_count`、`batch_kind`、`batch_status`、`progress_synced_at` 等。
- [ ] 团队约定：`event_type` 枚举与 §14.4.1 一致，不做临时扩展字段到业务表。

---

## 3. 实施步骤

### 步骤 1 — Schema 与 Migration（D1）

1. 在 `packages/db/src/supply-schema.ts` 新增表 `onboarding_batch_progress_event`，字段与专篇 §5.4 对齐：
   - PK `id`（text，cuid2）
   - FK `onboarding_batch_id` → `onboarding_batch.id`
   - `occurred_at`、`event_type`、`batch_kind`、`batch_status`
   - `planned_device_count`、`planned_gpu_count`、`touched_device_count`、`touched_pipeline_gpu`
   - 过滤冗余：`supplier_id`、`data_center_id`、`idc_region`
   - 可选 `payload`（jsonb：`source`、`operator`、`diff` 等）
2. 建索引（专篇 §5.4）：
   - `(onboarding_batch_id, occurred_at)`
   - `(occurred_at)`
   - `(batch_kind, occurred_at)`
   - `(supplier_id, data_center_id, occurred_at)`
3. 在 `packages/db` 执行 `pnpm db:generate --name onboarding_batch_progress_event`，评审 SQL 后 `pnpm db:migrate`。
4. 确认 `packages/db/src/schema.ts` 通过 `export * from supply-schema` 导出 relations（可选 `onboardingBatchProgressEventRelations`）。

**禁止**：从 `supplier_device_change_log` 直接 INSERT 本表；仅经业务批次服务写入。

---

### 步骤 2 — 写入 API `appendBatchProgressEvent`（D2）

1. 新建 `apps/web/src/lib/server/aggregation/batch-progress-events.ts`（或 `dataaccess/supplier/batch-progress-events.ts`，与 resource-composition 设计 §14.5 一致）。
2. 定义类型：

```typescript
export type BatchProgressEventType =
  | 'batch_created'
  | 'plan_revised'
  | 'progress_synced'
  | 'status_changed'
  | 'batch_completed'
  | 'batch_cancelled'
```

3. 实现 `appendBatchProgressEvent({ batchId, eventType, occurredAt?, tx? })`：
   - 在同一事务 `tx` 内（若传入）：
     1. `SELECT` 当前 `onboarding_batch` 行；
     2. `SUM(metricGpuCount)` over `onboarding_batch_device_link` + `supplier_device`（与 `refreshBatchProgress` 统计口径一致）→ `touched_pipeline_gpu`；
     3. `INSERT` 事件行（快照字段为 **写入后** 批次态）；
   - 使用 `supplierLog` / `supplierError` 记录 phase=`batch-progress-event`。
4. **`progress_synced` 去重**（§14.4.1）：与上一条同批次事件对比 `touched_device_count`、`touched_pipeline_gpu`、`planned_*`、`batch_status`；无变化则 **跳过 INSERT** 并 `supplierWarn`。
5. 对不存在的 `batchId`：`supplierError` 后抛错，不静默失败。

---

### 步骤 3 — Hook：`refreshBatchProgress`（D4）

1. 打开 `apps/web/src/lib/server/dataaccess/supplier/batch-progress.ts`。
2. 在 `refreshBatchProgress` **成功更新** `onboarding_batch` 缓存字段之后（仍在同一 `runner` / 事务内）：
   - 调用 `appendBatchProgressEvent({ batchId, eventType: 'progress_synced', occurredAt: syncedAt, tx: runner })`。
3. 下架批次 `refreshDeviceRetireBatchProgress` 分支同样落 `progress_synced`（或按业务增加 `status_changed`）。
4. 若 refresh 因「批次不存在 / 不支持 kind」提前 return，**不** 写事件。

**验收点**：`device-import.ts` / `commitChangelog` 触发的 refresh 自动带事件，无需在 import 里重复 INSERT。

---

### 步骤 4 — Hook：批次生命周期（D3）

| 触发点 | 文件（建议） | `event_type` |
|--------|--------------|--------------|
| 创建上架/订单/下架批次 | `onboarding-batch.ts`、`datacenter-device-retire.ts` | `batch_created` |
| 修订 `planned_lines_json` / planned 计数 | `onboarding-batch.ts` | `plan_revised` |
| `batch_status` 变更（含工单、下架状态机） | `onboarding-batch.ts`、retire 相关 | `status_changed` |
| 进入终态 `已完成` / `已取消` | 状态机收敛处 | `batch_completed` / `batch_cancelled` |

实施要点：

1. 每个写 `onboarding_batch` 的入口在 **同一事务** 末尾调用 `appendBatchProgressEvent`。
2. `occurred_at` 默认 `new Date()`；历史导入可显式传入。
3. 创建时 `touched_* = 0`，`touched_pipeline_gpu = 0`。

---

### 步骤 4b — 手动调整批次、审计与页面入口（D7–D9）

> 背景：计划卡时回放依赖 `progress_event` 时间轴；若仅允许导入/系统自动变更，历史纠错与商务修订无法留痕，Period 会长期 `approximate`。本步骤在 M1 内与 Hook **同批交付**，保证人工修正可审计、可回放。

#### 4b.1 业务范围

| 可调整项 | 写入 `onboarding_batch` | `event_type` | 说明 |
|----------|-------------------------|--------------|------|
| 计划行 `plan_lines` | `planned_lines_json` + `onboarding_batch_plan_line` 双写 | `plan_revised` | 卡型×合作类型×数量；重算 `planned_device_count` / `planned_gpu_count` |
| 计划完成时间 | `planned_ready_at` | `plan_revised` | 可选与计划行同单提交 |
| 批次状态（有限） | `batch_status` | `status_changed` | 仅允许设计内白名单迁移（见下） |
| 备注 / 工单号（纠错） | `remark` / `work_order_no` | `plan_revised` 或独立 `metadata` | 不单独改缺口，但须进审计 |

**不可通过本入口调整**（须走原业务流程）：

- `touched_*`（由 `refreshBatchProgress` + `device_link` 驱动，禁止手填覆盖）
- `device_changelog` / 主数据导入（仍走导入 commit）
- 已 `已完成` / `已取消` 批次的计划上调（须先走状态回退或新建批次，若产品允许回退须单独评审）

**适用 `batch_kind`**：`online`、`order_access`、`device_retire`（下架批次仅调整计划台数/GPU 与状态，字段映射见 retire 设计）。

---

#### 4b.2 校验规则（服务端强制）

```
planned_device_count = Σ line.planned_quantity
planned_gpu_count    = Σ line.planned_quantity × metricGpuCount(line)
∀ line: planned_quantity > 0
∀ line: 卡型+合作类型 批次内唯一

// 防双计 / 数据质量
planned_device_count >= touched_device_count   // 来自 refresh 缓存或实时 link 计数
planned_gpu_count    >= touched_pipeline_gpu    // 可选软校验：仅 warn 不阻断（团队可配置）

// 终态锁
batch_status ∈ {已完成, 已取消} → 拒绝调整计划（HTTP 409）
```

调整成功后 **不** 自动改 `supplier_device`；若需刷新触达统计，运营显式触发「同步进度」（调用既有 `refreshBatchProgress`）或等待下一次 changelog commit。

---

#### 4b.3 审计双写（必须）

人工调整在同一事务内完成 **三层留痕**：

| 层 | 载体 | 用途 |
|----|------|------|
| **A. 运营时间线** | `supplier_activity` | 人读审计、供应商详情活动流 |
| **B. 机器时间轴** | `onboarding_batch_progress_event` | Period `replayPipelineGapAt`、M7 DWS |
| **C. 结构化 diff** | 两者 `metadata` / `payload` 对齐 | 对账、合规导出 |

**A. `supplier_activity`（沿用供应域惯例）**

| 字段 | 值 |
|------|-----|
| `type` | `batch_plan_adjusted`（新增类型码，写入 `supplier_activity_type_definition`） |
| `ref_domain` | `batch` |
| `ref_id` | `onboarding_batch_id` |
| `title` | 如 `手动调整上架计划` |
| `description` | 人类可读摘要：「计划台数 10→12；GPU 80→96；原因：商务补批」 |
| `author_staff_id` / `author_name` | 当前登录运营 |
| `occurred_at` | 调整生效时刻（默认 `now()`，见下「生效时间」） |
| `metadata` | 见 JSON 契约 |

```typescript
// supplier_activity.metadata（建议）
type BatchPlanAdjustedMetadata = {
  source: 'manual_ui'
  reason: string                    // 必填，≥ 4 字
  effective_at: string              // ISO；默认 now；禁止 > now + 5min
  before: {
    planned_device_count: number
    planned_gpu_count: number
    planned_lines: PlannedLine[]
    batch_status?: string
    planned_ready_at?: string | null
  }
  after: { /* 同结构 */ }
  progress_event_id: string         // 关联 B 层事件 id
  operator_staff_id: string
}
```

**B. `progress_event.payload`（与 A 对齐）**

```typescript
payload: {
  source: 'manual_ui'
  reason: string
  activity_id: string              // 回指 supplier_activity.id
  operator_staff_id: string
  diff: { planned_device_count: [10, 12], planned_gpu_count: [80, 96], ... }
}
```

- `event_type`：改计划 → `plan_revised`；仅改状态 → `status_changed`；同时改 → **两条事件**（先 plan 后 status，或合并为一条 `plan_revised` 且 payload 含 status diff，**团队择一并在实现中固定**）。
- `occurred_at`：**默认 `effective_at`**，保证 Period 阶梯在正确历史时刻生效；禁止写入未来时刻（> 当前时间 + 容差）。

**禁止**：仅改 `onboarding_batch` 而不写 `supplier_activity` + `progress_event`。

---

#### 4b.4 API 设计（D7）

**tRPC**（建议挂在 `supplier.onboardingBatch`）：

| 过程 | 权限 | 说明 |
|------|------|------|
| `adjustPlan` | `adminProcedure` 或 `protectedProcedure` + 角色 `ops_manager` | 提交调整单 |
| `listProgressEvents` | `protectedProcedure` | 批次详情页「进度时间轴」只读 |
| `listAdjustHistory` | `protectedProcedure` | 筛选 `type=batch_plan_adjusted` 的 activity |

**Input schema（`onboarding-batch-schemas.ts`）**：

```typescript
onboardingBatchAdjustPlanSchema = z.object({
  batchId: z.string().min(1),
  reason: z.string().trim().min(4, '请填写调整原因'),
  effectiveAt: z.string().datetime().optional(), // 默认 now
  planLines: z.array(onboardingBatchPlanLineSchema).min(1),
  plannedReadyAt: z.string().optional(),
  batchStatus: z.string().optional(), // 若允许顺带改状态
})
```

**DataAccess**：`onboardingBatchDataAccess.adjustPlan({ ... operatorStaffId })`：

1. 事务开始；
2. 读旧批次 → 校验 §4b.2；
3. `UPDATE onboarding_batch` + upsert `onboarding_batch_plan_line`；
4. `INSERT supplier_activity`（type=`batch_plan_adjusted`）；
5. `appendBatchProgressEvent({ eventType: 'plan_revised', occurredAt: effectiveAt, payload })`；
6. 若变更了 status → 再 `appendBatchProgressEvent({ eventType: 'status_changed', ... })`；
7. 提交；`supplierLog` / 失败 `supplierError` 回滚。

**下架批次**：复用同一 `adjustPlan`，由 `batch_kind` 分支解析字段；UI 走 `offline-tasks/[id]`。

---

#### 4b.5 页面入口与交互（D9）

```mermaid
flowchart LR
  subgraph entries [入口]
    G["/dashboard/global<br/>差异校验表"]
    L["/supplier/online-tasks"]
    O["/supplier/order-access"]
    R["/supplier/offline-tasks"]
  end
  subgraph detail [批次详情]
    H[页头操作区]
    D[AdjustOnboardingBatchPlanDialog]
    T[进度时间轴 Tab]
    A[活动审计 Tab]
  end
  G -->|处理 → batchId| H
  L --> H
  O --> H
  R --> H
  H --> D
  D --> adjustPlan API
  T --> listProgressEvents
  A --> listAdjustHistory
```

| 入口 | 路径 / 组件 | 可见条件 |
|------|-------------|----------|
| **列表·计划批次** | `/supplier/online-tasks`（侧栏「计划批次」；**类型筛选** + Badge，无 Tab；不含内部占用） | 见 [supplier-planned-batches-hub-design.md](./supplier-planned-batches-hub-design.md) |
| **主入口·上架批次** | `/supplier/online-tasks/[id]` → `OnboardingBatchDetailContent` | `batch_status` 非终态；角色 ops/admin |
| **主入口·订单接入** | `/supplier/order-access/[id]` | 同上 |
| **主入口·下架批次** | `/supplier/offline-tasks/[id]` → `DeviceRetireBatchDetailContent` | 下架计划调整 |
| **列表快捷** | 工作台列表行 → 调整计划（详情页） | 可选 P2 |
| **全局大盘** | `/dashboard/global` → `DiscrepancyTableCard`「处理」链至批次详情 | 已有链接；详情页展示「存在计划缺口时可调整」提示 |
| **供应商总览** | `/supplier/overview` 进行中批次卡片 | 跳转详情后同主入口 |

**页头操作区（`OnboardingBatchDetailContent`）**

- 按钮：**调整计划**（`variant="outline"`），与「导入清单」并列。
- 点击打开 **`AdjustOnboardingBatchPlanDialog`**（新建组件，路径建议 `supplier/_components/adjust-onboarding-batch-plan-dialog.tsx`）。
- Dialog 字段：
  - 计划行表格（复用创建批次的行编辑器）
  - 计划完成时间
  - **调整原因**（必填 textarea）
  - **生效时间**（可选 `datetime-local`，默认当前；文案：影响大盘 Period 计划卡时回放）
  - 只读展示：当前 `touched` / 缺口 / 上次调整人·时间（来自最近 `batch_plan_adjusted` activity）
- 提交成功：toast + 刷新 `getDetailPage` / `getProgress` + 关闭 Dialog。

**进度时间轴 Tab（新建，P1 建议同 M1 上线）**

- 展示 `onboarding_batch_progress_event` 倒序列表：`occurred_at`、`event_type`、planned/touched 快照、来源标签（`manual_ui` / `system`）。
- `manual_ui` 行可点击展开 `payload.reason` 与 diff 摘要。

**活动审计 Tab（已有则扩展）**

- 筛选展示 `batch_plan_adjusted`、`batch_started`、`device_change_imported` 等。
- 调整记录高亮「调整前→调整后」台数/GPU。

**权限与埋点**

- 无权限：隐藏「调整计划」，仅保留查看时间轴。
- 前端埋点（可选）：`batch_plan_adjust_manual_submit`。

---

#### 4b.6 实施子步骤（开发顺序）

1. `supplier_activity_type_definition` 种子数据：`batch_plan_adjusted` 中文名「批次计划手动调整」。
2. 实现 `adjustPlan` DataAccess + tRPC（§4b.4）。
3. 接入 `appendBatchProgressEvent`（§4b.3），保证 `payload.source=manual_ui`。
4. 新建 `AdjustOnboardingBatchPlanDialog` + 详情页按钮（§4b.5）。
5. （P1）进度时间轴 Tab + `listProgressEvents` 查询。
6. 单测：下调计划低于 `touched` 拒绝；成功后 `replayPipelineGapAt` 在 `effective_at` 前后缺口变化符合预期（PC-T3 扩展）。

---

### 步骤 5 — 时点回放 `replayPipelineGapAt`（M4 前置，M1 内建议先实现只读）

1. 新建 `apps/web/src/lib/server/aggregation/replay-pipeline-gap-at.ts`：
   - `snap(B, T)` = `occurred_at ≤ T` 的最后一条事件；无事件则用 `batch.created_at` + 当前 planned + touched=0（§14.6.1）。
   - `isActive(B, T)`：创建时刻 ≤ T 且 T 时刻前无 `batch_completed` / `batch_cancelled`（§14.6.2）。
   - `touched_devices_replay` / `touched_gpu_replay` 以 **link.linked_at ≤ T** 为准（§14.6.3）；与事件 `touched_*` 不一致时打日志 `data_quality_flag`。
2. 导出 `pipelineGapAt(kind, at, filters)`，与现网 `computePipelineGapsAt` **在 `at = now` 时数值一致**（±0 容忍）。

---

### 步骤 6 — 历史回填 ETL-BE-2（D5）

按 resource-composition 设计 §14.9 分阶段执行：

| 子阶段 | 动作 |
|--------|------|
| **H1** | 全表 `onboarding_batch`：每条写 `batch_created`（`occurred_at = created_at`） |
| **H1** | 每条写 `progress_synced`（`occurred_at = progress_synced_at ?? updated_at`，字段取当前批次 + link 汇总） |
| **H2** | （可选）按 `device_link.linked_at` 排序，在触达跃迁日合成额外 `progress_synced` |
| **H3** | （可选）从 `supplier_activity`（`type=batch_plan_adjusted`）反推 `plan_revised` 时间点；无 activity 则跳过 |

实施建议：

1. 脚本放 `apps/web/scripts/backfill-batch-progress-events.ts`（或 `packages/db/scripts/`）。
2. 批处理（如 500 条/批），可 `--dry-run`。
3. 回填完成后抽样：`replayPipelineGapAt(now)` vs `computePipelineGapsAt(now)`。

---

### 步骤 7 — 测试与观测

1. **单测**：`appendBatchProgressEvent` 去重、`snap(B,T)` 边界（T 在 created 前、T 在 completed 后）。
2. **集成**：变更表 commit → refresh → 事件表新增 `progress_synced`；**不** 新增 `device_*_snapshot` 行。
3. **回归**：PC-T3（专篇 §15）— 仅 `pending_access_pipeline` 卡时下降。
4. 日志：所有写入失败必须 `supplierError` 且向上抛出（批次事务回滚）。

---

## 4. 涉及文件（建议）

| 路径 | 动作 |
|------|------|
| `packages/db/src/supply-schema.ts` | 新增表 + relations |
| `packages/db/drizzle/00xx_*.sql` | migration |
| `apps/web/src/lib/server/aggregation/batch-progress-events.ts` | **新建** |
| `apps/web/src/lib/server/aggregation/replay-pipeline-gap-at.ts` | **新建**（回放） |
| `apps/web/src/lib/server/dataaccess/supplier/batch-progress.ts` | Hook |
| `apps/web/src/lib/server/dataaccess/supplier/onboarding-batch.ts` | Hook |
| `apps/web/src/lib/server/dataaccess/supplier/datacenter-device-retire.ts` | Hook（下架批次） |
| `apps/web/scripts/backfill-batch-progress-events.ts` | **新建**（回填） |
| `apps/web/src/lib/server/dataaccess/supplier/onboarding-batch.ts` | **新增** `adjustPlan` |
| `apps/web/src/lib/server/routers/supplier/onboarding-batch-schemas.ts` | `onboardingBatchAdjustPlanSchema` |
| `apps/web/src/lib/server/routers/supplier/index.ts` | `onboardingBatch.adjustPlan` |
| `apps/web/src/app/.../supplier/_components/adjust-onboarding-batch-plan-dialog.tsx` | **新建** |
| `apps/web/src/app/.../supplier/_components/onboarding-batch-detail-content.tsx` | 入口按钮 + 时间轴/审计 |
| `apps/web/src/app/.../supplier/_components/device-retire-batch-detail-content.tsx` | 下架批次同入口 |

---

## 5. 验收标准

| ID | 条件 |
|----|------|
| M1-A1 | migration 成功，表可查询，索引存在 |
| M1-A2 | 新建批次有一条 `batch_created` |
| M1-A3 | `refreshBatchProgress` 使 touched 变化时有一条 `progress_synced`；无变化不重复插入 |
| M1-A4 | `replayPipelineGapAt(now)` 与 `computePipelineGapsAt(now)` 在相同 filters 下 `gpuCount`/`deviceCount` 一致 |
| M1-A5 | `device_changelog` commit **不** 写入 `device_hourly_snapshot` / `device_daily_snapshot`（与 M2 联调时复核） |
| M1-A6 | 运营在批次详情提交手动调整后：存在 `supplier_activity.type=batch_plan_adjusted` 且同事务有 `plan_revised` 事件，`payload.source=manual_ui` |
| M1-A7 | 调整原因必填；`planned_device_count < touched_device_count` 时 API 拒绝 |
| M1-A8 | 全局大盘差异表跳转批次详情后，可完成调整并能在进度时间轴看到 `manual_ui` 事件 |
| M1-A9 | `replayPipelineGapAt(T)` 在 `T = effective_at` 前后反映新 `planned_*`（PC-T3 人工修订场景） |

---

## 6. 风险与回滚

- **事件风暴**：`progress_synced` 必须去重；必要时对单批次限流。
- **历史缺口**：H1 完成前 Period 计划卡时继续标 `approximate`（专篇 §10.2）。
- **回滚**：停 Hook 即可；表可保留，读路径仍走 batch+link。
- **人工与系统竞态**：同一批次同时导入 changelog 与手动调计划时，以 **`occurred_at` 更大** 的事件为准；UI 提示「导入进行中请稍后再调整」。
- **生效时间滥用**：限制 `effective_at` 不得早于 `batch.created_at`、不得晚于 `now+5min`，防刷历史卡时。

---

## 7. 完成后衔接

1. **M4**：实现 `aggregatePipelineCardHoursFromEvents`，在 `compute-period-resource-composition.ts` 中替换 `aggregatePipelineCardHoursFromGapSeries` + 逐桶 `computePipelineGapsAt`。
2. **M7**：`pipeline_gap_*` DWS 的 ETL 输入改为 `progress_event` 阶梯（见 [M7 文档](./global-dashboard-period-composition-m7-dws-acceleration.md)）。

---

## 8. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-29 | 初稿：M1 可执行步骤清单 |
| v1.1 | 2026-05-29 | 新增 §步骤 4b：手动调整批次、`supplier_activity` 审计、页面入口与 `adjustPlan` API |
