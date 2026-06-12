# 商户 AM 数据权限设计方案

> **版本**：v1.1（已确认）  
> **日期**：2026-06-11  
> **状态**：**已实施（v1.1）**  
> **关联**：`merchant-management-design.md`（商户域模型）、`role-menu-data-access-design.md`（CRM AM 与门禁分层）、`rbac-design.md`（行级隔离总则）

**文档性质**：描述商户域 **客户经理（AM）分配** 与 **行级数据隔离** 方案；对齐现有 CRM `account_manager_assignment` / `crm-data-scope` 模式。

---

## 1. 需求摘要

| # | 需求 | 说明 |
|---|------|------|
| R1 | **商户 AM 分配** | 每个商户可指定 **主责客户经理**（`user_staff`），支持生效区间与历史追溯 |
| R2 | **行级可见性** | `user` 角色登录后，**仅能看到自己负责的商户**及其子资源 |
| R3 | **admin 全量** | `admin` 可见全部商户，可分配/变更 AM |
| R4 | **对齐 CRM AM 体验** | 列表支持「我负责的」视角；范围外单条访问返回 **404**；空范围列表返回 `[]` |
| R5 | **服务端强制** | 前端菜单过滤 + tRPC / REST 双层校验，不可仅靠 UI 隐藏 |

**业务背景**：商户（Partner / 分销商）由内部销售或渠道 AM 负责日常运营（跟进、充值、区域配置等）。当前商户模块挂在 **财务管理** 下且 **仅 admin** 可访问；需开放给 **`user` 角色**，并按 AM 范围隔离数据。

---

## 2. 现状与差距

### 2.1 已有能力

| 模块 | 现状 |
|------|------|
| 商户主数据 | `merchant` 表已落地；列表/详情/区域/进货价/充值/活动 tRPC 已实现 |
| 路由门禁 | `/merchant` 归入 `ROUTE_ACCESS.finance`，**仅 admin** 可访问 |
| 侧栏 | `navMarketplace` 中「商户管理」`roles: ADMIN_ONLY` |
| tRPC | `merchantRouter` 全部 endpoint 使用 **`adminProcedure`** |
| DataAccess | `merchantDataAccess.list` **无 scope 过滤**，返回全量 |
| CRM AM | `account_manager_assignment`（客户级）、`project_staff_assignment`（项目级）+ `crm-data-scope.ts` 已实现 |
| 商户 ↔ 租户 | `tenant_merchant` 多对多；经 CRM 租户可间接关联商户，但 **无直接 AM 字段** |

### 2.2 差距

1. **无商户 AM 分配表** — 无法表达「谁负责哪个商户」  
2. **无 MerchantDataScope** — DataAccess 无法按 staffId 过滤  
3. **`user` 无法进入商户模块** — 路由 / 菜单 / API 三重拦截  
4. **附件下载 API**（`/api/merchant/attachments/[id]`）仅校验登录，未校验商户归属  

---

## 3. 设计原则与核心决策

### 3.1 采用「商户级直接 AM 分配」（推荐）

| 方案 | 说明 | 结论 |
|------|------|------|
| **A. 商户级直接分配** | 新建 `merchant_account_manager_assignment`，与客户 AM 同构 | **✅ 采用** |
| B. 经 CRM 租户派生 | `visibleMerchantIds = merchants linked to visibleTenantIds` | ❌ 不采用为主规则 |
| C. A + B 并集 | 直接分配 ∪ 租户派生 | ⏸ 二期可选 |

**理由**：

- 商户是 **计费域 / 渠道伙伴主体**，与 CRM 客户 **无 1:1 对应**；伙伴 AM 与终端客户 AM 职责不同。  
- 新建商户、尚未绑定租户时，仍需指定 AM 并可见。  
- 与现有 `account_manager_assignment` 模式一致，实施与运维成本低。

### 3.2 默认商户（共绩科技）处理（已确认）

| 规则 | 说明 |
|------|------|
| **仅 admin 可见** | `is_default = true`（共绩科技）**仅管理员**可访问；`user` 即使被分配也不单独开放（通常不对共绩分配 AM） |
| **伙伴商户按 AM** | 非默认商户：`user` 仅见 `merchant_account_manager_assignment` 中自己负责的记录 |
| **admin 始终全量** | 管理员不受 AM 限制 |

### 3.3 与 CRM Scope 的关系

- **独立域**：`MerchantDataScope` 与 `CrmDataScope` **分开解析**，不合并。  
- **同一 staffId 来源**：均通过 `staffDataAccess.resolveStaffIdForAuthUser` 解析。  
- **无交叉继承**：CRM 可见客户 **不自动** 带来关联商户可见性（避免权限放大）。

---

## 4. 权限模型

### 4.1 角色 × 菜单

