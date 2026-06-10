# 角色菜单与数据权限实现方案

> 版本：v1.3（已确认）  
> 日期：2026-06-09  
> 状态：**已实施（v1.3）**  
> 关联文档：[rbac-design.md](./rbac-design.md)（认证、员工绑定、密码策略等基础 RBAC）

---

## 1. 需求摘要

非管理员用户登录后，按 `users.role` 区分菜单可见性与数据范围：

| 角色 | 菜单范围 | 数据范围 |
|------|----------|----------|
| `admin` | 全部 | 全部 |
| `member` | **仅算力供应链** + 公共模块 | 供应链域全量；**可写**（见 §4.3） |
| `user` | **仅客户经营 CRM** + 公共模块 | **客户级 AM + 项目 AM + 项目四人组任意角色** 并集范围内的 customer / project / tenant / workbench 数据；**范围内可读写** |

**跨角色公共（不限制角色）**：

- 设备流转（`/dashboard/flow`）
- 接入看板（`/dashboard/global`）
- 租户黑名单（`/crm/tenant-blacklist`，**列表可读**；**同步仅 admin**，见 §4.3）

**仅管理员**：

- 员工管理（`/crm/staff`）
- 财务管理（`/finance/*` 及侧栏「财务管理」分组下全部入口，含 `/supplier/gpu-card-types`、`/supplier/platform-pricing`、`/supplier/unit-costs`）

---

## 2. 现状与差距

### 2.1 已有能力

| 模块 | 现状 |
|------|------|
| 认证 | Better Auth；`users.role` 含 `admin` / `user`；`user_staff.auth_user_id` 关联登录账号 |
| 员工解析 | `staffDataAccess.resolveStaffIdForAuthUser()` 可通过 `auth_user_id` 反查 `user_staff.id` |
| 客户级 AM | `account_manager_assignment`：客户 ↔ 客户经理（`effective_to IS NULL` 为当前主责） |
| 项目级 AM | `project_staff_assignment`：`role_type = 'account_manager'` 时为项目客户经理 |
| 项目四人组 | `project_staff_assignment`：`pre_sales` / `account_manager` / `delivery_manager` / `project_manager` |
| 侧栏 | `app-sidebar.tsx` 固定展示全部菜单，**未按角色过滤** |
| 路由守卫 | `proxy.ts` 仅校验登录与强制改密，**无角色/路径门禁** |
| tRPC | `protectedProcedure`（登录即可）、`adminProcedure`（现实现为 `role !== 'user'`，会误放行 `member`） |
| CRM 数据 | list/get **无行级过滤**，任意登录用户可读全量 |
| 租户黑名单 API | 当前为 `adminProcedure`，与「任意角色可访问列表」需求不符 |
| 财务 API | 多为 `protectedProcedure`，与「仅管理员」需求不符 |

### 2.2 与旧版 rbac-design.md 的差异

旧稿将 `user` 与 `member` 均视为 CRM AM 范围只读/可写。本方案按业务重新划分：

| 维度 | 旧稿 | 本方案 |
|------|------|--------|
| `member` 菜单 | CRM（AM 范围） | **供应链** |
| `member` 数据 | CRM AM 范围 | **供应链全量，可写** |
| `user` 数据范围 | 客户级 AM + 项目 AM | **客户级 AM + 项目 AM + 项目四人组任意角色（并集，已确认）** |
| `user` 写权限 | 范围内可写 | **范围内可写（已确认）** |
| 设备流转 | 未单独说明 | **全角色可见** |
| 租户黑名单 | 未单独说明 | **全角色可读列表；sync 仅 admin** |
| 接入看板 | 未单独说明 | **全角色可读** |
| 员工 / 财务 | 部分纳入二期 | **本期 admin only** |

---

## 3. 权限模型

### 3.1 应用角色（鉴权唯一来源）

以 `users.role` 为准（`user_staff.roles` 仅用于开通账号时写入 `users.role`，不参与运行时二次计算）：

```ts
type AppRole = 'admin' | 'user' | 'member'
```

**角色映射修复**（实施时需改）：`resolveUserRoleFromStaffRoles()` 当前只返回 `admin | user`，需支持 `member`：

