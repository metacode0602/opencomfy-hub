# 供应商设备下架 Excel 批量导入设计方案

> 版本：v1.1  
> 日期：2026-05-21  
> 状态：**阶段二已实施**（tRPC + PostgreSQL；`onboarding_batch.batch_kind=device_retire`）  
> 关联：`supplier-detail-content.tsx`（入口按钮）、[supplier-device-import-schema.md](./supplier-device-import-schema.md)（设备主数据与变更导入）、[supplier-database.md](./supplier-database.md)（`supplier_device`、`onboarding_batch`）、[supplier-datacenter-import-design.md](./supplier-datacenter-import-design.md)（两步流参考）

---

## 1. 目标与原则

### 1.1 业务目标

| # | 目标 | 说明 |
|---|------|------|
| G1 | 批量发起设备下架 | 在供应商详情页点击 **设备下架**，按机房上传 Excel 清单，发起下架工单 |
| G2 | **一机房一批次** | 每个机房上传 **一个** Excel 文件，对应 **一个下架批次**；同一弹窗可并行提交多个机房批次 |
| G3 | 填写下架元信息 | 弹窗统一填写 **下架原因**、**期望完成日期**、**备注**；作用于本次全部批次 |
| G4 | 机房内设备校验 | 校验清单中每台设备是否 **存在于指定机房**；跨机房、不存在、已下架等记 **error** |
| G5 | 可预览、可部分成功 | **填写元信息 + 上传 → 解析预览 → 确认提交**；单行 error 不阻断其它行 commit |
| G6 | 错误可导出 | 每个机房批次可 **下载错误行 Excel**（原列 + 错误原因，错误单元格高亮） |
| G7 | 与上架对称 | 业务形态与 `onboarding_batch`（`batch_kind=online`）镜像：上架导入生成设备，下架导入回收设备 |

### 1.2 非目标（阶段一 Mock）

- **不写入 PostgreSQL**（无 `device_retire_batch`、无 `supplier_device` 状态变更）
- **不调用 tRPC**（校验读 `supplier-domain-mock-store`）
- **不解除平台资源绑定**（`platform_resource_id` 仅 warning）
- **不创建运维工单**（无 `onboarding_task` 自动生成）
- **不上传文件到 OSS**（阶段二再归档 `import_file_uri`）
- **不同步**算算力 / K8s 集群侧下线

### 1.3 设计原则

1. **供应商 + 机房双锚点**：批次归属 `(supplier_id, data_center_id)`；设备匹配限定在该机房设备集合内。
2. **元信息与清单分离**：下架原因/日期/备注在 **表单** 填写；Excel 仅含 **设备标识列**，避免重复填写。
3. **预览先于写入**：与 [supplier-import-design.md](./supplier-import-design.md)、[supplier-datacenter-import-design.md](./supplier-datacenter-import-design.md) 一致。
4. **标识列 OR 匹配**：设备 ID、设备标识（asset_no/sn）、内网 IP 至少填一列；匹配优先级：设备 ID → 设备标识 → 内网 IP。
5. **warning 可提交、error 跳过**：告警行仍计入可下架台数；错误行 commit 时跳过并保留在错误导出中。
6. **阶段二无客户端预览状态**：commit 时重新上传各机房文件 + 元信息，服务端再次解析校验后入库（与供应商/机房导入一致）。

---

## 2. 入口与交互流程

### 2.1 入口

| 项 | 值 |
|----|-----|
| 页面 | `/supplier/suppliers/[id]` |
| 组件 | `SupplierDetailContent` |
| 按钮 | 页头操作区 **设备下架** |
| 弹窗 | `SupplierDeviceRetireDialog` |

### 2.2 三步流

```mermaid
flowchart LR
  A[填写下架信息 + 按机房上传 Excel] --> B[解析并校验]
  B --> C[预览：汇总 + 分机房 Tab + 错误导出]
  C --> D[确认下架]
  D --> E[完成：批次号 + 元信息回显]
```

| 步骤 | 标题 | 用户操作 |
|------|------|----------|
| 1 `upload` | 设备下架 | 选择下架原因、期望完成日期、备注；为各机房选择 Excel；点击「解析并校验」 |
| 2 `preview` | 确认下架清单 | 查看汇总统计、分机房明细；下载错误行；点击「确认下架」 |
| 3 `done` | 下架提交完成 | 展示批次编号、下架台数、元信息（Mock 不回写设备） |

