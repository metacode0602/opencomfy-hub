# 供应域 — 飞书集成（工单 + Webhook + 多维表格）设计方案

**文档性质**：架构与实施设计稿（**不修改代码**）  
**版本**：v1.0  
**日期**：2026-06-11  
**状态**：待评审  

**关联文档**：

- [supplier-onboarding-plan-changelog-tracking-design.md](./supplier-onboarding-plan-changelog-tracking-design.md) — 工单桥接键、`ticket_no` 挂批、进度事件（§2 阶段三预留飞书 API）
- [supplier-device-import-schema.md](./supplier-device-import-schema.md) — 设备主数据表 / 设备变更表 Excel 列权威
- [supplier-device-management-ops-panorama.md](./supplier-device-management-ops-panorama.md) — 批次类型、工单驱动进程（§7.3）
- [supplier-planned-batches-hub-design.md](./supplier-planned-batches-hub-design.md) — 计划批次统一列表
- [supplier-internal-occupancy-batch-design.md](./supplier-internal-occupancy-batch-design.md) — 内部占用批次
- [datacenter-device-retire-design.md](./datacenter-device-retire-design.md) — 机房下架 / 裁撤
- [supplier-device-masterdata-integration-api-design.md](./supplier-device-masterdata-integration-api-design.md) — 第三方同步 API（Cron 模式参考）
- [project-billing-scheduled-sync-design.md](./project-billing-scheduled-sync-design.md) — 定时任务 + advisory lock 模式参考

**代码锚点（现网）**：

| 能力 | 路径 |
|------|------|
| 批次创建 / 工单唯一性 | `onboarding-batch.ts`、`work-order-uniqueness.ts` |
| 设备 Excel 解析 / commit | `device-import.ts`、`parse-device-import-file.ts`、`device-import-utils.ts` |
| 批次进度事件 | `batch-progress.ts` → `onboarding_batch_progress_event` |
| 供应商时间线 | `supplier-activity.ts` → `supplier_activity` |
| Cron 注册 | `instrumentation.ts`、`register-*-cron.ts` |

---

## 1. 背景与目标

### 1.1 现状痛点

| 环节 | 现网行为 | 问题 |
|------|----------|------|
| 创建计划批次 | 商务在 CRM 手工填写 **飞书审批工单号**（`work_order_no`） | 易错号、重复录入、与飞书侧不同步 |
| 工单状态 | 运维在飞书审批内流转；CRM 靠 **变更表** 或手工「确认完成」 | 批次 `batch_status` 与飞书脱节 |
| 沟通附件 | 供应商时间线 `supplier_activity` 支持评论/附件；飞书工单评论区独立 | 双轨维护 |
| 设备台账 | 运维更新 **飞书多维表格**，再在 CRM **手工上传 Excel** | 重复劳动、延迟高 |

### 1.2 业务目标

| # | 目标 | 说明 |
|---|------|------|
| **G1** | 自动发起飞书工单 | 创建计划批次时 **代发** 飞书审批/工单，回填 `work_order_no` |
| **G2** | 接收工单 Webhook | 飞书状态变更 → CRM 更新批次态 + 写机房/供应商时间线 |
| **G3** | 读取多维表格 | 按配置拉取 Bitable 记录，映射为设备主数据 / 变更表行 |
| **G4** | 复用导入闭环 | Bitable 数据 **不走新写库路径**，复用 `parse*` + `commitInventory` / `commitChangelog` |
| **G5** | 双向评论同步 | 批次详情评论/附件 → 飞书工单；飞书回复 → CRM 时间线（可选 inbound） |
| **G6** | 可观测 | 集成任务日志、失败重试、管理端配置与手动触发 |

### 1.3 应用场景（本期范围）