```ts
function resolveUserRoleFromStaffRoles(roles: string[]): AppRole {
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('member')) return 'member'
  return 'user'
}
```

多角色并存时优先级：`admin` > `user` > `member`（与员工勾选多个应用角色时的语义一致）。

### 3.2 菜单权限矩阵

侧栏分组与路由映射（`app-sidebar.tsx`）：

| 分组 / 入口 | 路由前缀 | admin | member | user |
|---------------|----------|:-----:|:------:|:----:|
| 设备流转 | `/dashboard/flow` | ✓ | ✓ | ✓ |
| 接入看板 | `/dashboard/global` | ✓ | ✓ | ✓ |
| **算力供应链** | `/supplier/*`（不含定价三条，见下） | ✓ | ✓ | ✗ |
| 工作台 | `/crm/workbench` | ✓ | ✗ | ✓ |
| 客户管理 | `/crm/customers` | ✓ | ✗ | ✓ |
| 计费租户 | `/crm/tenants` | ✓ | ✗ | ✓ |
| 租户黑名单 | `/crm/tenant-blacklist` | ✓ | ✓ | ✓ |
| 平台项目 | `/crm/projects` | ✓ | ✗ | ✓ |
| 员工 | `/crm/staff` | ✓ | ✗ | ✗ |
| **财务管理** | `/finance/*` | ✓ | ✗ | ✗ |
| 系统卡型 | `/supplier/gpu-card-types` | ✓ | ✗ | ✗ |
| 平台定价 | `/supplier/platform-pricing` | ✓ | ✗ | ✗ |
| 机房成本 | `/supplier/unit-costs` | ✓ | ✗ | ✗ |
| 操作记录 | `/dashboard/history` | ✓ | ✓ | ✓ |
| 设置 / 帮助 | `/settings`, `/help` | ✓ | ✓ | ✓ |

### 3.3 数据权限矩阵

| 数据域 | admin | member | user |
|--------|-------|--------|------|
| 供应链（supplier） | 全部（读写） | 全部（读写） | **不可访问** |
| 设备流转 / 接入看板 | 全部 | 全部 | 全部 |
| 租户黑名单（列表） | 全部 | 全部 | 全部 |
| CRM 客户 / 项目 / 租户 / 工作台 | 全部（读写） | **不可访问** | 客户级 AM + 项目 AM + 项目四人组范围内（读写） |
| CRM 合同 / 账单 / 导入 / 同步等 | 全部 | 不可访问 | 继承项目范围 |
| 员工主数据 | 全部 | 不可访问 | 不可访问 |
| 财务账期 / 成本 / 提成 | 全部 | 不可访问 | 不可访问 |

### 3.4 User 角色数据范围（Data Scope）

```ts
type CrmDataScope =
  | { type: 'all' }                              // admin
  | { type: 'am_assigned'; staffId: string }     // user
  | { type: 'none' }                             // member 访问 CRM 时
```

**解析流程**：

1. `admin` → `{ type: 'all' }`
2. `member` → 访问 CRM 路由时直接 **403**；不解析 CRM scope
3. `user` → 通过 `resolveStaffIdForAuthUser` 取 `staffId`；若无绑定 → **403**（提示联系管理员绑定员工档案）
4. `user` + `staffId` → `{ type: 'am_assigned', staffId }`

**范围定义（三路并集）**：

1. `account_manager_assignment` — **客户级 AM**
2. `project_staff_assignment` 且 `role_type = 'account_manager'` — **项目级 AM**
3. `project_staff_assignment` 且 `role_type IN (四人组)` — **项目四人组任意角色**

其中路径 2 为路径 3 的子集；实现时可合并路径 2、3 为一次 `project_staff_assignment` 查询。

**Step 1 — 客户级 AM 负责的客户**：

```sql
SELECT customer_id
FROM account_manager_assignment
WHERE user_staff_id = :staffId
  AND effective_to IS NULL;
```

记为 `amCustomerIds`。

**Step 2 — 项目级分配（项目 AM + 项目四人组）**：

```sql
SELECT project_id
FROM project_staff_assignment
WHERE user_staff_id = :staffId
  AND effective_to IS NULL
  AND role_type IN (
    'pre_sales',
    'account_manager',
    'delivery_manager',
    'project_manager'
  );
```