| 入口 | 路由 | admin | user | member |
|------|------|:-----:|:----:|:------:|
| 商户管理 | `/merchant` | ✓ | ✓（AM 范围内） | ✗ |
| 运营月报 / 系统卡型 / 平台定价 / 机房成本 | `/finance/*` 等 | ✓ | ✗ | ✗ |

**变更**：将 `/merchant` 从 `ROUTE_ACCESS.finance` **移出**，新增独立前缀 `merchant: ['/merchant']`，`canAccessPath` 规则为 `admin | user`。

侧栏「商户管理」`roles` 改为 `['admin', 'user']`；**新建独立「商户运营」分组**（与「财务管理」分离）。

### 4.2 角色 × 数据范围

```ts
type MerchantDataScope =
  | { type: 'all' }                           // admin
  | { type: 'am_assigned'; staffId: string; cache: MerchantVisibilityCache }
  | { type: 'none' }                          // member 或无效角色
```

**解析流程**（对齐 `resolveCrmDataScope`）：

1. `admin` → `{ type: 'all' }`  
2. `member` → `{ type: 'none' }`（访问商户路由 → 403）  
3. `user` → 解析 `staffId`；无绑定 → **403**（提示联系管理员）  
4. `user` + `staffId` → `{ type: 'am_assigned', staffId, cache: {} }`

**可见商户集合**：

```sql
SELECT merchant_id
FROM merchant_account_manager_assignment
WHERE user_staff_id = :staffId
  AND effective_to IS NULL;
```

记为 `visibleMerchantIds`。

| 场景 | 行为 |
|------|------|
| `scope.type === 'all'` | 不过滤 |
| `visibleMerchantIds` 为空 | 列表 `[]`；getById → **404** |
| 范围外 ID | getById / 子资源 → **404**（不 403，防泄露存在性） |

### 4.3 角色 × 写权限

| 操作 | admin | user（范围内） |
|------|:-----:|:--------------:|
| 查看商户及子资源 | ✓ | ✓ |
| 编辑商户主数据（名称、主体、联系人等） | ✓ | ✓ |
| 联系人 CRUD | ✓ | ✓ |
| 活动评论 / 附件 | ✓ | ✓ |
| 充值记录 CRUD | ✓ | ✓ |
| 机房区域 / 卡型 / 进货价 | ✓ | ✓ |
| **分配 / 变更商户 AM** | ✓ | ✗ |
| **平台同步**（`merchant.sync.*`） | ✓ | ✗ |
| **新建商户**（若后续开放） | ✓ | ✗ |

> **已确认**：`user` 在范围内可修改 **机房区域 / 进货价**（伙伴 AM 日常运营需要）。

---

## 5. 数据模型

### 5.1 新表 `merchant_account_manager_assignment`

与客户级 AM 表同构，挂载商户域 schema（`packages/db/src/merchant-schema.ts`）。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | text | PK | UUID |
| `merchant_id` | text | FK → `merchant.id` ON DELETE CASCADE, NOT NULL | |
| `user_staff_id` | text | FK → `user_staff.id` ON DELETE RESTRICT, NOT NULL | 主责 AM |
| `role_type` | varchar(32) | NOT NULL | 固定 `'account_manager'`（预留扩展） |
| `effective_from` | timestamptz | NOT NULL | 生效起点 |
| `effective_to` | timestamptz | 可空 | `NULL` = 当前主责 |
| `remark` | text | 可空 | 变更备注 |
| `created_by_staff_id` | text | FK → `user_staff.id`, 可空 | 操作人 |
| `created_at` | timestamptz | NOT NULL | |

**索引**：

- `merchant_account_manager_assignment_merchant_id_idx` ON (`merchant_id`)  
- `merchant_account_manager_assignment_user_staff_id_idx` ON (`user_staff_id`)  

**不变量**：

| # | 规则 |
|---|------|
| MAM-1 | 每个 `merchant_id` **至多一条** `effective_to IS NULL` 记录（当前主责唯一） |
| MAM-2 | 变更 AM 时：**关闭**旧记录（写 `effective_to`）+ **插入**新记录；**不**物理删除历史 |
| MAM-3 | `effective_from` 校验逻辑 **复用** 项目 AM 的 `project-effective-dates` 工具（上海日界） |

### 5.2 ER 补充

```text
merchant (1) ──< merchant_account_manager_assignment >── (1) user_staff
```

### 5.3 列表展示字段（冗余读）

`MerchantListRow` 增加（JOIN 当前 AM）：

| 字段 | 说明 |
|------|------|
| `accountManagerStaffId` | 当前主责 staff id，可空 |
| `accountManagerName` | 展示名 |

---

## 6. 服务端实现设计

### 6.1 模块：`merchant-data-scope.ts`

路径建议：`apps/web/src/lib/server/auth/merchant-data-scope.ts`