1. **计划批次 ↔ 工单**：设备上架 / 设备下架 / 机房裁撤 / 内部占用 — 创建时发起工单；工单结束后自动拉取摘要写入 **对应机房** 时间线（`supplier_activity`，`metadata.idc_code` / `data_center_id`）。
2. **批次评论/附件 ↔ 工单**：在批次详情（或机房计划面板）发表评论、上传文件，同步至飞书工单评论/附件区。
3. **定时多维表格同步**：Cron 读取 Bitable，按 [supplier-device-import-schema.md](./supplier-device-import-schema.md) 表头映射，自动走与 Excel 上传相同的 preview → commit 逻辑（可配置为仅 preview 告警或自动 commit）。

### 1.4 非目标（本期不做）

- 替代飞书侧审批流定义（表单字段在飞书管理后台维护，CRM 只 **填表 + 订阅事件**）
- 改造 `entity_state_transition_log` 或 Period ETL 口径
- 在 Bitable 同步路径开放 **显卡型号 / 显卡数量** 的绕过写入（仍遵守 D1 / 主数据导入规则）
- 多飞书租户（一个企业一个飞书应用实例即可；多企业另立项）
- 飞书即时消息（IM）机器人推送（可作 P2）

### 1.5 设计原则

1. **工单号仍是桥接键**：`onboarding_batch.work_order_no` = 飞书侧稳定工单/审批实例标识；变更表 `ticket_no` 匹配逻辑 **不变**。
2. **设备态仍由变更表/主数据驱动**：Webhook 只动 **批次进程**（`batch_status`）与时间线；**不**因「审批通过」直接改 `supplier_device.lifecycle_status`（与 [supplier-device-management-ops-panorama.md §7.3](./supplier-device-management-ops-panorama.md) 方案 A 一致）。
3. **集成层与业务层分离**：`packages/integrations/feishu/*` 封装 Open API；供应域 data access 只调集成服务。
4. **幂等与可重放**：Webhook、Cron 均按 `(source, external_id)` 去重；失败入队重试。
5. **配置外置**：App ID/Secret、Bitable app_token、表 ID、审批 definition_code 存 DB 或加密 env，**不进** git。

---

## 2. 飞书 Open Platform 能力映射

> 以下 API 名称以飞书开放平台 v2 为准；实施前需在目标飞书租户创建 **企业自建应用**，开通权限并发布。

### 2.1 工单（审批）能力

| CRM 需求 | 飞书 API / 事件 | 备注 |
|----------|-----------------|------|
| 发起工单 | `POST /open-apis/approval/v4/instances` | 传入 `approval_code` + 表单字段 |
| 查询工单详情 | `GET /open-apis/approval/v4/instances/:instance_id` | 拉取终态摘要、表单快照 |
| 订阅状态变更 | 事件 `approval_instance` / `approval.approval_instance.updated`（以控制台订阅为准） | 配置 **事件订阅 URL** → CRM Webhook |
| 评论（出站） | `POST /open-apis/approval/v4/instances/:instance_id/comments` 或 IM 机器人 @（视租户开通项） | 以实际可用接口为准 |
| 附件（出站） | 先 `POST /open-apis/im/v1/files` 上传，再挂到审批评论/表单 | 与 CRM 对象存储中转 |

**工单号取值策略（ADR-F1，见 §12）**：

- **推荐**：存飞书 **`instance_code`**（审批实例对外编号，与运营口头「工单号」一致）→ 写入 `work_order_no`。
- **并存**：`onboarding_batch.metadata.feishu_instance_id` 存内部 `instance_id`，便于 API 回调关联。

若租户实际使用 **飞书服务台（Helpdesk）** 而非审批，则映射为 Helpdesk Ticket API；本文默认 **审批实例** 模型，实施前需与运营确认工单产品形态。

### 2.2 多维表格（Bitable）能力

| CRM 需求 | 飞书 API | 备注 |
|----------|----------|------|
| 列出记录 | `GET /open-apis/bitable/v1/apps/:app_token/tables/:table_id/records` | 分页 + `filter` |
| 增量游标 | 记录 `last_modified_time` 或专用 **「同步批次号」列** | 见 §8.3 |
| 字段映射 | Bitable `fields` JSON → Excel 表头名 | 配置表维护 |
| 附件列 | 文件 token → 下载 API → 可选不入库 | 主数据/变更表通常无附件列 |