记为 `staffProjectIds`（已含项目级 AM）。

**Step 3 — 派生可见集合**：

| 集合 | 规则 |
|------|------|
| `visibleCustomerIds` | `amCustomerIds` ∪ `SELECT customer_id FROM crm_project WHERE id IN (staffProjectIds)` |
| `visibleProjectIds` | `SELECT id FROM crm_project WHERE customer_id IN (amCustomerIds)` ∪ `staffProjectIds` |
| `visibleTenantIds` | **仅** `project_tenant.tenant_id WHERE project_id IN (:visibleProjectIds)` |

说明：

- **客户级 AM**：该客户下**全部项目**均可见（客户继承）。
- **项目级 AM / 项目四人组**：对应项目及其所属客户可见；**不**继承该客户下其他未参与的项目。
- **租户**：仍仅展示可见项目上的 `project_tenant` 绑定；**不**回退客户默认租户（§10 #6 已确认）。

**单条 getById**：`user` 访问范围外 ID → 返回 **404**（避免泄露存在性）。

**空范围**：列表返回 `[]`，不返回 403。

---

## 4. 门禁分层设计

原则：**前端隐藏菜单 + 服务端强制校验**（仅藏菜单不够）。

```
┌────────────────────────────────────────────────────────────┐
│ Layer 1: proxy.ts 路由门禁                                  │
│  按 path 前缀 + role 重定向 403 页或角色默认首页               │
└────────────────────────────┬───────────────────────────────┘
                             ▼
┌────────────────────────────────────────────────────────────┐
│ Layer 2: AppSidebar 菜单过滤                                │
│  按 role 渲染 navMain / navSupply / navCrm / navMarketplace │
└────────────────────────────┬───────────────────────────────┘
                             ▼
┌────────────────────────────────────────────────────────────┐
│ Layer 3: tRPC Procedure 域门禁                              │
│  adminProcedure | supplyProcedure | crmScoped/Write | …   │
└────────────────────────────┬───────────────────────────────┘
                             ▼
┌────────────────────────────────────────────────────────────┐
│ Layer 4: DataAccess 行级过滤（user 的 CRM 读/写前校验）       │
│  buildProjectFilter(scope) / assertProjectInScope(...)      │
└────────────────────────────────────────────────────────────┘
```

### 4.1 路由前缀配置（建议 `lib/auth/route-access.ts`）

```ts
export const ROUTE_ACCESS = {
  // 全角色可访问
  shared: ['/dashboard/flow', '/dashboard/global', '/crm/tenant-blacklist'],
  supply: ['/supplier'],
  crm: ['/crm'],
  crmAdminOnly: ['/crm/staff'],
  finance: ['/finance', '/supplier/gpu-card-types', '/supplier/platform-pricing', '/supplier/unit-costs'],
  common: ['/dashboard', '/dashboard/history', '/settings', '/help', '/change-password'],
} as const

export function canAccessPath(role: AppRole, path: string): boolean
export function defaultHomeForRole(role: AppRole): string
```

**默认首页（已确认）**：

| 角色 | 登录后跳转 |
|------|------------|
| `admin` | `/dashboard` |
| `member` | `/dashboard/global` |
| `user` | `/crm/workbench` |

**越权访问**：middleware 重定向至 `defaultHomeForRole(role)` 或 `/403` 页。

### 4.2 tRPC Procedure 规划

在 `trpc.ts` 新增/调整：

| Procedure | 条件 | 用途 |
|-----------|------|------|
| `publicProcedure` | 无 | 健康检查 |
| `protectedProcedure` | 已登录 + 未 banned + 非 mustChangePassword | 改密、会话等 |
| `adminProcedure` | `role === 'admin'` | 员工、财务、全局配置、admin 专属 mutate |
| `supplyProcedure` | `admin` \| `member` | 供应链读 **与写** |
| `crmScopedProcedure` | `admin` \| `user`；注入 `ctx.crmScope` | CRM 读（admin 全量，user 过滤） |
| `crmWriteProcedure` | `admin` \| `user`；user 写前 `assertInScope` | CRM 业务写（客户/项目等，范围内） |
| `sharedReadProcedure` | 任意已登录角色 | 接入看板、租户黑名单列表、设备流转 |

