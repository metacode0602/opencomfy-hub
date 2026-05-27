# 供应商设备与接入批次 — 历史数据清理 SQL

**用途**：清理测试/历史环境中的 **上架批次、导入批次、下架批次** 及 **全部物理设备台账**，便于从零重新导入。

**依据**：`packages/db/src/supply-schema.ts` 外键与 `onDelete` 规则。

**版本**：v1.0（2026-05-27）

---

## ⚠️ 执行前必读

| 项 | 说明 |
|----|------|
| **不可逆** | 以下 SQL 会永久删除数据，生产环境务必先备份 |
| **保留范围** | 默认 **不删除** 供应商、机房、合同、刊例价、卡型字典、账单等主数据 |
| **建议方式** | 在事务中先 `SELECT` 预览行数，确认后再 `COMMIT`；异常则 `ROLLBACK` |
| **权限** | 需要 PostgreSQL 写权限（通常 `admin` / DBA 角色） |

### 将删除的数据域

| 表 | 说明 |
|----|------|
| `supplier_device` | 物理机台账（SN、IP、生命周期等） |
| `compute_node` | 计算/管控节点（随设备 `CASCADE`） |
| `resource_pool_binding` | 资源池绑定（随设备 `CASCADE`） |
| `internal_test_hold` | 内部测试占用（随设备 `CASCADE`） |
| `supplier_device_change_log` | 设备变更审计（随设备 `CASCADE`） |
| `onboarding_batch_device_link` | 设备 ↔ 业务批次关联（随设备/批次 `CASCADE`） |
| `supplier_gpu_inventory` | 机房×卡型 L1 聚合库存 |
| `onboarding_batch` | 全部批次（含 `online` / `order_access` / `device_inventory` / `device_changelog` / `device_retire`） |
| `onboarding_batch_plan_line` | 计划行（随批次 `CASCADE`） |
| `onboarding_batch_import_row` | 导入解析行（随批次 `CASCADE`） |
| `onboarding_task` | 接入施工任务（随批次 `CASCADE`） |
| `supplier_ops_upload_batch` | 运维上传批次（可选，见方案 B） |
| `supplier_activity` | 与 `device` / `batch` / `ops_upload_batch` 关联的活动（可选） |

### 不会删除的数据

- `supplier`、`data_center`、`supplier_contract`、`gpu_card_type`
- `supplier_card_list_price`、`supplier_unit_cost`、`supplier_pricing_record` 等商务定价
- `supplier_bill`、`fault_incident` 主记录（仅解除设备 FK，见方案说明）
- `lifecycle_state_definition` 字典

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
UNION ALL SELECT 'onboarding_batch_device_link', COUNT(*) FROM onboarding_batch_device_link
UNION ALL SELECT 'supplier_device_change_log', COUNT(*) FROM supplier_device_change_log
UNION ALL SELECT 'onboarding_task', COUNT(*) FROM onboarding_task
UNION ALL SELECT 'compute_node', COUNT(*) FROM compute_node
UNION ALL SELECT 'supplier_ops_upload_batch', COUNT(*) FROM supplier_ops_upload_batch
UNION ALL SELECT 'supplier_activity (device/batch)', COUNT(*) FROM supplier_activity
  WHERE ref_domain IN ('device', 'batch', 'ops_upload_batch');
```

按供应商/机房缩小范围时，可先查：

```sql
-- 替换为实际 ID
-- :supplier_id  / :data_center_id

SELECT batch_kind, batch_status, COUNT(*)
FROM onboarding_batch
WHERE supplier_id = :supplier_id   -- 可选
  AND data_center_id = :data_center_id  -- 可选
GROUP BY batch_kind, batch_status;

SELECT lifecycle_status, COUNT(*)
FROM supplier_device
WHERE supplier_id = :supplier_id
  AND data_center_id = :data_center_id
GROUP BY lifecycle_status;
```

---

## 2. 方案 A — 全量清理（推荐：测试环境重置）

**效果**：删除 **所有** 批次种类 + **全部** 物理设备 + L1 库存；故障单保留但解除设备关联。

**删除顺序说明**：

1. 先删 `supplier_device` → 级联清除 `change_log`、`device_link`、`compute_node` 等  
2. 再删 `supplier_gpu_inventory`  
3. 最后删 `onboarding_batch` → 级联清除 `plan_line`、`import_row`、`task`  
   - `supplier_device_change_log.onboarding_batch_id` 为 `RESTRICT`，必须在删批次前已无 change_log（步骤 1 已满足）

```sql
BEGIN;

-- （可选）解除故障单与设备/节点的关联，避免孤儿引用
UPDATE fault_incident
SET supplier_device_id = NULL,
    compute_node_id = NULL
WHERE supplier_device_id IS NOT NULL
   OR compute_node_id IS NOT NULL;

-- （可选）删除与设备/批次相关的活动时间线
DELETE FROM supplier_activity_attachment
WHERE activity_id IN (
  SELECT id FROM supplier_activity
  WHERE ref_domain IN ('device', 'batch', 'ops_upload_batch')
);

DELETE FROM supplier_activity
WHERE ref_domain IN ('device', 'batch', 'ops_upload_batch');

-- 1. 物理设备（级联：compute_node, resource_pool_binding, internal_test_hold,
--    supplier_device_change_log, onboarding_batch_device_link 等）
DELETE FROM supplier_device;