### 2.3 鉴权

| 项 | 约定 |
|----|------|
| 租户访问凭证 | `app_id` + `app_secret` → `tenant_access_token`（缓存 ~2h） |
| Webhook 验签 | 飞书 `Encrypt Key` + `Verification Token`；Challenge 握手 |
| 用户身份 | 发起审批时传 **发起人 open_id**（映射 CRM `user_staff.feishu_open_id`，待扩展列或映射表） |

---

## 3. 总体架构

```mermaid
flowchart TB
  subgraph ui [CRM Web UI]
    W[批次创建 Wizard / 下架 Dialog / 内部占用 Dialog]
    C[批次详情 · 评论/附件]
    A[集成管理 Settings]
  end

  subgraph api [apps/web API Layer]
    TRPC[tRPC supplier.* / integration.*]
    WH["POST /api/webhooks/feishu"]
    CRON[node-cron feishu-bitable-sync]
  end

  subgraph domain [供应域 Data Access]
    OB[onboarding-batch.ts]
    DI[device-import.ts]
    BP[batch-progress.ts]
    SA[supplier-activity.ts]
  end

  subgraph integ [packages/integrations/feishu]
    AUTH[tenant token]
    APR[approval client]
    BIT[bitable client]
    MAP[field mapper]
  end

  subgraph feishu [飞书]
    FAP[审批 / 工单]
    FBT[多维表格]
    FEV[事件推送]
  end

  W --> TRPC --> OB
  C --> TRPC --> SA
  OB --> APR --> FAP
  SA --> APR
  FEV --> WH --> OB
  FEV --> WH --> SA
  CRON --> BIT --> MAP --> DI
  BIT --> FBT
  A --> TRPC
```

### 3.1 模块划分

| 模块 | 职责 |
|------|------|
| `packages/integrations/feishu` | 纯 HTTP 客户端、token 缓存、重试、错误码映射 |
| `apps/web/src/lib/server/integrations/feishu/*` | 配置加载、Webhook 路由、事件分发、与 DB 事务衔接 |
| `apps/web/src/lib/server/jobs/feishu-bitable-sync/*` | Cron 入口、advisory lock、按供应商/机房维度串行 |
| DB 集成表 | 见 §4 |

---

## 4. 数据模型（增量）

### 4.1 `feishu_integration_config`（租户级配置，单行或按环境）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text PK | |
| `app_id` | varchar | 飞书应用 ID |
| `app_secret_enc` | text | 加密存储 |
| `encrypt_key` | varchar | 事件解密 |
| `verification_token` | varchar | 事件验签 |
| `default_approval_codes` | jsonb | `{ "online": "...", "device_retire": "...", ... }` |
| `enabled` | boolean | 总开关 |
| `created_at` / `updated_at` | timestamptz | |

### 4.2 `feishu_bitable_sync_config`（按供应商或机房）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text PK | |
| `supplier_id` | text FK | |
| `data_center_id` | text FK 可空 | 空表示供应商级默认 |
| `sync_kind` | varchar | `device_inventory` \| `device_changelog` |
| `app_token` | varchar | Bitable app_token |
| `table_id` | varchar | 表 ID |
| `view_id` | varchar 可空 | 可选视图 |
| `field_mapping_json` | jsonb | Bitable 字段名 → Excel 表头名 |
| `filter_formula` | text 可空 | 飞书 filter 表达式 |
| `cron_expr` | varchar | 默认 `15 * * * *`（每小时 :15） |
| `auto_commit` | boolean | true=直接 commit；false=仅 parsed + 告警 |
| `cursor_json` | jsonb | `{ "lastModifiedMs": ..., "lastRecordId": ... }` |
| `enabled` | boolean | |
| `last_run_at` / `last_success_at` | timestamptz | |