**`adminProcedure` 修正**（必须）：

```ts
// 现网：role === 'user' 拒绝 → 会放行 member，与需求矛盾
// 目标：仅 role === 'admin'
if (ctx.user.role !== 'admin') throw FORBIDDEN
```

**`crmWriteProcedure` 示意**：

```ts
// admin → 直接放行
// user → resolveCrmDataScope + assertCustomerInScope / assertProjectInScope
// member → FORBIDDEN
```

### 4.3 写操作策略（已确认）

| 域 | admin | member | user |
|----|-------|--------|------|
| 供应链 mutate | ✓ | ✓ | ✗ |
| CRM mutate（客户/项目/活动等） | ✓ | ✗ | ✓（**范围内**，经 `crmWriteProcedure`） |
| CRM 导入 / 同步 / 合并 / 全局配置 | ✓ | ✗ | ✗ |
| 租户黑名单 list | ✓ | ✓ | ✓ |
| 租户黑名单 sync | ✓ | ✗ | ✗ |
| 员工 `user_staff` CUD | ✓ | ✗ | ✗ |
| 财务全部 | ✓ | ✗ | ✗ |

说明：

- `member` 对供应链写操作与 `admin` 同等（沿用现网挂在 `adminProcedure` 上的 supplier mutate，改挂 `supplyProcedure`）。
- `user` 可编辑范围内客户/项目及关联子资源（活动、阶段等），但员工管理、平台导入、账单同步、客户合并等 **admin 专属** 操作仍走 `adminProcedure`。
- 租户黑名单 **sync** 仅 `admin`；`user` / `member` 可查看列表，不可触发同步。

### 4.4 路由 → Procedure 映射（摘要）

| Router | 读 | 写 |
|--------|----|----|
| `supplier.*` | `supplyProcedure` | `supplyProcedure` |
| `crm.customers/projects/tenants/dashboard/...` | `crmScopedProcedure` | 业务写 → `crmWriteProcedure`；admin 专属 → `adminProcedure` |
| `crm.tenantBlacklist.list` | `sharedReadProcedure` | — |
| `crm.tenantBlacklist.sync` | — | `adminProcedure` |
| `crm.staff.*` | `adminProcedure` | `adminProcedure` |
| `finance.*` | `adminProcedure` | `adminProcedure` |
| `dashboard.globalOps.*` | `sharedReadProcedure` | — |
| `dashboard.globalSearch` | `sharedReadProcedure` | — |
| `dashboard.flow.*`（若有） | `sharedReadProcedure` | 按业务定 |

---

## 5. DataAccess 改造要点

新增 `apps/web/src/lib/server/auth/crm-data-scope.ts`：

```ts
export async function resolveCrmDataScope(user: AuthUser): Promise<CrmDataScope>
export async function loadAmCustomerIds(staffId: string): Promise<string[]>
export async function loadStaffProjectIds(staffId: string): Promise<string[]>
export async function loadVisibleProjectIds(staffId: string): Promise<string[]>
export async function loadVisibleCustomerIds(staffId: string): Promise<string[]>
export async function loadVisibleTenantIds(staffId: string): Promise<string[]>
export function buildProjectIdFilter(scope: CrmDataScope): SQL | undefined
export function buildCustomerIdFilter(scope: CrmDataScope): SQL | undefined
export function buildTenantIdFilter(scope: CrmDataScope): SQL | undefined
export async function assertProjectInScope(scope: CrmDataScope, projectId: string): Promise<void>
export async function assertCustomerInScope(scope: CrmDataScope, customerId: string): Promise<void>
export async function assertTenantInScope(scope: CrmDataScope, tenantId: string): Promise<void>
```

### 5.1 需注入 scope 的 CRM 模块

