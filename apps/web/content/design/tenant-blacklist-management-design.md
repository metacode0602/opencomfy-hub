# 租户黑名单管理页面设计方案

> 版本：v1.3（设计稿）  
> 日期：2026-06-03  
> 状态：**已实施**（v1.3）  
> 关联：`getBlackListAPI`（`api.ts`）、`project-billing-scheduled-sync-design.md`（时间窗 / 安全窗口）、`tenant-balance-snapshot-design.md`

---

## 1. 目标与原则

### 1.1 业务目标

| # | 目标 | 说明 |
|---|------|------|
| G1 | 查看租户黑名单 | 展示算算力平台 `type = TenantBlack` 的黑名单记录（读本地库） |
| G2 | 平台租户 ID 可读 | `correlation_id` 即平台租户 ID，与 `billing_tenant.platform_tenant_id` 同义 |
| G3 | **增量同步落库** | 点击「同步平台数据」→ **弹窗确认时间窗** → 按 `start_time`～`end_time` 翻页拉取并 upsert |
| G4 | 本地筛选与分页 | 列表读库；支持状态、时间、平台租户 ID / 租户名筛选 |
| G5 | CRM 联动 | 同步时匹配 `billing_tenant`；列表可跳转计费租户详情 |
| G6 | 数据备用 | 落库保留平台快照 + 同步游标，供后续告警、报表、审计 |

### 1.2 非目标（本期）

- **不**默认每次全量拉取 900+ 条（首次全量需用户在弹窗内将起始时间置空或选「全量」模式，见 §4.2）
- **不**在增量同步后对「窗口外未返回」记录做软删（避免误标仍在封禁的租户）
- **不**实现添加/解除黑名单（Q6=否）
- **不**做定时 cron（仅手动同步；二期可加）

### 1.3 设计原则

1. **读写分离**：列表读库；写库仅经「同步」mutation。
2. **增量优先**：OpenAPI `start_time` / `end_time` 表达数据时间窗；窗口内翻页拉完即停。
3. **滑动窗口（Safety Window）**：结束时间 = 东八区当前时刻 − N 天，避免拉取平台尚未稳定回写的近期数据（与账单同步同思路）。
4. **游标可人工修正**：弹窗展示「上次拉取更新至」默认值，**必填、可改**，适配补数 / 纠偏。
5. **幂等 upsert**：以 `platform_blacklist_id` 为唯一键；同窗口重复同步覆盖字段。
6. **平台请求走服务端**：tRPC + 环境变量凭证。

### 1.4 已确认项（2026-06-03）

| # | 结论 |
|---|------|
| Q1 | 菜单文案：**租户黑名单** |
| Q2 | **锁定** `types=TenantBlack` |
| Q3 | 同步需 **自动翻页** 拉完**当前时间窗内**全部页（非默认全库全量） |
| Q4 | 平台支持 `correlation_id` / `tenant_name`（**列表读库筛选**；同步窗内一般不传，避免缩小增量范围） |
| Q5 | `Open` → 封禁中；`Close` → 已解除 |
| Q6 | 本期 **不含** 添加/解除写操作 |
| Q7 | 入口在 **CRM** 侧栏 |
| Q8 | 用户输入 **东八区自然日**（`YYYY-MM-DD`）；服务端转换为平台 **UTC ISO**（§2.3） |
| — | **需落库**；同步前 **弹窗** 配置游标 + 滑动窗口（v1.2） |
| — | 平台时间格式已确认：`2026-04-30T16:00:00.000Z`（v1.3） |

---

## 2. 外部 API

### 2.1 列表查询（同步拉取用）

| 项 | 值 |
|----|-----|
| 方法 | `GET` `/api/admin/black_list/list` |
| 封装 | `getBlackListAPI` |

**Query 参数**

| 参数 | 增量同步用法 |
|------|----------------|
| `types` | 固定 `TenantBlack` |
| `status` | 默认 `""`（不限，以拿到窗口内状态变更） |
| `start_time` | **必填**（弹窗「上次拉取更新至」→ 映射；全量首次见 §4.2） |
| `end_time` | **必填**（由「滑动窗口」计算，见 §3.2） |
| `correlation_id` / `tenant_name` | 同步时默认不传 |
| `page` / `page_size` | 从 1 递增直至 `page * page_size >= count` |