### 4.3 `feishu_external_link`（CRM ↔ 飞书实体关联）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text PK | |
| `domain` | varchar | `onboarding_batch` \| `supplier_activity` \| `onboarding_batch_import` |
| `ref_id` | text | CRM 主键 |
| `external_type` | varchar | `approval_instance` \| `bitable_record` \| `approval_comment` |
| `external_id` | varchar | 飞书侧 ID |
| `external_code` | varchar 可空 | 如 `instance_code`（工单号） |
| `metadata` | jsonb | 原始 payload 摘要 |
| `created_at` | timestamptz | |

唯一索引：`(domain, ref_id, external_type)`、`(external_type, external_id)`。

### 4.4 `feishu_integration_job_run`（任务日志）

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text PK | |
| `job_kind` | varchar | `webhook` \| `bitable_sync` \| `approval_create` \| `comment_push` |
| `status` | varchar | `running` \| `success` \| `failed` \| `skipped` |
| `supplier_id` | text 可空 | |
| `ref_domain` / `ref_id` | 可空 | |
| `request_summary` | jsonb | |
| `response_summary` | jsonb | |
| `error_message` | text | |
| `started_at` / `finished_at` | timestamptz | |

### 4.5 既有表扩展（JSONB，避免大迁移）

**`onboarding_batch.metadata`** 增量键：

```json
{
  "feishu": {
    "instance_id": "xxx",
    "instance_code": "202406110001",
    "approval_code": "xxx",
    "create_status": "pending|created|failed",
    "last_webhook_at": "ISO8601",
    "last_feishu_status": "PENDING|APPROVED|REJECTED|CANCELED"
  }
}
```

**`user_staff`**（或新建 `user_external_identity`）：`feishu_open_id` — 发起审批时的 `user_id`。

---

## 5. 场景一：创建计划批次 → 自动发起工单 → Webhook → 时间线

### 5.1 适用批次类型

| `batch_kind` | 创建入口 | 飞书审批模板（配置键） |
|--------------|----------|------------------------|
| `online` | 上架 Wizard | `default_approval_codes.online` |
| `order_access` | 订单接入 Wizard | `default_approval_codes.order_access` |
| `device_retire` | 机房下架 Dialog（含裁撤） | `default_approval_codes.device_retire` |
| `internal_occupancy` | 内部占用 Dialog | `default_approval_codes.internal_occupancy` |

### 5.2 创建流程（目标态）

```mermaid
sequenceDiagram
  participant U as 运营/商务
  participant CRM as CRM createBatch
  participant FS as 飞书审批 API
  participant WH as Webhook Handler

  U->>CRM: 提交计划（不再手工填工单号）
  CRM->>CRM: INSERT onboarding_batch<br/>batch_status=待开始<br/>work_order_no=占位或空
  CRM->>FS: 创建审批实例（表单映射）
  FS-->>CRM: instance_id + instance_code
  CRM->>CRM: UPDATE work_order_no=instance_code<br/>metadata.feishu.*
  CRM->>CRM: appendBatchProgressEvent(batch_created)
  CRM->>CRM: supplier_activity(batch_started)
  Note over FS: 运维审批流转
  FS->>WH: 状态变更事件
  WH->>CRM: 幂等处理 → 更新 batch_status<br/>写 progress_event + supplier_activity
```

### 5.3 表单字段映射（CRM → 飞书审批）

| 飞书表单字段（示例） | CRM 来源 |
|--------------------|----------|
| 供应商 | `supplier.name` |
| 机房 / IDC | `data_center.name` / `idc_code` |
| 批次类型 | `batch_kind` 中文 |
| 计划明细 | `planned_lines_json` 渲染文本 |
| 期望完成日 | 下架/占用场景 |
| 下架原因 / 场景 | `retire_reason` / `retire_plan_mode` |
| 内部占用登记 | `internal_test_hold` 摘要 |
| CRM 批次链接 | 详情页 URL（便于飞书内跳转） |

### 5.4 Webhook 处理规则

**路由**：`POST /api/webhooks/feishu`（Next.js Route Handler，`runtime=nodejs`）

**处理步骤**：

