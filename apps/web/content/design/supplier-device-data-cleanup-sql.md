# 供应商设备与接入批次 — 历史数据清理 SQL

**用途**：清理测试/历史环境中的 **上架批次、导入批次、下架批次** 及 **全部物理设备台账**，便于从零重新导入。

**依据**：

- `packages/db/src/supply-schema.ts` — 供应商域主数据、批次、设备、库存、活动
- `packages/db/src/dashboard-schema.ts` — `device_*_snapshot`、`device_lifecycle_event`（FK → `supplier_device`，`ON DELETE CASCADE`）

**版本**：v2.0（2026-05-31）

---

## 0. 一键全量清理（推荐）

> **复制下面整段**，在目标库执行即可完成 **方案 A 全量重置**。默认 `ROLLBACK` 预览；确认行数与影响后，将最后一行改为 `COMMIT;`。

```sql
-- =============================================================================
-- 供应商设备域 · 一键全量清理
-- 范围：全部物理机 + 全部 onboarding 批次 + L1 库存 + 相关活动/审计/快照
-- 保留：supplier / data_center / 合同 / 刊例价 / 账单 / lifecycle 字典
-- =============================================================================
BEGIN;

-- ---------- 1. 可选：解除故障单与设备/节点关联（device 删除也会 SET NULL，此处便于预览）----------
UPDATE fault_incident
SET supplier_device_id = NULL,
    compute_node_id = NULL
WHERE supplier_device_id IS NOT NULL
   OR compute_node_id IS NOT NULL;

-- ---------- 2. 活动时间线（device / batch / ops_upload_batch）----------
DELETE FROM supplier_activity_attachment
WHERE activity_id IN (
  SELECT id FROM supplier_activity
  WHERE ref_domain IN ('device', 'batch', 'ops_upload_batch')
);

DELETE FROM supplier_activity
WHERE ref_domain IN ('device', 'batch', 'ops_upload_batch');

-- ---------- 3. UI 手动状态审计（无 FK，须显式删）----------
DELETE FROM entity_state_transition_log
WHERE entity_type IN ('device', 'compute_node', 'batch');

-- ---------- 4. 内部测试占用（无设备绑定的台账行；有 inventory_id 的随步骤 6 级联）----------
DELETE FROM internal_test_hold
WHERE supplier_device_id IS NULL
  AND supplier_gpu_inventory_id IS NULL;

-- ---------- 5. 物理设备（级联见 §6；含 dashboard 日/小时快照、lifecycle_event）----------
DELETE FROM supplier_device;

-- ---------- 6. L1 聚合库存（级联 internal_test_hold.supplier_gpu_inventory_id）----------
DELETE FROM supplier_gpu_inventory;

-- ---------- 7. 批次树（级联 plan_line / import_row / task / device_link / progress_event）----------
UPDATE onboarding_batch SET parent_batch_id = NULL;

DELETE FROM onboarding_batch;

-- ---------- 8. 运维 Excel 上传批次 ----------
DELETE FROM supplier_ops_upload_batch;

-- ---------- 预览：改为 COMMIT; 后生效 ----------
ROLLBACK;
-- COMMIT;
```

