# 项目收入归属部门 — 设计方案

> 版本：v1.1  
> 日期：2026-06-01  
> 状态：**P1 已确认 — CRM 主数据维护开发中**  
> 关联：  
> - `packages/db/src/crm-schema.ts`（`project`、`project_staff_assignment`）  
> - `apps/web/src/components/dashboard/projects-content.tsx`  
> - `apps/web/content/design/cost-compute-v3-redesign-with-examples.md`  
> - `apps/web/src/lib/server/routers/crm/schemas.ts`（`staffDepartmentSchema`）

---

## 1. 背景与目标

经营项目需维护 **收入归属部门**（如销售、中台）与 **项目客户经理（AM）**，并支持 **按生效日期补录历史**，以便后续账期收入/成本按自然月正确归因（例：4 月销售、5 月中台）。

部门字典与 `STAFF_DEPARTMENTS` / `staffDepartmentSchema` 一致：`中台` | `运营中心` | `产品` | `研发` | `运维` | `销售`。

---

## 2. 产品确认（2026-06-01）

| # | 决策 | 结论 |
|---|------|------|
| C1 | 历史表 + `project.revenue_department` 冗余 | **接受** |
| C2 | `platform_cost_monthly` record 唯一键增加部门 | **下期**，本期不改财务汇总键 |
| C3 | 账期成本/收入 pipeline 按 `period_end` 解析历史 AM | **本期不实现**，下期与财务 P2/P3 一并做 |
| C4 | 部门变更允许补录过去生效日 | **允许**（`effective_from` 可选历史日期） |
| C5 | 创建项目默认部门 | **`销售`** |
| C6 | AM / 部门维护入口 | **项目列表行操作下拉独立菜单**，不与「编辑项目」混用 |

---

## 3. 本期范围（P1 — CRM）

### 3.1 数据模型（本期落库）

1. **`project.revenue_department`**：当前生效部门（冗余，列表/筛选）
2. **`project_revenue_department_assignment`**：部门历史真值（`effective_from` / `effective_to` 为 `date`）
3. **`project_staff_assignment`**：沿用现有表；本期 **修正 AM 变更逻辑**（支持补录生效日），**不**改财务读路径

### 3.2 本期不做

- 财务表 `revenue_department` 列及 `resolveProjectPeriodContext` 写入成本/收入 pipeline
- `platform_cost_monthly` 按部门拆 record 唯一键
- 账期计算时按 `period_end` 解析历史 AM（仍用 `effective_to IS NULL` 的当前 AM）

### 3.3 领域规则（部门 & AM 变更）

**锚点**：东八区自然日 `YYYY-MM-DD`。

**部门**（`project_revenue_department_assignment`）：

| 情况 | 行为 |
|------|------|
| 新生效日 **晚于** 当前段 `effective_from` | 当前段 `effective_to = 新生效日 - 1 天`；插入新段 `effective_to IS NULL`；`project.revenue_department` = 新部门 |
| 新生效日 **早于** 当前段 `effective_from` | 插入历史段 `[新生效日, 当前段起始日 - 1 天]`；**不**改 `project.revenue_department`（仍以当前段为准） |
| 新生效日 **等于** 当前段起始日 | 同部门 noop；异部门更新当前段 `department` 并同步 `project.revenue_department` |

**客户经理**（`project_staff_assignment`，`role_type = account_manager`）：

| 情况 | 行为 |
|------|------|
| 新生效日 **晚于** 当前 `effective_from`（按东八区日期比较） | 当前行 `effective_to = 前一日 23:59:59 +08:00`；插入新行 `effective_from = 新生效日 00:00:00 +08:00`，`effective_to IS NULL` |
| 新生效日 **早于** 当前起始日 | 插入历史行，区间至当前起始日前一日 23:59:59；**保留**当前主责行 |
| 新人与当前同人 | noop |

**创建项目**：同事务写入首条部门段（`effective_from = start_date`）、四人组（含 AM）、`project.revenue_department`。

**编辑项目**（「编辑项目」弹窗）：**不**变更 AM、**不**变更部门；仅售前/交付/项目经理等基本信息（AM 仍通过下拉「设置客户经理」）。

---

## 4. UI：项目列表下拉菜单

`ProjectsContent` 行内 `⋯` 菜单在本期增加（与「编辑项目」「项目分成」并列）：

| 菜单项 | 组件 | 说明 |
|--------|------|------|
| **设置客户经理** | `ProjectAccountManagerDialog` | 选人 + 生效日期 + 可选备注；展示当前 AM |
| **设置收入归属部门** | `ProjectRevenueDepartmentDialog` | 部门 Select + 生效日期 + 可选备注；展示当前部门 |

列表表头增加 **归属部门** 列（`project.revenue_department`）。

创建项目表单（`ProjectFormFields`）增加 **收入归属部门**（默认销售）；**保留**客户经理选人（初始化 AM）。

---

## 5. API（tRPC `crm.projects`）

| 过程 | 输入 | 说明 |
|------|------|------|
| `getAccountManagerAssignment` | `projectId` | 当前 AM `staffId`、姓名、`effectiveFrom`（ISO 日期） |
| `changeAccountManager` | `projectId`, `staffId`, `effectiveFrom`, `remark?` | 补录/变更 AM |
| `getRevenueDepartmentAssignment` | `projectId` | 当前部门、`effectiveFrom` |
| `changeRevenueDepartment` | `projectId`, `department`, `effectiveFrom`, `remark?` | 补录/变更部门 |

`create` 的 `projectUpsertSchema` 增加 `revenueDepartment`（必填）；`update` **忽略** `staff.accountManagerStaffId` 与 `revenueDepartment`。

---

## 6. 下期（P2/P3 — 财务）

- `resolveProjectPeriodContext(projectId, period_end)`：部门按 §3.3 历史表解析；AM 按历史 `project_staff_assignment`（C3）
- 派生表快照列：`billing_period_cost_source_line`、`platform_income_monthly` 等
- **可选**：`platform_cost_monthly` record 唯一键 + `revenue_department`（C2）

---

## 7. 迁移

1. `ALTER TABLE project ADD revenue_department varchar(32);`
2. `CREATE TABLE project_revenue_department_assignment (...);`
3. 历史项目：运营回填或创建时补首段；未回填前 `revenue_department` 可为 NULL，列表显示「—」

---

## 8. P1 验收清单

- [ ] 新建项目必选部门，产生首条 `project_revenue_department_assignment`
- [ ] 列表下拉可单独「设置客户经理」「设置收入归属部门」
- [ ] 编辑项目不改变 AM/部门
- [ ] 补录 4/1 部门=销售、5/1 部门=中台后，库内两段历史正确，`project.revenue_department`=中台
- [ ] 补录 AM 生效日早于当前主责时，插入历史行且当前主责不变
- [ ] 财务账期计算行为与改前一致（仍当前 AM），直至下期 pipeline

---

## 9. 代码清单（P1）

| 区域 | 文件 |
|------|------|
| DB | `crm-schema.ts`、`drizzle/0002_project_revenue_department.sql` |
| 服务端 | `project-effective-dates.ts`、`project-revenue-department.ts`、`project-account-manager.ts`、`projects.ts` |
| 解析（下期用） | `project-context-as-of.ts` |
| 路由 | `routers/crm/schemas.ts`、`routers/crm/index.ts` |
| 前端 | `project-revenue-department-dialog.tsx`、`project-account-manager-dialog.tsx`、`projects-content.tsx`、`project-form-fields.tsx`、`project-form-utils.ts`、`types.ts` |