| 模块 | 文件 | 过滤键 |
|------|------|--------|
| 客户 | `dataaccess/crm/customers.ts` | `customer.id IN visibleCustomerIds` |
| 项目 | `dataaccess/crm/projects.ts` | `crm_project.id IN visibleProjectIds` |
| 计费租户 | `dataaccess/crm/billing-tenants.ts` | `billing_tenant.id IN visibleTenantIds`（**仅 project_tenant 绑定**） |
| 工作台 | `dataaccess/crm/dashboard.ts` | 聚合前限制 customer/project/tenant 集合 |
| 合同 / 账单 / 充值 / 消费 | 各 `dataaccess/crm/*.ts` | 经 `project_id` / `customer_id` 继承 |
| 项目活动 / 跟进 | `project-activities.ts` 等 | `project_id` |
| 全局搜索 | `global-search` 中 CRM 部分 | 按 scope 过滤（供应链/财务段对 user 隐藏） |

`crmScopedProcedure` / `crmWriteProcedure` middleware 在 context 注入 `crmScope`；读接口传入 data access，写接口 mutate 前调用 `assert*InScope`。

### 5.2 性能

- 同一请求内缓存 `amCustomerIds` / `staffProjectIds` / `visibleProjectIds` / `visibleCustomerIds` / `visibleTenantIds`（tRPC middleware ctx）
- `account_manager_assignment(user_staff_id)`、`project_staff_assignment(user_staff_id, effective_to)` 已有索引，范围查询可接受
- 列表空 `IN ()` 时直接短路返回 `[]`

---

## 6. 前端改造要点

### 6.1 侧栏 `AppSidebar`

- Layout 服务端读取 `session.user.role`，传入 `AppSidebar`
- 将静态 `data` 拆为 `lib/navigation/menu-config.ts`，每项标注 `roles: AppRole[]`
- 按角色 filter 后渲染；无权限的分组标题一并隐藏

### 6.2 页面级保护（可选双保险）

在 `(protected)/crm/layout.tsx`、`supplier/layout.tsx`、`finance/layout.tsx` 服务端校验角色，与 middleware 一致。

### 6.3 按钮级 UI

| 角色 | 显示 | 隐藏 |
|------|------|------|
| `admin` | 全部操作 | — |
| `member` | 供应链全部写操作 | CRM / 财务 / 员工 / 黑名单 sync |
| `user` | 范围内客户/项目/租户编辑 | 供应链 / 财务 / 员工 / 导入同步 / 黑名单 sync |

员工页、财务页对非 admin 不渲染路由（含直达 URL）。

---

## 7. 文件变更清单

### 7.1 新增

| 路径 | 说明 |
|------|------|
| `lib/auth/route-access.ts` | 路由前缀与 `canAccessPath` |
| `lib/auth/app-role.ts` | `AppRole` 类型与校验 |
| `lib/navigation/menu-config.ts` | 侧栏配置 + 角色标注 |
| `lib/server/auth/crm-data-scope.ts` | CRM 数据范围解析与 SQL 构建 |
| `app/[locale]/(protected)/forbidden/page.tsx` | 403 友好页（可选） |

### 7.2 修改

| 路径 | 变更 |
|------|------|
| `lib/server/routers/trpc.ts` | 新增 `supplyProcedure` / `crmScopedProcedure` / `crmWriteProcedure` / `sharedReadProcedure`；修正 `adminProcedure` |
| `lib/server/routers/crm/index.ts` | 读 → `crmScopedProcedure` / `sharedReadProcedure`；写 → `crmWriteProcedure` 或 `adminProcedure` |
| `lib/server/routers/supplier/index.ts` | 读/写 → `supplyProcedure`（原 `adminProcedure` mutate 改挂） |
| `lib/server/routers/finance/index.ts` | 全部改 `adminProcedure` |
| `lib/server/routers/web/dashboard.ts` | `globalOps` 改 `sharedReadProcedure` |
| `lib/server/dataaccess/crm/*.ts` | 关键 list/get 增加 `scope`；写前 scope 校验 |
| `components/app-sidebar.tsx` | 按角色过滤菜单 |
| `app/[locale]/(protected)/layout.tsx` | 向侧栏传递 `role` |
| `proxy.ts` | 角色路由门禁 + 默认首页 |
| `lib/crm/staff-constants.ts` | `resolveUserRoleFromStaffRoles` 支持 `member` |

### 7.3 不在本期

- 独立权限表 / Casbin
- 组织插件 `member.role` 与 CRM 角色统一