```ts
// 核心 API（对齐 crm-data-scope.ts）
resolveMerchantDataScope(user): Promise<MerchantDataScope>
loadVisibleMerchantIds(scope): Promise<string[] | null>
buildMerchantIdFilter(merchantIds: string[] | null): SQL | undefined
assertMerchantInScope(scope, merchantId): Promise<void>
filterMerchantGetById(scope, merchantId, loader): Promise<T | null>
```

**Filter 空集处理**（与 CRM 一致）：

```ts
if (merchantIds.length === 0) return inArray(merchant.id, ['__none__'])
```

### 6.2 tRPC Procedure

在 `trpc.ts` 新增：

| Procedure | 条件 | 注入 ctx |
|-----------|------|----------|
| `merchantScopedProcedure` | `admin \| user`；`member` → 403 | `merchantScope` |
| `merchantWriteProcedure` | 同上 | `merchantScope` + mutate 前 `assertMerchantInScope` |
| `merchantAdminProcedure` | `admin` only | — |

**Router 映射**：

| Endpoint | Procedure |
|----------|-----------|
| `merchant.list`, `getById`, `tenant.list`, `activity.*`, `recharge.*`, `region.*`, `pricing.*`, `consumption.*`, `contact.*` | `merchantScopedProcedure` |
| 上述 mutate（非 sync） | `merchantWriteProcedure` |
| `merchant.sync.preview`, `merchant.sync.commit` | `merchantAdminProcedure` |
| `merchant.changeAccountManager`, `merchant.getAccountManagerAssignment` | 读：`merchantScopedProcedure`；写 AM：**`merchantAdminProcedure`** |

### 6.3 DataAccess 改造点

所有 `merchant*` DataAccess 的 **入口方法** 增加 `scope: MerchantDataScope` 参数（或通过 options 传入）：

| 模块 | 过滤方式 |
|------|----------|
| `merchant.list` | `WHERE merchant.id IN (:visibleMerchantIds)` |
| `merchant.getById` | `filterMerchantGetById` |
| `merchant-region.*` | 先 `assertMerchantInScope(merchantId)` |
| `merchant-pricing.*` | 同上 |
| `merchant-recharge.*` | 同上 |
| `merchant-activity.*` | 同上 |
| `merchant-contacts.*` | 同上 |
| `merchant-consumption.*` | 同上 |
| `merchant-platform-sync.*` | admin only，无需 scope |

**列表统计**：`merchant.list` 顶部 KPI（总数、活跃数等）在 `user` 视角下 **仅统计可见商户**，避免泄露全局数字。

### 6.4 REST 附件 API

`/api/merchant/attachments/[id]/route.ts`：

1. 解析 `merchantScope`  
2. 由 attachment 反查 `merchantId`  
3. `assertMerchantInScope` 后再返回文件流  

### 6.5 门禁分层（四层）

```
Layer 1: proxy.ts / route-access.ts     — /merchant 允许 admin | user
Layer 2: sidebar-menu.tsx               — 商户管理对 user 可见
Layer 3: merchantScoped/Write Procedure — 域门禁 + scope 注入
Layer 4: merchant DataAccess            — 行级 WHERE / assert
```

---

## 7. AM 分配业务逻辑

### 7.1 变更流程（对齐项目 AM）

参考 `projectAccountManagerDataAccess.change`：

1. 校验 `effectiveFrom` 日期格式  
2. 若新 AM 与当前相同且日期未变 → 幂等返回  
3. 在同一事务内：  
   - 将当前 `effective_to IS NULL` 记录的 `effective_to` 设为 `effectiveFrom` 前一日结束  
   - 插入新 assignment 行  
4. （可选）写入 `merchant_activity` 系统事件：`type = 'account_manager_changed'`

### 7.2 tRPC 接口草案

```ts
merchant.getAccountManagerAssignment({ merchantId })
  → { staffId, staffName, effectiveFrom }

merchant.changeAccountManager({ merchantId, staffId, effectiveFrom, remark? })
  → void  // adminProcedure
```

### 7.3 员工统计

`user_staff` 列表可增加 `assigned_merchant_count`（admin 员工管理页），查询：

```sql
SELECT user_staff_id, COUNT(*)
FROM merchant_account_manager_assignment
WHERE effective_to IS NULL
GROUP BY user_staff_id
```

---

## 8. 前端 UI 设计

### 8.1 商户列表

| 元素 | admin | user |
|------|-------|------|
| 列表数据 | 全量（可筛 AM） | **仅负责商户**（后端过滤） |
| AM 筛选器 | 「全部 / 我负责的 / 指定 AM」 | 隐藏或固定「我负责的」 |
| 「同步平台」按钮 | 显示 | **隐藏** |
| 「新建商户」 | 显示 | **隐藏** |
| 表格列「客户经理」 | 显示 | 显示 |