1. 验签 + 解密（若启用 Encrypt Key）
2. 写入 `feishu_integration_job_run`（`job_kind=webhook`）
3. 解析 `instance_code` / `instance_id` → 查 `feishu_external_link` 或 `onboarding_batch.work_order_no`
4. **幂等键**：`(event_type, instance_id, status, update_time)`
5. 按飞书状态映射 CRM 动作：

| 飞书审批状态 | CRM `batch_status`（上架/接入） | CRM `batch_status`（下架） | 其他动作 |
|--------------|--------------------------------|----------------------------|----------|
| 审批中 / 进行中 | 保持或 → `接入中`/`下架中`（可配置） | 同左 | 写 `supplier_activity` |
| 已通过 | → `已完成`（或仅标记工单结束，进度仍靠变更表） | → `已完成` | §5.5 |
| 已拒绝 / 已撤回 | → `已取消` | → `已取消` | 写时间线 + 通知创建人 |
| 未知 | 仅记日志 | | 不抛错给飞书（仍返回 200） |

> **与 §7.3 方案 A 对齐**：若运营希望「开始执行工单 / 工单执行结束」与飞书节点 **一一对应**，可在飞书流程中增加自定义节点名称，Webhook 解析 `task_name` 映射为 `开始执行工单` / `工单执行结束` 语义，仅更新 `batch_status` + `progress_event`，**不改设备 lifecycle**。

### 5.5 工单结束后写入机房时间线

触发：`APPROVED` 或配置的「结束节点」。

**写入 `supplier_activity`**（幂等：`metadata.feishu_instance_id` + `type=work_order_completed`）：

| 字段 | 值 |
|------|-----|
| `supplier_id` | 批次.supplier_id |
| `type` | `batch_work_order_completed`（新增 type_code，或复用 `batch_started` + metadata） |
| `title` | 如「上架批次 WO-xxx 工单已完成」 |
| `description` | 飞书表单摘要 + 审批人 + 完成时间 |
| `ref_domain` | `onboarding_batch` |
| `ref_id` | batch.id |
| `metadata` | `{ "data_center_id", "idc_code", "work_order_no", "feishu_instance_id", "feishu_status" }` |
| `author_role` | `system` |

**写入 `onboarding_batch_progress_event`**：

- `event_type`: `work_order_closed`（新增枚举）
- `payload.source`: `feishu_webhook`
- 快照当前 `planned_*` / `touched_*` / `batch_status`

**机房维度展示**：供应商详情 / 机房详情时间线组件增加按 `metadata.data_center_id` 过滤（若尚无机房级 Tab，先在机房详情「计划与占用」面板增加 **「相关动态」** 折叠区读 `supplier_activity`）。

### 5.6 UI 变更要点

| 现网 | 目标态 |
|------|--------|
| 必填「飞书审批工单号」 | **默认隐藏**；展示「提交后将自动创建飞书工单」 |
| 手工填工单（兼容） | Settings 开关 `feishu.auto_create_enabled=false` 时回退现网 |
| 创建失败 | 批次仍落库，`metadata.feishu.create_status=failed`；UI 提示重试 / 手工补号 |
| 详情页 | 展示飞书工单链接、同步状态、最近 Webhook 时间 |

### 5.7 与变更表挂接（不变）

运维上传变更表或 Bitable 同步后，`ticket_no` 仍匹配 `work_order_no`（即 `instance_code`）。**设备进度** 仍由 `commitChangelog` → `refreshBatchProgress` 驱动。

---

## 6. 场景二：批次评论与附件 ↔ 飞书工单同步

### 6.1 范围

- **出站（必做）**：CRM 批次详情新增 **「评论与附件」** 面板（可复用 `SupplierActivityPanel` 交互，但 `ref_domain=onboarding_batch`）。
- **入站（P1）**：飞书审批评论回复 → Webhook / 轮询 → CRM 时间线（若飞书未推送评论事件，则 P2 用定时 pull）。

### 6.2 出站流程