**局部一键**（仅某供应商或机房）：见 [§4 参数化一键清理](#4-参数化一键清理供应商--机房)。

---

## ⚠️ 执行前必读

| 项 | 说明 |
|----|------|
| **不可逆** | 以下 SQL 会永久删除数据，生产环境务必先备份（[§8](#8-备份建议生产环境)） |
| **保留范围** | 默认 **不删除** 供应商、机房、合同、刊例价、卡型字典、账单、财务域表 |
| **建议方式** | 一键脚本默认 `ROLLBACK`；先跑 [§1 预览](#1-清理前预览建议先执行)，再改 `COMMIT` |
| **权限** | 需要 PostgreSQL 写权限（通常 `admin` / DBA 角色） |
| **环境** | 仅测试 / 预发 / 明确授权的重置；生产须变更审批 |

### 将删除的数据域

| 表 | 说明 | 删除方式 |
|----|------|----------|
| `supplier_device` | 物理机台账 | 显式 `DELETE` |
| `compute_node` | 计算/管控节点 | 随设备 `CASCADE` |
| `resource_pool_binding` | 资源池绑定 | 随设备 `CASCADE` |
| `internal_test_hold` | 内部测试占用 | 设备/库存 `CASCADE`；无绑定的行显式删 |
| `internal_test_hold_device_link` | 占用 ↔ 设备 | 随设备或 hold `CASCADE` |
| `supplier_device_change_log` | 设备变更审计 | 随设备 `CASCADE` |
| `onboarding_batch_device_link` | 设备 ↔ 业务批次 | 随设备/批次 `CASCADE` |
| `onboarding_batch_import_row` | 导入解析行 | 随批次 `CASCADE`（`supplier_device_id` → `SET NULL`） |
| `onboarding_batch_plan_line` | 上架计划明细行 | 随批次 `CASCADE` |
| `onboarding_batch_progress_event` | 批次进度不可变事件（Period 积分时序） | 随批次 `CASCADE` |
| `onboarding_task` | 接入施工任务 | 随批次 `CASCADE`（`supplier_device_id` → `SET NULL`） |
| `supplier_gpu_inventory` | 机房×卡型 L1 库存 | 显式 `DELETE` |
| `onboarding_batch` | 全部批次（`online` / `order_access` / `device_inventory` / `device_changelog` / `device_retire`） | 显式 `DELETE` |
| `supplier_ops_upload_batch` | 运维上传批次 | 显式 `DELETE`（一键脚本含） |
| `supplier_activity` | `ref_domain` ∈ device / batch / ops_upload_batch | 显式 `DELETE` |
| `entity_state_transition_log` | `entity_type` ∈ device / compute_node / batch | 显式 `DELETE`（无 FK） |
| `device_daily_snapshot` | 设备日快照（dashboard-schema） | 随设备 `CASCADE` |
| `device_hourly_snapshot` | 设备小时快照 | 随设备 `CASCADE` |
| `device_lifecycle_event` | 生命周期事件（由 change_log 清洗） | 随设备 `CASCADE` |

### 不会删除的数据

- `supplier`、`data_center`、`supplier_contract`、`gpu_card_type`
- `supplier_card_list_price`、`supplier_unit_cost`、`supplier_pricing_record`、`supplier_pricing_history` 等商务定价
- `access_condition_sheet`、`supplier_pricing_tier`、`supplier_terms_version`
- `supplier_bill`、`supplier_bill_detail`
- `fault_incident` 主记录（设备/节点 FK 置 `NULL`）
- `lifecycle_state_definition`、`supplier_activity_type_definition`
- 财务域、CRM 域、平台定价域表
- `global_kpi_daily` 等 **不** 挂 `supplier_device` 的全局 KPI 表（若需一并清零须另写脚本）

---

## 1. 清理前预览（建议先执行）

```sql
-- 各表行数一览
SELECT 'supplier_device' AS tbl, COUNT(*) AS cnt FROM supplier_device
UNION ALL SELECT 'supplier_gpu_inventory', COUNT(*) FROM supplier_gpu_inventory
UNION ALL SELECT 'onboarding_batch', COUNT(*) FROM onboarding_batch
UNION ALL SELECT 'onboarding_batch (online)', COUNT(*) FROM onboarding_batch WHERE batch_kind = 'online'
UNION ALL SELECT 'onboarding_batch (order_access)', COUNT(*) FROM onboarding_batch WHERE batch_kind = 'order_access'
UNION ALL SELECT 'onboarding_batch (device_inventory)', COUNT(*) FROM onboarding_batch WHERE batch_kind = 'device_inventory'
UNION ALL SELECT 'onboarding_batch (device_changelog)', COUNT(*) FROM onboarding_batch WHERE batch_kind = 'device_changelog'
UNION ALL SELECT 'onboarding_batch (device_retire)', COUNT(*) FROM onboarding_batch WHERE batch_kind = 'device_retire'
UNION ALL SELECT 'onboarding_batch_plan_line', COUNT(*) FROM onboarding_batch_plan_line
UNION ALL SELECT 'onboarding_batch_progress_event', COUNT(*) FROM onboarding_batch_progress_event
UNION ALL SELECT 'onboarding_batch_device_link', COUNT(*) FROM onboarding_batch_device_link
UNION ALL SELECT 'onboarding_batch_import_row', COUNT(*) FROM onboarding_batch_import_row
UNION ALL SELECT 'supplier_device_change_log', COUNT(*) FROM supplier_device_change_log
UNION ALL SELECT 'onboarding_task', COUNT(*) FROM onboarding_task
UNION ALL SELECT 'compute_node', COUNT(*) FROM compute_node
UNION ALL SELECT 'internal_test_hold', COUNT(*) FROM internal_test_hold
UNION ALL SELECT 'internal_test_hold_device_link', COUNT(*) FROM internal_test_hold_device_link
UNION ALL SELECT 'resource_pool_binding', COUNT(*) FROM resource_pool_binding
UNION ALL SELECT 'supplier_ops_upload_batch', COUNT(*) FROM supplier_ops_upload_batch
UNION ALL SELECT 'supplier_activity (device/batch/ops)', COUNT(*) FROM supplier_activity
  WHERE ref_domain IN ('device', 'batch', 'ops_upload_batch')
UNION ALL SELECT 'entity_state_transition_log (device/batch/node)', COUNT(*) FROM entity_state_transition_log
  WHERE entity_type IN ('device', 'compute_node', 'batch')
UNION ALL SELECT 'device_daily_snapshot', COUNT(*) FROM device_daily_snapshot
UNION ALL SELECT 'device_hourly_snapshot', COUNT(*) FROM device_hourly_snapshot
UNION ALL SELECT 'device_lifecycle_event', COUNT(*) FROM device_lifecycle_event
UNION ALL SELECT 'fault_incident (linked device)', COUNT(*) FROM fault_incident
  WHERE supplier_device_id IS NOT NULL OR compute_node_id IS NOT NULL;
```

按供应商/机房缩小范围：

```sql
-- 替换 :supplier_id / :data_center_id（psql: \set supplier_id 'sup_xxx'）

SELECT batch_kind, batch_status, COUNT(*)
FROM onboarding_batch
WHERE supplier_id = :'supplier_id'   -- 去掉本行即全库
  AND data_center_id = :'data_center_id'  -- 可选
GROUP BY batch_kind, batch_status;

SELECT lifecycle_status, COUNT(*)
FROM supplier_device
WHERE supplier_id = :'supplier_id'
  AND data_center_id = :'data_center_id'
GROUP BY lifecycle_status;
```

---

## 2. 方案 A — 全量清理（与 §0 等价）

**效果**：删除 **所有** 批次种类 + **全部** 物理设备 + L1 库存 + 相关活动/审计/快照；故障单保留但解除设备关联。

**删除顺序**（与 `supply-schema.ts` 外键一致）：

1. `fault_incident` 解除设备/节点（可选，设备删时亦 `SET NULL`）
2. `supplier_activity`（附件 → 活动）
3. `entity_state_transition_log`（无 FK，必须显式删）
4. 无设备/库存绑定的 `internal_test_hold`
5. `supplier_device` → 级联子表 + dashboard 快照/事件
6. `supplier_gpu_inventory` → 级联库存维度的 `internal_test_hold`
7. `onboarding_batch`（先 `parent_batch_id` 置空）→ 级联 `plan_line`、`import_row`、`task`、`device_link`、`progress_event`
8. `supplier_ops_upload_batch`

日常操作请直接使用 [§0 一键脚本](#0-一键全量清理推荐)；需要分步注释时可展开 §0 各步骤单独执行。

---

## 3. 方案 B — 仅清理上架/订单接入批次（保留物理机）

> 只删 **商务计划批次**（`online` / `order_access`），**不删** 已入库设备。  
> `onboarding_batch_device_link` 随批次 `CASCADE`；`onboarding_batch_progress_event` 随批次 `CASCADE`。

```sql
BEGIN;

DELETE FROM onboarding_batch_device_link
WHERE business_onboarding_batch_id IN (
  SELECT id FROM onboarding_batch
  WHERE batch_kind IN ('online', 'order_access')
);

UPDATE supplier_device_change_log
SET business_onboarding_batch_id = NULL
WHERE business_onboarding_batch_id IN (
  SELECT id FROM onboarding_batch
  WHERE batch_kind IN ('online', 'order_access')
);

DELETE FROM entity_state_transition_log
WHERE entity_type = 'batch'
  AND entity_id IN (
    SELECT id::text FROM onboarding_batch
    WHERE batch_kind IN ('online', 'order_access')
  );

DELETE FROM supplier_activity_attachment
WHERE activity_id IN (
  SELECT id FROM supplier_activity
  WHERE ref_domain = 'batch'
    AND ref_id IN (
      SELECT id::text FROM onboarding_batch
      WHERE batch_kind IN ('online', 'order_access')
    )
);

DELETE FROM supplier_activity
WHERE ref_domain = 'batch'
  AND ref_id IN (
    SELECT id::text FROM onboarding_batch
    WHERE batch_kind IN ('online', 'order_access')
  );

DELETE FROM onboarding_batch
WHERE batch_kind IN ('online', 'order_access');

COMMIT;
```

---

## 4. 参数化一键清理（供应商 / 机房）

在 §0 各 `DELETE` / `UPDATE` 上增加作用域。示例：**仅某机房**（将 `'dc_xxxxxxxx'` 换成实际 ID）。

```sql
BEGIN;

UPDATE fault_incident fi
SET supplier_device_id = NULL,
    compute_node_id = NULL
FROM supplier_device sd
WHERE fi.supplier_device_id = sd.id
  AND sd.data_center_id = 'dc_xxxxxxxx';

DELETE FROM supplier_activity_attachment
WHERE activity_id IN (
  SELECT sa.id
  FROM supplier_activity sa
  INNER JOIN supplier_device sd ON sa.ref_domain = 'device' AND sa.ref_id = sd.id
  WHERE sd.data_center_id = 'dc_xxxxxxxx'
  UNION
  SELECT sa.id
  FROM supplier_activity sa
  INNER JOIN onboarding_batch ob ON sa.ref_domain = 'batch' AND sa.ref_id = ob.id
  WHERE ob.data_center_id = 'dc_xxxxxxxx'
);

DELETE FROM supplier_activity sa
USING supplier_device sd
WHERE sa.ref_domain = 'device'
  AND sa.ref_id = sd.id
  AND sd.data_center_id = 'dc_xxxxxxxx';

DELETE FROM supplier_activity sa
USING onboarding_batch ob
WHERE sa.ref_domain = 'batch'
  AND sa.ref_id = ob.id
  AND ob.data_center_id = 'dc_xxxxxxxx';

DELETE FROM entity_state_transition_log est
WHERE (
  est.entity_type = 'device'
  AND est.entity_id IN (SELECT id FROM supplier_device WHERE data_center_id = 'dc_xxxxxxxx')
) OR (
  est.entity_type = 'compute_node'
  AND est.entity_id IN (
    SELECT cn.id FROM compute_node cn
    INNER JOIN supplier_device sd ON cn.supplier_device_id = sd.id
    WHERE sd.data_center_id = 'dc_xxxxxxxx'
  )
) OR (
  est.entity_type = 'batch'
  AND est.entity_id IN (SELECT id::text FROM onboarding_batch WHERE data_center_id = 'dc_xxxxxxxx')
);

DELETE FROM internal_test_hold
WHERE data_center_id = 'dc_xxxxxxxx'
  AND supplier_device_id IS NULL
  AND supplier_gpu_inventory_id IS NULL;

DELETE FROM supplier_device
WHERE data_center_id = 'dc_xxxxxxxx';

DELETE FROM supplier_gpu_inventory
WHERE data_center_id = 'dc_xxxxxxxx';

UPDATE onboarding_batch
SET parent_batch_id = NULL
WHERE data_center_id = 'dc_xxxxxxxx';

DELETE FROM onboarding_batch
WHERE data_center_id = 'dc_xxxxxxxx';

COMMIT;
```

按 **供应商** 清理：将 `data_center_id = 'dc_xxxxxxxx'` 改为 `supplier_id = 'sup_xxxxxxxx'`（`supplier_gpu_inventory`、`onboarding_batch`、`internal_test_hold` 同步加 `supplier_id` 条件）。

---

## 5. 清理后校验

```sql
-- 应为 0
SELECT COUNT(*) AS devices FROM supplier_device;
SELECT COUNT(*) AS batches FROM onboarding_batch;
SELECT COUNT(*) AS progress_events FROM onboarding_batch_progress_event;
SELECT COUNT(*) AS gpu_inventory FROM supplier_gpu_inventory;
SELECT COUNT(*) AS change_logs FROM supplier_device_change_log;
SELECT COUNT(*) AS device_links FROM onboarding_batch_device_link;
SELECT COUNT(*) AS daily_snapshots FROM device_daily_snapshot;
SELECT COUNT(*) AS hourly_snapshots FROM device_hourly_snapshot;
SELECT COUNT(*) AS lifecycle_events FROM device_lifecycle_event;
SELECT COUNT(*) AS hold_links FROM internal_test_hold_device_link;

-- 主数据应仍在
SELECT COUNT(*) AS suppliers FROM supplier;
SELECT COUNT(*) AS datacenters FROM data_center;
SELECT COUNT(*) AS contracts FROM supplier_contract;
SELECT COUNT(*) AS list_prices FROM supplier_card_list_price;
```

---

## 6. 外键依赖速查（为何必须按此顺序）

```
supplier_device
  ├─ CASCADE → compute_node, resource_pool_binding
  ├─ CASCADE → internal_test_hold (supplier_device_id), internal_test_hold_device_link
  ├─ CASCADE → supplier_device_change_log, onboarding_batch_device_link
  ├─ CASCADE → device_daily_snapshot, device_hourly_snapshot, device_lifecycle_event (dashboard-schema)
  └─ SET NULL → fault_incident.supplier_device_id, onboarding_task.supplier_device_id,
                onboarding_batch_import_row.supplier_device_id

supplier_device_change_log
  ├─ RESTRICT → onboarding_batch (onboarding_batch_id)  ← 删批次前必须先无 change_log
  └─ SET NULL → business_onboarding_batch_id

supplier_gpu_inventory
  └─ CASCADE → internal_test_hold (supplier_gpu_inventory_id)

onboarding_batch
  ├─ CASCADE → plan_line, import_row, task, device_link, progress_event
  ├─ SET NULL → supplier_device.onboarding_batch_id, parent_batch_id
  └─ SET NULL → supplier_ops_upload_batch.onboarding_batch_id

entity_state_transition_log / supplier_activity
  └─ 无 FK → 须显式 DELETE（按 entity_type / ref_domain 过滤）
```

**结论**：全量清理时 **必须先 `DELETE supplier_device`，再 `DELETE onboarding_batch`**，否则会因 `supplier_device_change_log → onboarding_batch` 的 `RESTRICT` 失败。

---

## 7. 运维封装（可选）

| 方式 | 说明 |
|------|------|
| **psql 文件** | 将 [§0](#0-一键全量清理推荐) 存为 `scripts/cleanup-supplier-device-domain.sql`，`psql "$DATABASE_URL" -f ...` |
| **默认预览** | 保持末尾 `ROLLBACK`；确认后 `sed` 或手工改为 `COMMIT` |
| **局部清理** | 使用 [§4](#4-参数化一键清理供应商--机房)，勿与 §0 混跑 |

---

## 8. 备份建议（生产环境）

```bash
pg_dump "$DATABASE_URL" \
  -t supplier_device \
  -t supplier_gpu_inventory \
  -t onboarding_batch \
  -t onboarding_batch_plan_line \
  -t onboarding_batch_progress_event \
  -t onboarding_batch_device_link \
  -t onboarding_batch_import_row \
  -t onboarding_task \
  -t supplier_device_change_log \
  -t compute_node \
  -t resource_pool_binding \
  -t internal_test_hold \
  -t internal_test_hold_device_link \
  -t supplier_ops_upload_batch \
  -t device_daily_snapshot \
  -t device_hourly_snapshot \
  -t device_lifecycle_event \
  -Fc -f supplier-device-batch-backup.dump
```

---

## 9. 与全景文档的关系

清理完成后（T0），可按 [`supplier-overview-scenarios-from-zero.md`](./supplier-overview-scenarios-from-zero.md) 与 [`supplier-device-management-ops-panorama.md`](./supplier-device-management-ops-panorama.md) 重新：

1. 创建上架/订单接入批次（`work_order_no` 在供应商内唯一，见 `onboarding_batch` 部分唯一索引）
2. 在机房详情导入设备主数据（`device_inventory`）
3. 导入设备变更表（`device_changelog`）刷新进度与 `onboarding_batch_progress_event`