AM 筛选实现可 **复用** 项目列表 `STAFF_FILTER_ME` / `listAccountManagerFilterOptions` 模式；新增 `merchant.listAccountManagerFilterOptions`（admin only）。

### 8.2 商户详情 / 概览

- 概览区展示 **当前客户经理** + 生效日期  
- admin 可点击「设置客户经理」→ `MerchantAccountManagerDialog`（对齐 `ProjectAccountManagerDialog`）  
- `user` 只读展示 AM 信息  

### 8.3 越权导航

直接访问 `/merchant/{id}` 且 ID 不在 scope → 详情页 tRPC 404 → 展示「商户不存在」空态（与 CRM 一致）。

---

## 9. 迁移与初始化

| 步骤 | 动作 |
|------|------|
| M1 | CREATE `merchant_account_manager_assignment` |
| M2 | **不** 自动 backfill AM；由 admin 在 **商户详情 / 列表 UI 手工补录** AM 分配 |
| M3 | 部署 scope 代码后，`user` 在无分配前看到 **空列表**（符合预期） |

---

## 10. 实施分期

| 阶段 | 范围 | 交付 |
|------|------|------|
| **P1 数据层** | 建表 + Drizzle schema + 迁移 | 表可用 |
| **P2 Scope 内核** | `merchant-data-scope.ts` + Procedure | 服务端可解析 scope |
| **P3 读路径** | list / getById / 子资源读 + 附件 API | user 可读范围内数据 |
| **P4 写路径** | mutate + assert | user 可运营范围内商户 |
| **P5 AM 管理 UI** | 分配对话框 + 列表 AM 列/筛选 | admin 可维护 AM |
| **P6 门禁** | route-access + sidebar | user 可进入模块 |

建议 **P2→P3→P6→P4→P5** 顺序，先只读打通再开放写。

---

## 11. 已确认决策（2026-06-11）

| # | 问题 | **确认结论** |
|---|------|-------------|
| **Q1** | `user` 是否开放商户模块菜单？ | **是** — 伙伴 AM 使用 `user` 角色，可进入 `/merchant` |
| **Q2** | 默认商户「共绩科技」可见性 | **否，仅 admin** — `user` 不可见共绩科技（`is_default = true` 排除在 AM 范围外） |
| **Q3** | `user` 能否修改 **机房区域 / 进货价**？ | **能** — 负责范围内可写 |
| **Q4** | 侧栏分组 | **新建「商户运营」分组**，与「财务管理」分离 |
| **Q5** | CRM 租户派生可见性 | **二期做** — 本期仅商户级直接 AM 分配 |
| **Q6** | 历史商户 AM backfill | **手工补录** — admin 在 UI 逐户设置 AM，不提供 CSV 脚本 |

---

## 12. 参考实现

| 资源 | 路径 |
|------|------|
| CRM Data Scope | `apps/web/src/lib/server/auth/crm-data-scope.ts` |
| 客户 AM 表 | `packages/db/src/crm-schema.ts` → `account_manager_assignment` |
| 项目 AM 变更 | `apps/web/src/lib/server/dataaccess/crm/project-account-manager.ts` |
| 项目 AM 对话框 | `apps/web/src/components/dashboard/project-account-manager-dialog.tsx` |
| 商户 Router | `apps/web/src/lib/server/routers/merchant/index.ts` |
| 路由门禁 | `apps/web/src/lib/auth/route-access.ts` |
| 侧栏配置 | `apps/web/src/lib/navigation/sidebar-menu.tsx` |

---

## 13. 实施记录

| 模块 | 路径 | 状态 |
|------|------|------|
| AM 分配表 | `packages/db/src/merchant-schema.ts` + `0006_merchant_account_manager_assignment.sql` | ✅ |
| Data Scope | `apps/web/src/lib/server/auth/merchant-data-scope.ts` | ✅ |
| AM 变更逻辑 | `apps/web/src/lib/server/dataaccess/merchant/merchant-account-manager.ts` | ✅ |
| tRPC Procedure | `merchantScopedProcedure` / `merchantWriteProcedure` | ✅ |
| Router 接入 | `apps/web/src/lib/server/routers/merchant/index.ts` | ✅ |
| 路由 / 侧栏 | `route-access.ts` + `sidebar-menu.tsx`（商户运营分组） | ✅ |
| 列表 / 详情 UI | AM 列、筛选、补录对话框 | ✅ |
| 附件 API | scope 校验 | ✅ |

**待运维**：执行迁移 `0006_merchant_account_manager_assignment.sql`；admin 在 UI 手工补录历史 AM。

**不在本期**：CRM 租户派生可见性（Q5 二期）、commercial 绑定、商户自助门户。