示例（增量，**已联调 URL**）：

```
GET https://openapi.suanli.cn/api/admin/black_list/list
  ?status=&types=TenantBlack
  &start_time=2026-04-30T16:00:00.000Z
  &end_time=2026-05-29T16:00:00.000Z
  &page=1&page_size=100
```

上例对应东八区自然日：**起始日 2026-05-01 00:00** ～ **结束日 2026-05-29 当日含**（结束边界为 2026-05-30 00:00 CST，左闭右开），见 §2.3。

> **时间语义（待联调确认）**：默认假定平台按记录在 `[start_time, end_time)` 内过滤；若实际字段为 create / last_update 之一，在 §9 A1 记录。

### 2.2 响应与落库字段

（同 v1.1，`id` → `platform_blacklist_id`，`correlation_id` → `platform_tenant_id`，等。）

### 2.3 时间格式与日期转换（已确认）

#### 2.3.1 平台 Query 格式

| 项 | 规则 |
|----|------|
| 格式 | **UTC ISO 8601**：`YYYY-MM-DDTHH:mm:ss.sssZ`（毫秒三位 + `Z`） |
| 参数名 | `start_time`、`end_time` |
| 示例 | `start_time=2026-04-30T16:00:00.000Z`、`end_time=2026-05-29T16:00:00.000Z` |

**禁止**向平台传用户原始的 `YYYY-MM-DD` 或带 `+08:00` 的字符串；转换仅在服务端完成。

#### 2.3.2 用户输入（弹窗 / tRPC）

| 项 | 规则 |
|----|------|
| 控件 | HTML `type="date"` 或 DatePicker，仅 **日期** |
| 语义 | 东八区（`Asia/Shanghai`）**自然日** `YYYY-MM-DD` |
| 字段名 | `lastPullStartDate`（上次拉取更新至，本次增量 **起始日**） |
| 全量首次 | `fullSync=true` 时 `start_time=''`，不传起始日 |

#### 2.3.3 东八区自然日 → 平台 UTC ISO

与账单/裸金属请求一致，复用 `tenant-billing-import-utils.ts`：

| API 参数 | 用户日期 | 转换函数 | 含义 |
|----------|----------|----------|------|
| `start_time` | `lastPullStartDate`（如 `2026-05-01`） | `cstDateStartToUtcIso(date)` | 该日 **00:00:00 东八区** → UTC ISO |
| `end_time` | `endDate`（见 §3.2，如 `2026-05-29`） | `cstDateEndExclusiveToUtcIso(date)` | **结束日含当日** → 次日 00:00 东八区 → UTC ISO（右开） |

```typescript
// 已有实现（apps/web/src/lib/crm/tenant-billing-import-utils.ts）
cstDateStartToUtcIso('2026-05-01')       // → '2026-04-30T16:00:00.000Z'
cstDateEndExclusiveToUtcIso('2026-05-29') // → '2026-05-29T16:00:00.000Z'
```

实施时抽到 `tenant-blacklist-utils.ts` 再导出 `toBlacklistListQueryTimes(startDate?, endDate?)`，内部调用上述两函数；`fullSync` 时 `start_time: ''`。

#### 2.3.4 游标默认值（ISO → 展示用日期）

`tenant_blacklist_sync_state.last_pull_end_date` 存东八区 **结束日** `YYYY-MM-DD`（上次成功同步的 **含当日** 结束日）。

| 方向 | 规则 |
|------|------|
| 成功写游标 | `last_pull_end_date = endDate`（日历日，非 ISO 串） |
| 弹窗默认「上次拉取更新至」 | `lastPullStartDate = last_pull_end_date`（与账单游标一致：下次从上次结束日起始，允许同日幂等重拉） |
| 结束至预览 | `endDate = subtractCalendarDays(formatCstDate(now), safetyDays)`；展示 `endDate`，API 用 `cstDateEndExclusiveToUtcIso(endDate)` |

`getSyncDefaults` 返回 `lastPullStartDate`、`suggestedEndDate`（均为 `YYYY-MM-DD`），前端 **不** 做 ISO 换算。

#### 2.3.5 校验