```mermaid
sequenceDiagram
  participant U as 用户
  participant CRM as batchActivity.createComment
  participant FS as 飞书评论/文件 API
  participant DB as supplier_activity

  U->>CRM: 评论 + 附件（≤5 文件, ≤20MB）
  CRM->>DB: INSERT supplier_activity + attachment
  CRM->>FS: 推送评论（含 CRM 链接）
  loop 每个附件
    CRM->>FS: 上传文件 → 关联评论
  end
  CRM->>DB: feishu_external_link(comment_id)
```

**数据模型**：

- 新建 `onboarding_batch_activity` **或** 复用 `supplier_activity` + `ref_domain=onboarding_batch`（**推荐后者**，与商户/项目时间线模式一致）。
- 附件继续 `supplier_activity_attachment` + 对象存储；同步飞书时从 `storage_uri` 读取流上传。

**权限**：`supplier:batch:comment`（与供应域 RBAC 对齐）。

**失败策略**：DB 已提交则标记 `metadata.feishu_sync_status=failed`；后台 job 重试，不阻断用户发评论。

### 6.3 入站流程（P1）

若订阅 **审批评论事件**：

1. Webhook → 查 `feishu_external_link`（instance → batch）
2. INSERT `supplier_activity`，`author_name` 取飞书用户映射
3. 附件：飞书 file_token 下载 → 存对象存储 → `supplier_activity_attachment`

**去重**：`external_id=comment_id`。

### 6.4 UI

- 批次详情 Tab：**进度时间轴**（现有 `BatchProgressTimeline`）+ **协作动态**（评论，含飞书同步图标）
- 评论卡片展示：`已同步至飞书` / `同步失败，点击重试`

---

## 7. 场景三：定时读取多维表格 → 复用 Excel 导入逻辑

### 7.1 目标

将飞书 Bitable 视为 **Excel 的在线源**，定时同步到 CRM：

| Bitable 配置 `sync_kind` | 等价 Excel | commit 路径 |
|--------------------------|------------|-------------|
| `device_inventory` | 设备主数据表 | `device-import.ts` → `commitInventory` |
| `device_changelog` | 设备变更表 | `device-import.ts` → `commitChangelog` |

### 7.2 流水线

```mermaid
flowchart LR
  A[Cron 触发] --> B[加载 bitable_sync_config]
  B --> C[拉取 records 分页]
  C --> D[field_mapper → 行对象]
  D --> E[组装为 ImportTable 结构]
  E --> F[parseDeviceInventoryTable / parseDeviceChangelogTable]
  F --> G{auto_commit?}
  G -->|是| H[commitInventory / commitChangelog]
  G -->|否| I[import_status=parsed + 通知]
  H --> J[refreshBatchProgress / supplier_activity]
  J --> K[更新 cursor_json]
```

**关键复用点**（避免重复实现）：

```text
readImportTable(buffer)  ← 现有 Excel 入口
       ↓
新增 buildImportTableFromRows(headers, rows)  ← 将 Bitable 映射结果转为相同 Table 结构
       ↓
parseDeviceInventoryTable(table) / parseDeviceChangelogTable(table)
       ↓
现有 preview / commit（与 DeviceChangelogImportDialog 相同后端）
```

### 7.3 字段映射

配置示例 `field_mapping_json`：

```json
{
  "设备ID": "fldXxxxx",
  "内网IP地址": "fldYyyyy",
  "设备状态": "fldZzzzz",
  "变更动作": "fldAaaaa",
  "工单": "fldBbbbb"
}
```

- **键**：Excel 表头名（[supplier-device-import-schema.md §4.1 / §4.2](./supplier-device-import-schema.md)）
- **值**：Bitable 字段 ID 或字段名（实施时统一用 field_id，避免改名）
- 解析器 **白名单列** 逻辑与机会导入一致：多余 Bitable 列忽略

**类型转换**：

| Bitable 类型 | 处理 |
|--------------|------|
| 文本 / 数字 | 直接 stringify |
| 单选 | 取 option 文本 |
| 日期 | 转 ISO8601 +08:00 |
| 人员 | 取 name 或忽略 |
| 关联 | 不支持，需展平为文本列 |

### 7.4 增量策略