### 2.3 弹窗 UI 线框（阶段一已实现）

```
┌─────────────────────────────────────────────────────────────┐
│ 设备下架                                                     │
│ 为 {供应商名} 各机房分别上传下架设备 Excel…                    │
├─────────────────────────────────────────────────────────────┤
│ 【下架信息】                                                 │
│  下架原因 * [下拉]     期望完成日期 * [date]                   │
│  备注 [textarea 选填]                                        │
├─────────────────────────────────────────────────────────────┤
│ 【华北-北京 DC1】                          [样例] [选择 Excel] │
│  北京 · HB-BJ-DC1 · 当前设备 3 台                            │
├─────────────────────────────────────────────────────────────┤
│ 【华北-上海 DC2】                          [样例] [选择 Excel] │
│  …                                                           │
├─────────────────────────────────────────────────────────────┤
│                        [取消]  [解析并校验]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 下架元信息（表单）

与 Excel 清单 **独立**，一次弹窗提交共享同一份元信息，写入每个下架批次。

| 字段 | UI 控件 | 必填 | 规则 |
|------|---------|------|------|
| `reason` | 下拉 Select | ✓ | 枚举见 §3.1 |
| `expected_completion_date` | `type=date` | ✓ | ≥ 当天（本地日期）；ISO 日期字符串 `YYYY-MM-DD` |
| `remark` | Textarea | | ≤ 2000 字符；trim 后入库 |

### 3.1 下架原因枚举

| `reason` code | 展示文案 |
|---------------|----------|
| `contract_expired` | 合同到期退租 |
| `hardware_upgrade` | 硬件升级替换 |
| `dc_closure` | 机房裁撤 |
| `performance_issue` | 性能不达标 |
| `business_adjustment` | 业务调整 |
| `cost_optimization` | 成本优化 |
| `other` | 其他 |

> 阶段二可改为字典表 `lifecycle_state_definition.domain = device_retire_reason`，便于运营配置。

---

## 4. Excel 清单结构

### 4.1 表头（4 列）

| 列序 | 表头 | 说明 |
|------|------|------|
| 1 | 设备ID | 对应 `supplier_device.external_device_id` |
| 2 | 设备标识 | 对应 `asset_no` 或 `sn` |
| 3 | 外网IP | 对应 `external_ip` |
| 4 | 内网IP | 对应 `internal_ip` |

**外网IP 与 内网IP 不能同时为空**；设备 ID / 设备标识为辅助匹配列。

### 4.2 表头别名

| 标准表头 | 可接受别名 |
|----------|------------|
| 设备ID | 设备 id、external_device_id |
| 设备标识 | asset_no、sn、资产号 |
| 内网IP | 内网 ip、内网IP地址、internal_ip |
| 外网IP | 外网 ip、公网 ip、public_ip、external_ip |

### 4.3 文件要求

| 项 | 规则 |
|----|------|
| 格式 | `.xlsx` / `.xls` / `.csv` / `.tsv` |
| 编码 | CSV/TSV 须 UTF-8（含 BOM 可识别） |
| 大小 | ≤ 10MB |
| 表头 | 第一行必须为 §4.1 列名（别名见 §4.2） |
| 单次上限 | ≤ **2000** 行 / 文件 |
| 空行 | 跳过（全空单元格） |

### 4.4 样例文件

| 文件 | 路径 | 说明 |
|------|------|------|
| 北京样例 | `lib/data/device-retire-sample.ts` → `DEVICE_RETIRE_SAMPLE_BJ_CSV` | 2 行有效 + 1 行不存在 |
| 上海样例 | 同上 → `DEVICE_RETIRE_SAMPLE_SH_CSV` | 1 行有效 + 1 行跨机房错误 |

---

## 5. 校验规则

### 5.1 设备匹配（单机房作用域）

在 `(supplier_id, data_center_id)` 过滤后的 `supplier_device` 集合中查找：

1. `external_device_id` 精确匹配（忽略大小写、trim）
2. 否则 `asset_no` 或 `sn` 匹配 `设备标识` 列
3. 否则 `internal_ip` 匹配 `内网IP` 列

### 5.2 行级 `parse_status`

| 状态 | 条件 | commit |
|------|------|--------|
| `error` | 见 §5.3 | **跳过** |
| `warning` | 见 §5.4 | **可提交** |
| `ok` | 通过且无 warning | **可提交** |

### 5.3 error 规则

| # | 条件 | 错误文案 |
|---|------|----------|
| E1 | 三列标识均为空 | 至少填写设备ID、设备标识或内网IP之一 |
| E2 | 机房内无匹配设备 | 设备在机房「{机房名}」中不存在 |
| E3 | 设备已下架 | 设备已下架（当前状态：{lifecycle_status}） |
| E4 | 文件格式/表头/行数 | 解析层错误（整文件失败） |

已下架判定：`lifecycle_status ∈ {已下线, retired}` 或 `ops_status = 已退订`。

### 5.4 warning 规则

| # | 条件 | 告警文案 |
|---|------|----------|
| W1 | `in_maintenance = true` | 设备处于维修中，下架前请确认运维已完成 |
| W2 | `platform_resource_id` 非空 | 设备已绑定平台资源 {id}，下架后将解除绑定 |
| W3 | `lifecycle_status = 接入中` | 设备仍在接入流程中，建议先完成或终止接入后再下架 |

### 5.5 表单校验（解析前）

| 字段 | 规则 |
|------|------|
| 下架原因 | 必选 |
| 期望完成日期 | 必选；不能早于今天 |
| 机房文件 | 至少一个机房已选文件 |

---

## 6. 数据模型（阶段二规划）

### 6.1 方案选型

**推荐**：扩展 `onboarding_batch`，新增 `batch_kind = device_retire`，与上架批次共用导入字段与状态机骨架。

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. `onboarding_batch.batch_kind=device_retire` | 与上架对称；复用 `import_*`、`parsed_rows_json` | `batch_kind` 语义略宽 |
| B. 独立表 `device_retire_batch` | 语义清晰 | 重复 import 字段与状态机 |

本文档按 **方案 A** 描述。

### 6.2 `onboarding_batch` 增量（`batch_kind = device_retire`）

在 §3.3 [supplier-database.md](./supplier-database.md) 基础上增加：

| 列名 | 类型 | 说明 |
|------|------|------|
| `retire_reason` | varchar(64) | §3.1 枚举 code |
| `expected_completion_date` | date | 期望完成日期 |
| `retire_remark` | text | 备注 |
| `retired_device_count` | integer | 实际下架台数（commit 后） |

`batch_status` 建议取值：`待开始` → `下架中` → `已完成` / `已取消`（或复用 `接入中`/`已完成` 并在 UI 按 kind 翻译）。

### 6.3 明细行 `onboarding_batch_import_row`（可选）

大文件时替代 `parsed_rows_json`：

| 列名 | 说明 |
|------|------|
| `row_no` | Excel 行号 |
| `external_device_id` | |
| `asset_no` | |
| `internal_ip` | |
| `matched_supplier_device_id` | 校验通过后 FK |
| `parse_status` | ok / warning / error |
| `errors_json` | string[] |
| `warnings_json` | string[] |

### 6.4 commit 时设备侧写入

对每个 `parse_status != error` 的行：

1. 更新 `supplier_device.lifecycle_status` → `已下线`（或 `retired`）
2. 更新 `supplier_device.ops_status` → `已退订`（与 [supplier-device-import-schema.md §2.1](./supplier-device-import-schema.md) 种子对齐）
3. 清空或归档 `platform_resource_id`（阶段二需与平台组对齐策略）
4. 写 `entity_state_transition_log`（`entity_type=device`，`trigger=ui_retire_batch`）
5. 投影 `supplier_activity`（类型如 `device_retire`）
6. 可选：写 `supplier_device_change_log`（`change_action=下架`）

### 6.5 库存聚合

`data_center_device` / GPU 库存汇总表在 commit 后 **递减** `quantity`、`online_quantity`（或异步重算任务）；与上架入库逻辑对称。

---

## 7. API 设计（阶段二 tRPC）

### 7.1 路由命名空间

`supplier.deviceRetire.*`（与 `supplier.deviceImport.*` 并列）

### 7.2 接口

| 过程 | 输入 | 输出 |
|------|------|------|
| `getContext` | `{ supplierId }` | 机房列表、最近下架批次、设备计数 |
| `preview` | `{ supplierId, meta, files: [{ dataCenterId, fileName, fileBase64 }] }` | `DeviceRetirePreviewResult` |
| `commit` | 同 preview | `DeviceRetireCommitResult` + 批次 id |

> preview 无服务端持久化；commit **重新解析** 全部文件，防止客户端篡改。

### 7.3 权限

| 角色 | preview | commit |
|------|---------|--------|
| 运营经理 | ✓ | ✓ |
| 商务经理 | ✓ | ✗（可配置） |
| 只读 | ✗ | ✗ |

RBAC 见 [rbac-design.md](./rbac-design.md)。

---

## 8. 错误导出

### 8.1 规则

- 仅导出 `errors.length > 0` 的行
- 列 = 原始表头 + **错误原因**
- 错误列与 `errorColumnIndexes` 对应单元格 **浅红底 + 深红字**（`xlsx-js-style`）

### 8.2 文件名

`{原文件名}-{机房名}-下架错误.xlsx`

### 8.3 实现

| 模块 | 路径 |
|------|------|
| 构建错误行 | `lib/supplier/device-retire-error-export.ts` → `buildDeviceRetireErrorExportRows` |
| 下载 | `downloadDeviceRetireErrorExcel` |

---

## 9. 阶段一已实现代码映射

| 职责 | 路径 |
|------|------|
| 入口按钮 | `components/dashboard/supplier-detail-content.tsx` |
| 弹窗 UI | `components/dashboard/supplier-device-retire-dialog.tsx` |
| 类型与枚举 | `lib/types/device-retire.ts` |
| Excel/CSV 解析 | `lib/supplier/parse-device-retire-xlsx.ts` |
| 校验与 Mock commit | `lib/supplier/device-retire-validation.ts` |
| 错误 Excel 导出 | `lib/supplier/device-retire-error-export.ts` |
| 样例 CSV | `lib/data/device-retire-sample.ts` |
| Mock 设备/机房 | `lib/data/supplier-domain-mock.ts` + `lib/stores/supplier-domain-mock-store.ts` |
| 供应商 ID 桥接 | `lib/supplier/supplier-id-bridge.ts`（`sup1` → `sup-huabei-01`） |

### 9.1 Mock commit 行为

- 生成批次号：`RET-{yyyyMMdd}-{序号}`（如 `RET-20260521-001`）
- **不修改** mock store 中设备状态
- 返回 `retiredCount` = 所有非 error 行数之和

---

## 10. 状态机（阶段二）

### 10.1 批次 `import_status`（复用上架）

| 状态 | 下架语义 |
|------|----------|
| `draft` | 已填元信息，未上传文件 |
| `uploaded` | 文件已上传 |
| `parsed` | 解析完成，待确认 |
| `parse_failed` | 解析失败 |
| `committing` | 正在更新设备状态 |
| `committed` | 下架完成 |
| `cancelled` | 已作废 |

### 10.2 设备生命周期（commit 后）

```
在线 / 接入中 / …  ──下架批次 commit──►  已下线
                                      ops_status = 已退订