| 规则 | 说明 |
|------|------|
| `lastPullStartDate <= suggestedEndDate` | 否则提示调整滑动窗口或起始日 |
| 日期正则 | `^\d{4}-\d{2}-\d{2}$` |
| `job_run.data_start_time` / `data_end_time` | 存实际发往平台的 **ISO 串**（审计） |

---

## 3. 增量同步模型

### 3.1 术语

| 术语 | 含义 |
|------|------|
| **上次拉取更新至** | 用户选的 **起始自然日** `lastPullStartDate` → API `start_time`（§2.3） |
| **滑动窗口（天）** | `endDate = 今天(东八区) − N 天`（含当日） |
| **本次拉取结束至** | 用户可见的 `endDate`；API `end_time = cstDateEndExclusiveToUtcIso(endDate)` |

### 3.2 时间窗计算

```typescript
// lib/crm/tenant-blacklist-utils.ts（示意）
function computeBlacklistSyncWindow(input: {
  lastPullStartDate: string   // YYYY-MM-DD，东八区；fullSync 时省略
  safetyDays: number
  fullSync?: boolean
  now?: Date
}): {
  startDate: string | null
  endDate: string
  startTime: string           // API start_time（ISO 或 ''）
  endTime: string             // API end_time（ISO）
} {
  const endDate = subtractCalendarDays(formatCstDate(input.now ?? new Date()), input.safetyDays)
  if (input.fullSync) {
    return {
      startDate: null,
      endDate,
      startTime: '',
      endTime: cstDateEndExclusiveToUtcIso(endDate),
    }
  }
  const startDate = input.lastPullStartDate.trim()
  if (startDate > endDate) throw new Error('起始日期不能晚于结束日期（请检查滑动窗口）')
  const { start_time, end_time } = toBlacklistListQueryTimes(startDate, endDate)
  return { startDate, endDate, startTime: start_time, endTime: end_time }
}
```

| 参数 | 默认 | 约束 |
|------|------|------|
| `safetyDays` | **2** | 0～14，弹窗 Slider |
| `lastPullStartDate` | `sync_state.last_pull_end_date` | **必填**（`fullSync` 除外）；`type="date"` |

**示例**（东八区今天 `2026-06-03`，`safetyDays=2`）：

| 用户输入 | 平台参数 |
|----------|----------|
| 起始日 `2026-05-20` | `start_time=2026-05-19T16:00:00.000Z` |
| 结束日 `2026-06-01`（预览） | `end_time=2026-06-01T16:00:00.000Z` |

### 3.3 游标持久化

#### 表：`tenant_blacklist_sync_state`（单行配置）

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | 固定 `'default'` |
| `last_pull_end_date` | date 或 varchar(10) | 上次成功同步的 **东八区结束日** `YYYY-MM-DD`（含当日） |
| `default_safety_days` | integer NOT NULL DEFAULT 2 | 弹窗默认滑动窗口 |
| `last_job_id` | text NULL | FK → `tenant_blacklist_sync_job_run.id` |
| `updated_at` | timestamptz | |

- **首次同步**：无游标时 `lastPullStartDate` 默认为空；勾选全量或用户自选起始日。
- **成功后**：`last_pull_end_date = 本次 endDate`（日历日）；`job_run.data_end_time` 存 ISO 串。

弹窗打开时 `getSyncDefaults` 返回：

```ts
{
  lastPullStartDate: string | null   // = last_pull_end_date，YYYY-MM-DD
  defaultSafetyDays: number
  suggestedEndDate: string           // YYYY-MM-DD，随 safetyDays 变
  lastJobFinishedAt: string | null
}
```

### 3.4 同步算法（`syncFromPlatform`）

```
输入: { lastPullStartDate, safetyDays, fullSync? }  // 日期为 YYYY-MM-DD

1. { startTime, endTime, endDate } = computeBlacklistSyncWindow(...)
2. 创建 job_run(status=running, data_start_time=startTime, data_end_time=endTime, ...)
3. params = { types:'TenantBlack', status:'', start_time:startTime, end_time:endTime,
              correlation_id:'', tenant_name:'', page:1, page_size:100 }
4. loop 翻页 getBlackListAPI(params) → upsert 每条（last_synced_at=now, removed_at 不变）
5. job_run 统计 fetched/upserted；status=success
6. UPDATE tenant_blacklist_sync_state SET last_pull_end_date = endDate, ...
```