---

## 8. 实施阶段

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P1** | `route-access` + `proxy.ts` 路由门禁 + 侧栏过滤 + 默认首页 | 0.5–1d |
| **P2** | tRPC procedure 重构（admin/supply/crmScoped/crmWrite/shared） | 1–1.5d |
| **P3** | `crm-data-scope` + customers/projects/tenants/dashboard 过滤 | 1.5–2d |
| **P4** | 关联 CRM 子模块继承过滤 + scope 写校验 + 财务/员工 API 收紧 | 1–1.5d |
| **P5** | 前端按钮按角色显示 + 角色映射修复 + 联调测试 | 1d |

建议顺序：**P2 → P3 → P1 → P4 → P5**（先保证 API 安全，再补 UI）。

---

## 9. 测试要点

| # | 场景 | 期望 |
|---|------|------|
| 1 | `member` 登录 | 只见供应链 + 设备流转 + 接入看板 + 黑名单 + 公共；默认进 `/dashboard/global` |
| 2 | `member` 访问 `/crm/customers` | 重定向或 403 |
| 3 | `member` 调用 `crm.customers.list` | 403 |
| 4 | `member` 执行 supplier 写操作（如更新机房） | 成功 |
| 5 | `user` 登录 | 只见 CRM + 设备流转 + 接入看板 + 黑名单 + 公共；默认进 `/crm/workbench` |
| 6 | `user` 无 `user_staff` 绑定 | CRM API 403 |
| 7 | `user` 为客户 C 的客户级 AM | 可见 C 下**全部**项目及 C 本身 |
| 8 | `user` 仅为项目 A 的项目级 AM（非 C 的客户级 AM） | 可见 A 与 A 所属客户；**不可见** C 下其他项目 |
| 9 | `user` 仅为项目 B 的售前/交付/项目经理（非 AM） | 可见 B 与 B 所属客户；**不可见**该客户下其他项目 |
| 10 | `user` 同时为 C 的客户级 AM、D 的项目 AM、E 的项目交付 | 可见集合为三路并集 |
| 11 | `user` 项目无 `project_tenant` 绑定 | 租户列表**不**出现该客户默认租户 |
| 12 | `user` 在范围内编辑客户/项目 | 成功 |
| 13 | `user` 编辑范围外客户/项目 | 404/403 |
| 14 | `user` / `member` 黑名单 list | 200；`sync` → 403 |
| 15 | 全角色访问 `/dashboard/flow` | 200 |
| 16 | `user` / `member` 访问 `/finance` | 重定向或 403 |
| 17 | `admin` 登录 | 默认 `/dashboard`；全部菜单与全量数据 |
| 18 | 直达 URL 绕过侧栏 | middleware / API 均拦截 |
| 19 | 开通 `member` 角色账号 | `users.role = 'member'` |

---

## 10. 已确认决策

### 2026-06-09

| # | 问题 | 决策 |
|---|------|------|
| 1 | 设备流转（`/dashboard/flow`） | **全角色可见** |
| 2 | `user` 写权限 | **范围内可读写**（`crmWriteProcedure`） |
| 3 | 租户黑名单 `sync` | **仅 admin** |
| 4 | `member` 供应链写操作 | **允许写**（`supplyProcedure`） |
| 5 | 登录默认首页 | `admin` → `/dashboard`；`member` → `/dashboard/global`；`user` → `/crm/workbench` |
| 6 | 项目无租户绑定时展示默认租户 | **否**（仅 `project_tenant` 绑定） |

### 2026-06-09（修订 v1.2）

| # | 问题 | 决策 |
|---|------|------|
| 7 | `user` 数据范围（v1.2） | **客户级 AM + 项目 AM（并集）**；见 §3.4 |

### 2026-06-09（修订 v1.3）

| # | 问题 | 决策 |
|---|------|------|
| 8 | `user` 数据范围（v1.3） | 在 v1.2 基础上增加 **项目四人组任意角色**（`pre_sales` / `account_manager` / `delivery_manager` / `project_manager`）；三路并集，范围内可读写 |

---

## 11. 确认方式

- [x] 业务决策已确认（§10）
- [x] 同意按本文实施代码（2026-06-09）