| 策略 | 说明 |
|------|------|
| **时间戳** | filter：`LastModifiedTime > cursor.lastModifiedMs` |
| **版本列** | 运维在 Bitable 维护「同步版本」整数，只拉 `>= cursor.version` |
| **全量** | 小表可每小时全量；大表必须增量 |

每次成功 commit 后更新 `cursor_json`；失败 **不** 推进 cursor（允许重复拉取，commit 幂等靠批次语义）。

### 7.5 批次与机房约束

与手工 Excel 一致：

- `device_inventory`：必须指定 `supplier_id` + `data_center_id`（来自 sync_config）
- `device_changelog`：变更行「工单」列匹配业务批次；机房须与批次一致（现网校验保留）
- 每次 changelog 同步仍新建 `onboarding_batch.batch_kind=device_changelog` 导入批次

### 7.6 Cron 与互斥

| 项 | 约定 |
|----|------|
| 注册 | `instrumentation.ts` → `registerFeishuBitableSyncCron()` |
| 默认表达式 | `15 * * * *`（东八区，错开 `5 * * * *` 主数据快照） |
| 互斥 | PostgreSQL advisory lock per `(supplier_id, data_center_id, sync_kind)` |
| 多副本 | 与 [project-billing-scheduled-sync-design.md](./project-billing-scheduled-sync-design.md) 相同 |
| 手动触发 | Settings / tRPC `integration.feishu.runBitableSyncNow({ configId })` |

### 7.7 `auto_commit` 模式

| 模式 | 行为 | 适用 |
|------|------|------|
| `false`（默认） | 仅 `parse` → 写 `import_status=parsed`，发通知/待办 | 新接入机房试运行 |
| `true` | 直接 `commit` | 成熟机房、字段映射已验证 |

解析错误行写入 `feishu_integration_job_run.response_summary.errors`，与 Excel preview 错误 UX 对齐。

---

## 8. 安全、配置与权限

### 8.1 密钥管理

- `app_secret`、Webhook `encrypt_key`：**加密 at rest**（复用现有 env KMS 或 libsodium sealed box）
- 生产 / 预发 **分应用**；Webhook URL 带 path secret：`/api/webhooks/feishu/:webhookSecret`

### 8.2 RBAC

| 能力 | 建议权限 |
|------|----------|
| 查看集成状态 | `integration:feishu:read` |
| 编辑 Bitable 映射 | `integration:feishu:admin` |
| 手动触发同步 | `integration:feishu:ops` |
| 批次自动建单 | 现有 `supplier:batch:create` |

### 8.3 审计

- 所有出站 API 写 `feishu_integration_job_run`
- Webhook payload **脱敏**后存 `response_summary`（不含手机号等 PII 原文）

---

## 9. 错误处理与可观测性

### 9.1 重试

| 场景 | 策略 |
|------|------|
| 飞书 5xx / 限流 | 指数退退避，最多 3 次 |
| Webhook 业务失败 | 返回 200 避免飞书无限重试；内部入 **死信表** / job_run 标记 failed |
| Bitable sync 部分行失败 | commit 按现网「部分成功」规则；失败行不进库 |

### 9.2 告警

- 连续 3 次 `bitable_sync` 失败 → 日志 `feishu-warn` + 可选钉钉/飞书群机器人（P2）
- 建单失败率 > 阈值 → Settings 页红色提示

### 9.3 管理 UI（Settings）

- 飞书应用连接测试（get tenant token）
- 审批模板 code 配置与 **「试发空实例」**（仅 admin）
- Bitable 映射向导：选 app → 表 → 自动拉字段 → 映射 Excel 列 → 试跑 preview
- Job 运行历史列表（复用 billing sync job 表格样式）

---

## 10. 实施分期

### Phase 1 — 工单出站 + Webhook（MVP）

- [ ] `packages/integrations/feishu` 基础客户端
- [ ] 创建批次时自动发起审批 + 回填 `work_order_no`
- [ ] Webhook 路由 + 批次状态 + `supplier_activity` + `progress_event`
- [ ] 上架 / 下架 / 内部占用入口；机房裁撤走 `device_retire` + `retire_plan_mode=datacenter_closure`
- [ ] 手工填工单兼容开关