| 与 v1.1 差异 | v1.2 |
|--------------|------|
| 全量 + 软删 | **不做**增量窗软删 |
| 无参 sync | 必须带 **弹窗参数** |
| `filter_*` on job | 改为 `data_start_time` / `data_end_time` / `safety_days` |

失败：不更新 `sync_state`；已 upsert 页保留；`error_summary` 记录 `last_page`。

### 3.5 全量首次（可选）

弹窗提供 **「从最早数据全量拉取」** 勾选项（或 `lastPullUpdatedAt` 留空且勾选确认）：

- `start_time=''`，`end_time` 仍受滑动窗口约束；
- 翻页拉完窗口内全部页；
- 适合库表为空的第一趟；**耗时与条数可能较大**，文案需警示。

---

## 4. 交互设计

### 4.1 同步弹窗 `CrmTenantBlacklistSyncDialog`

点击主按钮 **「同步平台数据」** 打开（非直接 mutation）。

```
┌──────────────── 同步平台黑名单 ────────────────┐
│ 从算算力平台增量拉取 TenantBlack 并写入本地库   │
│                                                │
│ 上次拉取更新至 *  [ 2026-05-20        📅 ]      │  ← type=date，东八区自然日，必填
│   说明：对应平台 start_time（当日 00:00 CST→UTC） │
│                                                │
│ 滑动窗口（天）    [====●=====]  2 天            │
│   结束至（预览）  2026-06-01（只读，自然日）      │  ← 随 slider 算 endDate
│                                                │
│ ☐ 从最早数据全量拉取（首次初始化）               │  ← 勾选则忽略起始时间必填校验，传 start_time=''
│                                                │
│ 上次任务：2026-06-02 10:15 成功 · 写入 42 条    │
│                                                │
│              [取消]  [开始同步]                 │
└────────────────────────────────────────────────┘
```

| 控件 | 规则 |
|------|------|
| 上次拉取更新至 | **`type="date"`**，提交 `lastPullStartDate: 'YYYY-MM-DD'`；**必填**（全量除外） |
| 滑动窗口 | Slider；变更时用 `formatCstDate` + `subtractCalendarDays` 刷新 `suggestedEndDate` |
| 开始同步 | `sync.mutate({ lastPullStartDate, safetyDays, fullSync? })`；**服务端**再转 ISO |
| 同步中 | 按钮 loading；Dialog 可关闭为「后台执行」或保持打开显示进度（首期：**保持打开** + `已拉取 x 条` 来自 mutation 流或轮询 `job` 状态，二期可做） |

### 4.2 主页面线框

```
┌──────────────────────────────────────────────────────────────┐
│ 租户黑名单                              [同步平台数据]        │
│ 本地 N 条 · 游标结束日 2026-06-01 · 滑动窗口 2 天              │
├──────────────────────────────────────────────────────────────┤
│ [状态▼] [开始日期] [结束日期] [平台租户ID] [租户名]  [查询]   │
├──────────────────────────────────────────────────────────────┤
│ Table（读库）+ ListPagination                                  │
└──────────────────────────────────────────────────────────────┘
```

| 按钮 | 行为 |
|------|------|
| 查询 | `tenantBlacklist.list` 读库 |
| 同步平台数据 | **打开弹窗** → 确认后 `tenantBlacklist.sync` |

---

## 5. 数据模型（落库）

### 5.1 `platform_tenant_blacklist`（主表）

（同 v1.1；`removed_at` 保留列但 **增量同步不写**，仅人工/二期「全量对账」可用。）

### 5.2 `tenant_blacklist_sync_state`（游标，新增）

见 §3.3。

### 5.3 `tenant_blacklist_sync_job_run`（审计，调整）

| 列名 | 说明 |
|------|------|
| `data_start_time` | 本次 API `start_time`（可空串表示全量起点） |
| `data_end_time` | 本次 API `end_time` |
| `safety_days` | 滑动窗口天数 |
| `full_sync` | boolean，是否「从最早」 |
| `platform_count` / `fetched_count` / `upserted_count` | 统计 |
| ~~`soft_removed_count`~~ | v1.2 **移除**（增量不软删） |
| ~~`filter_status` 等~~ | 改为上列时间窗字段 |