```

---

## 11. 测试用例

| # | 场景 | 预期 |
|---|------|------|
| T1 | 未选原因/日期点击解析 | Toast 拦截 |
| T2 | 北京样例 CSV 上传至北京机房 | 2 ok + 1 error |
| T3 | 上海样例中「误填北京设备」行 | error：机房内不存在 |
| T4 | 上传已下架设备 `EXT-RETIRED-01` | error：设备已下架 |
| T5 | 上传 `EXT-7C11AA01`（有 platform_resource_id） | warning，仍可提交 |
| T6 | 下载错误行 Excel | 含错误原因列，错误单元格高亮 |
| T7 | 仅上传一个机房 | 单批次 preview |
| T8 | Mock 确认下架 | 返回批次号，设备状态不变 |

---

## 12. 实施路线

| 阶段 | 范围 | 状态 |
|------|------|------|
| **一** | 前端弹窗、客户端解析校验、Mock 设备库、错误导出 | 已完成 |
| **二** | `onboarding_batch.device_retire` 迁移、tRPC preview/commit、DB 写入 | **已完成** |
| **三** | 库存重算、OSS 归档、下架批次列表页 | 待实施 |
| **四** | 平台资源解绑联动、运维工单 | 规划中 |

---

## 13. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-05-21 | 阶段二落地：tRPC `deviceRetire.*`、DB commit、`contract_id`/`access_condition_sheet_id` 改为可选；Excel 增加外网IP |
| v1.0 | 2026-05-21 | 首版：一机房一批次 Excel 下架；表单元信息（原因/日期/备注）；校验规则；错误导出；阶段一 Mock 代码映射；阶段二 DB/API 规划 |