**验收**：创建批次后飞书可见审批；审批通过后 CRM 批次态与时间线自动更新；变更表仍可用工单号挂批。

### Phase 2 — 评论/附件同步

- [ ] 批次详情评论面板（`ref_domain=onboarding_batch`）
- [ ] 出站评论/附件推飞书
- [ ] 失败重试 job

### Phase 3 — Bitable 定时同步

- [ ] `feishu_bitable_sync_config` + Cron
- [ ] `buildImportTableFromRows` + 复用 parse/commit
- [ ] Settings 映射 UI + 手动触发
- [ ] `auto_commit` 可配置

### Phase 4 — 增强（可选）

- [ ] 飞书评论入站
- [ ] 按机房过滤时间线组件
- [ ] 订单接入 `order_access` 与 CRM 订单实体双向链接

---

## 11. 测试计划

| 类型 | 用例 |
|------|------|
| 单元 | field_mapper、Webhook 状态机、幂等键 |
| 集成 | Mock 飞书 API：创建实例 → 模拟 Webhook → 断言 batch + activity |
| 导入 | Bitable fixture 行 → parse 结果与同名 Excel 一致 |
| 回归 | 关闭集成开关后，现网手工工单 + Excel 上传路径不变 |
| 安全 | 错误验签拒绝；secret 不入日志 |

---

## 12. 已确认决策（ADR，待评审）

| # | 议题 | 建议决策 |
|---|------|----------|
| **F1** | `work_order_no` 存什么 | 飞书 **`instance_code`**（对外工单号）；`instance_id` 放 metadata |
| **F2** | 工单产品形态 | 默认 **飞书审批**；若运营确认用服务台，Phase 1 前替换 API 层 |
| **F3** | 审批通过是否自动 `batch_status=已完成` | **可配置**；默认 **仅写时间线**，批次完工仍靠变更表进度（保守）；激进模式自动完工 |
| **F4** | Bitable 同步默认 | `auto_commit=false`，试运行通过后再开 |
| **F5** | 时间线存储 | 复用 **`supplier_activity`** + `metadata.data_center_id`，不新建 `datacenter_activity` 表 |
| **F6** | Cron 宿主 | **Web 进程内** `node-cron`（与账单同步一致），不启用 `apps/workers` |
| **F7** | 发起人 | 映射 CRM 登录用户 → `feishu_open_id`；缺失时用 **应用机器人身份** + 表单注明「CRM 代发」 |

---

## 13. 风险与依赖

| 风险 | 缓解 |
|------|------|
| 飞书表单字段变更 | 映射配置版本化；建单失败告警 |
| 审批流与 CRM 状态语义不一致 | 运营共建状态映射表；文档化 §7.3 边界 |
| Bitable 大表超时 | 增量 + 分页；单次 sync 行数上限（如 5000） |
| 多副本 Webhook 重复 | 幂等表 + DB 唯一约束 |
| 用户无 feishu_open_id | 首期允许 service account 代发 |

**外部依赖**：飞书管理员开通应用权限（审批、Bitable、通讯录只读）；提供各场景审批 `approval_code`；Bitable app_token 与表结构稳定。

---

## 14. 附录：与现网字段对照

| 概念 | 现网 | 飞书集成后 |
|------|------|------------|
| 工单桥接键 | 手工 `work_order_no` | API 回填 `instance_code` |
| 批次进度 | 变更表 + `refreshBatchProgress` | **不变** |
| 设备主数据 | Excel → `device_inventory` | Bitable → 同一 commit |
| 设备变更 | Excel → `device_changelog` | Bitable → 同一 commit |
| 机房动态 | 分散在 supplier 活动 | `supplier_activity.metadata.data_center_id` 聚合展示 |

---

**文档维护**：实施 PR 须更新本文「状态」与各 Phase checklist；API 字段以飞书开放平台最新文档为准。