-- 2. L1 聚合库存
DELETE FROM supplier_gpu_inventory;

-- 3. 解除批次自引用 parent_batch_id（可选，DELETE 时也会 SET NULL）
UPDATE onboarding_batch SET parent_batch_id = NULL;

-- 4. 全部接入/导入/下架批次（级联：plan_line, import_row, task, 剩余 device_link）
DELETE FROM onboarding_batch;

-- 5. （可选）运维 Excel 上传批次
DELETE FROM supplier_ops_upload_batch;

COMMIT;
```

---

## 3. 方案 B — 仅清理上架/订单接入批次（保留物理机）

> 若只想删 **商务计划批次**（`online` / `order_access`），**不删** 已入库设备，使用本方案。  
> 进度关联 `onboarding_batch_device_link` 会随批次删除而清除，**设备本身保留**。

```sql
BEGIN;

-- 仅删除指向 online/order_access 的设备关联（不删设备）
DELETE FROM onboarding_batch_device_link
WHERE business_onboarding_batch_id IN (
  SELECT id FROM onboarding_batch
  WHERE batch_kind IN ('online', 'order_access')
);

-- 变更日志中「业务批次」引用置空（changelog 导入批次本身保留）
UPDATE supplier_device_change_log
SET business_onboarding_batch_id = NULL
WHERE business_onboarding_batch_id IN (
  SELECT id FROM onboarding_batch
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

-- 子表随 CASCADE 删除：plan_line, import_row, task
DELETE FROM onboarding_batch
WHERE batch_kind IN ('online', 'order_access');

COMMIT;
```

---

## 4. 方案 C — 按供应商或机房局部清理

在 **方案 A** 基础上增加 `WHERE` 条件。示例：仅清理某机房。

```sql
BEGIN;

-- 目标机房 ID
-- SET LOCAL 或直接在 WHERE 中写 literal
-- 例：'dc_xxxxxxxx'

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

-- 设备（级联子表）
DELETE FROM supplier_device
WHERE data_center_id = 'dc_xxxxxxxx';

-- 库存
DELETE FROM supplier_gpu_inventory
WHERE data_center_id = 'dc_xxxxxxxx';

-- 批次（含该机房的导入/上架/下架批次）
UPDATE onboarding_batch
SET parent_batch_id = NULL
WHERE data_center_id = 'dc_xxxxxxxx';

DELETE FROM onboarding_batch
WHERE data_center_id = 'dc_xxxxxxxx';

COMMIT;
```

将 `'dc_xxxxxxxx'` 换为 `supplier_id = 'sup_xxxxxxxx'` 可改为按供应商清理（注意 `supplier_gpu_inventory`、`onboarding_batch` 同样加 `supplier_id` 条件）。

---

## 5. 清理后校验

```sql
-- 应为 0
SELECT COUNT(*) AS devices FROM supplier_device;
SELECT COUNT(*) AS batches FROM onboarding_batch;
SELECT COUNT(*) AS gpu_inventory FROM supplier_gpu_inventory;
SELECT COUNT(*) AS change_logs FROM supplier_device_change_log;
SELECT COUNT(*) AS device_links FROM onboarding_batch_device_link;

-- 主数据应仍在
SELECT COUNT(*) AS suppliers FROM supplier;
SELECT COUNT(*) AS datacenters FROM data_center;
SELECT COUNT(*) AS contracts FROM supplier_contract;
```

---

## 6. 外键依赖速查（为何必须按此顺序）

```
supplier_device
  ├─ CASCADE → compute_node, resource_pool_binding, internal_test_hold
  ├─ CASCADE → supplier_device_change_log (按 device_id)
  ├─ CASCADE → onboarding_batch_device_link (按 supplier_device_id)
  └─ SET NULL → fault_incident.supplier_device_id, onboarding_task.supplier_device_id

supplier_device_change_log
  ├─ RESTRICT → onboarding_batch (onboarding_batch_id)  ← 删批次前必须先无 change_log
  └─ SET NULL → business_onboarding_batch_id (删业务批次时)

onboarding_batch
  ├─ CASCADE → plan_line, import_row, task, device_link (business side)
  ├─ SET NULL → supplier_device.onboarding_batch_id, parent_batch_id
  └─ SET NULL → supplier_ops_upload_batch.onboarding_batch_id
```

**结论**：全量清理时 **必须先 `DELETE supplier_device`，再 `DELETE onboarding_batch`**，否则会因 `supplier_device_change_log → onboarding_batch` 的 `RESTRICT` 约束失败。

---

## 7. 备份建议（生产环境）

```bash
# 仅导出将被清理的表（示例）
pg_dump "$DATABASE_URL" \
  -t supplier_device \
  -t supplier_gpu_inventory \
  -t onboarding_batch \
  -t onboarding_batch_plan_line \
  -t onboarding_batch_device_link \
  -t onboarding_batch_import_row \
  -t onboarding_task \
  -t supplier_device_change_log \
  -t compute_node \
  -t resource_pool_binding \
  -t internal_test_hold \
  -t supplier_ops_upload_batch \
  -Fc -f supplier-device-batch-backup.dump
```

---

## 8. 与全景文档的关系

清理完成后，可按 [`supplier-device-management-ops-panorama.md`](./supplier-device-management-ops-panorama.md) 中的 SOP 重新：

1. 创建上架/订单接入批次  
2. 在机房详情导入设备主数据表  
3. 导入设备变更表刷新进度  