---

## 6. 后端设计（tRPC）

```ts
tenantBlacklist: {
  list: adminProcedure.input(...).query(...),
  getSyncDefaults: adminProcedure.query(...),
  sync: adminProcedure.input(syncInputSchema).mutation(...),
}
```

### 6.1 `sync` Input（必填）

```ts
{
  lastPullStartDate: string       // YYYY-MM-DD 东八区自然日；fullSync 时可省略
  safetyDays: number.int().min(0).max(14)
  fullSync?: boolean              // true → start_time=''
}
```

### 6.2 `sync` Output

```ts
{
  jobRunId: string
  fetchedCount: number
  upsertedCount: number
  platformCount: number
  dataStartTime: string           // 发往平台的 start_time ISO（或 ''）
  dataEndTime: string             // 发往平台的 end_time ISO
  endDate: string                 // 东八区结束日 YYYY-MM-DD，toast 展示
}
```

---

## 7. 文件清单（实施时）

| 文件 | 职责 |
|------|------|
| `crm-schema.ts` | 三表：`platform_tenant_blacklist`、`tenant_blacklist_sync_state`、`tenant_blacklist_sync_job_run` |
| `tenant-blacklist-api.ts` | 翻页 + Zod |
| `tenant-blacklist-utils.ts` | `toBlacklistListQueryTimes`、`computeBlacklistSyncWindow` |
| `tenant-blacklist.ts` | `syncFromPlatform`、`listFromDb` |
| `crm-tenant-blacklist-sync-dialog.tsx` | **同步弹窗** |
| `crm-tenant-blacklist-content.tsx` | 列表页 |
| `app-sidebar.tsx` | 导航 |

---

## 8. 测试计划

| # | 场景 | 预期 |
|---|------|------|
| T1 | 打开同步弹窗 | `lastPullStartDate`、`suggestedEndDate` 为 `YYYY-MM-DD`；safetyDays=2 |
| T2 | 未填起始日且未勾全量 | 提交拦截 |
| T3 | 增量同步 | `2026-05-01`～`2026-05-29` → `start_time=2026-04-30T16:00:00.000Z`、`end_time=2026-05-29T16:00:00.000Z` |
| T4 | 成功后再次打开弹窗 | `lastPullStartDate` = 上次 `endDate` |
| T5 | 失败 job | 游标不推进；可改起始时间补拉 |
| T6 | safetyDays=0 | 结束至为「今天」日界（与平台对齐） |
| T7 | 全量首次 | `fullSync` + `start_time=''`；大 count 仍能翻页完成 |
| T8 | 列表查询 | 仍只读库，不调 OpenAPI |
| T9 | start > end（用户误填） | 服务端/前端校验拒绝 |

---

## 9. 联调待确认

| # | 项 | 状态 |
|---|-----|------|
| A1 | `start_time`/`end_time` 过滤的是 create 还是 last_update | 待确认 |
| A2 | 平台 Query 时间格式 | **已确认**：`YYYY-MM-DDTHH:mm:ss.sssZ`（UTC） |
| A3 | 日界语义 | **已确认**：东八区自然日 → `cstDateStartToUtcIso` / `cstDateEndExclusiveToUtcIso`（左闭右开） |

---

## 10. 实施顺序

1. Schema + migration（含 `sync_state.last_pull_end_date`）  
2. `tenant-blacklist-utils.ts`（日期 → ISO）+ 翻页 API  
3. tRPC：`getSyncDefaults`、`sync`、`list`  
4. **SyncDialog**（`type="date"`）+ 列表页 + 侧栏  
5. 联调 A1（过滤字段语义）  

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-06-03 | 初稿 |
| v1.1 | 2026-06-03 | 落库 + 全量翻页软删 |
| v1.2 | 2026-06-03 | **同步弹窗**；**上次拉取更新至（必填可改）** + **滑动窗口**；**增量拉取**；游标表 `tenant_blacklist_sync_state`；取消增量软删 |
| v1.3 | 2026-06-03 | **平台时间格式已确认**；用户输入 **日期** → 服务端 `cstDate*ToUtcIso`；游标改存 `last_pull_end_date` |
