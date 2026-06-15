# 站内信（Site Messages）设计方案

> **版本**：v1.0  
> **日期**：2026-06-15  
> **状态**：**实施中** — Phase 1 用户收件箱 + Sheet 翻页 + tRPC  
> **关联**：`site-header.tsx`（入口）、`role-menu-data-access-design.md`（登录用户上下文）

**文档性质**：共绩 CRM 登录用户站内通知收件箱；描述数据模型、API、UI 交互、链接策略与分期路线。  
**与平台 API 区分**：`integrations/api.ts` 中 `/admin/user_notice/*` 为 **算力平台运营后台** 接口，与本设计 **CRM 用户收件箱** 无关。

---

## 1. 目标与原则

### 1.1 业务目标

| # | 目标 | 说明 |
|---|------|------|
| G1 | **统一入口** | 顶部导航铃铛打开右侧 Sheet，展示当前登录用户的站内信 |
| G2 | **分页列表** | Sheet 内消息列表支持翻页，避免一次加载过多记录 |
| G3 | **详情弹窗** | 点击列表项弹出 Dialog 展示完整正文 |
| G4 | **链接分流** | 正文 Markdown 内嵌链接与底部操作按钮分别处理站内/站外跳转 |
| G5 | **已读状态** | 单条已读、全部已读；铃铛角标展示未读总数 |

### 1.2 非目标（Phase 1）

- **不** 对接算力平台 `/admin/user_notice/*`
- **不** 提供管理端「发信」UI（可由后台任务 / SQL / 二期管理页写入）
- **不** 做广播消息 + 多用户 receipt 表（Phase 2 再评估）
- **不** 做 WebSocket 实时推送（列表打开时 refetch + 角标轮询即可）

### 1.3 设计原则

1. **按用户隔离**：每条消息绑定 `user_id`，查询必带当前 session 用户。
2. **列表轻量**：分页接口只返回摘要字段；详情接口返回 `content` 与 `links`。
3. **offset 分页**：Phase 1 使用 `page` + `pageSize`；数据量增大后可改 cursor。
4. **Markdown 正文**：`content` 存 Markdown；前端复用 `SiteMessageBody` 渲染。
5. **链接 JSON**：底部 CTA 存 `links` jsonb，结构与前端 `SiteMessageLink` 一致。

---

## 2. 交互设计

### 2.1 入口与布局

```text
SiteHeader
  └── SiteMessagesPanel（铃铛 + Badge 未读数）
        ├── Sheet（side=right, sm:max-w-md）
        │     ├── Header：标题 / 未读摘要 / 「全部已读」
        │     ├── ScrollArea：消息列表（当前页）
        │     └── Footer：ListPagination
        └── Dialog：消息详情（Markdown + 链接按钮）
```

### 2.2 Sheet 列表项

| 元素 | 说明 |
|------|------|
| 未读圆点 | `read = false` 时显示 |
| 标题 | 单行截断；未读加粗 |
| 摘要 | 最多 2 行 |
| 分类 Badge | 可选，如「财务」「系统」 |
| 时间 | 相对时间（7 天内）或绝对时间 |

### 2.3 翻页

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `page` | 1 | 当前页码，从 1 开始 |
| `pageSize` | 10 | 每页条数，最大 50 |
| `readFilter` | `all` | `all` / `unread` / `read`（Phase 1 UI 仅用 `all`） |

- 切换页码时列表 ScrollArea 滚回顶部。
- 底部展示「显示 x–y 条，共 z 条」与上一页/下一页。
- 打开 Sheet 时拉取第 1 页；关闭 Sheet 不重置页码（再次打开保持上次页码）。

### 2.4 详情与已读

1. 点击列表项 → 打开 Dialog，并调用 `markRead`。
2. Dialog 展示：分类、时间、标题、摘要、正文、底部链接。
3. 「全部已读」→ 调用 `markAllRead`，刷新列表与角标。

### 2.5 链接处理

| 类型 | 判定 | 行为 |
|------|------|------|
| 站内 | `href` 以 `/` 开头且非 `//` | `LocaleLink`；点击后关闭 Sheet + Dialog 再跳转 |
| 站外 | `http(s)://`、`//`、`mailto:` | 新标签页；展示外链图标 |
| 底部 CTA | `links[]` 数组 | 与正文规则相同；`external: true` 强制站外 |

---

## 3. 数据模型

### 3.1 表：`user_site_message`

Phase 1 采用 **每用户独立消息行**（发信方写多行即可触达多人；实现简单、分页直观）。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | text | PK | cuid2 |
| `user_id` | text | FK → `users.id` ON DELETE CASCADE | 收件人 |
| `title` | varchar(200) | NOT NULL | 标题 |
| `summary` | text | NOT NULL | 列表摘要 |
| `content` | text | NOT NULL | Markdown 正文 |
| `category` | varchar(32) | 可空 | 分类标签 |
| `links` | jsonb | NOT NULL DEFAULT `[]` | `SiteMessageLink[]` |
| `read` | boolean | NOT NULL DEFAULT false | 是否已读 |
| `read_at` | timestamptz | 可空 | 已读时间 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | 创建时间 |
| `updated_at` | timestamptz | NOT NULL | 更新时间 |

**索引**：

- `(user_id, created_at DESC)` — 分页列表
- `(user_id, read)` — 未读计数

### 3.2 TypeScript 类型

```typescript
type SiteMessageLink = {
  label: string
  href: string
  external?: boolean
}

type SiteMessageListItem = {
  id: string
  title: string
  summary: string
  category: string | null
  read: boolean
  createdAt: string
}

type SiteMessageDetail = SiteMessageListItem & {
  content: string
  links: SiteMessageLink[]
  readAt: string | null
}

type SiteMessageListResult = {
  items: SiteMessageListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
```

### 3.3 Phase 2 扩展（预留）

- `site_message`（广播模板）+ `site_message_receipt`（已读回执）
- 按 `role` / `org` 定向投递
- 管理端发信 CRUD + 定时发布

---

## 4. API（tRPC）

路由命名空间：`siteMessages`（挂载于 `appRouter`，所有登录用户可访问）。

权限：`sharedReadProcedure`（须登录且已完成首次改密）。

### 4.1 `siteMessages.list`

**Input**

```typescript
{
  page?: number        // default 1, min 1
  pageSize?: number    // default 10, min 1, max 50
  readFilter?: 'all' | 'unread' | 'read'  // default 'all'
}
```

**Output**：`SiteMessageListResult`

**规则**：

- 仅查询 `user_id = ctx.user.id`
- 排序：`created_at DESC, id DESC`
- 首次无数据时写入 3 条演示消息（开发/bootstrap，便于联调 UI）

### 4.2 `siteMessages.unreadCount`

**Output**：`{ count: number }`

### 4.3 `siteMessages.getById`

**Input**：`{ id: string }`

**Output**：`SiteMessageDetail`

**规则**：消息必须属于当前用户，否则 `NOT_FOUND`。

### 4.4 `siteMessages.markRead`

**Input**：`{ id: string }`

**Output**：`{ success: true }`

**规则**：幂等；设置 `read = true`, `read_at = now()`。

### 4.5 `siteMessages.markAllRead`

**Output**：`{ updatedCount: number }`

**规则**：批量更新当前用户所有未读消息。

---

## 5. 前端实现要点

### 5.1 组件

| 组件 | 职责 |
|------|------|
| `SiteMessagesPanel` | 铃铛、Sheet、Dialog、分页状态、tRPC 调用 |
| `SiteMessageBody` | Markdown + 链接渲染（已实现） |
| `ListPagination` | 复用现有分页 UI |

### 5.2 数据流

```text
unreadCount.query()  ──► 铃铛 Badge（enabled: always）

sheetOpen = true
  └── list.query({ page, pageSize })  ──► Sheet 列表 + Pagination

click item
  ├── getById.query({ id })  ──► Dialog 详情（或使用 list 缓存 + getById）
  └── markRead.mutate({ id })  ──► invalidate list + unreadCount

markAllRead.mutate()  ──► invalidate list + unreadCount
```

### 5.3 缓存策略

- `markRead` / `markAllRead` 成功后 `utils.siteMessages.list.invalidate()` 与 `unreadCount.invalidate()`。
- Sheet 关闭时不 cancel 未读角标 query。

---

## 6. 文件与目录

```text
packages/db/src/auth-schema.ts          # user_site_message 表
packages/db/drizzle/0005_old_marvel_zombies.sql  # 迁移（含 user_site_message）

apps/web/src/lib/types/site-messages.ts
apps/web/src/lib/server/dataaccess/site-messages.ts
apps/web/src/lib/server/routers/web/site-messages.ts
apps/web/src/lib/server/routers/index.ts  # 注册 siteMessages

apps/web/src/components/site-messages/
  types.ts
  site-message-body.tsx
  site-messages-panel.tsx
  mock-messages.ts                      # 仅 seed / 文档参考，运行时走 DB
```

---

## 7. 测试计划

| # | 场景 | 预期 |
|---|------|------|
| T1 | 未登录 | tRPC 返回 UNAUTHORIZED |
| T2 | 打开 Sheet | 加载第 1 页，演示数据 ≥ 3 条 |
| T3 | 翻页 | 页码变化，列表与 footer 同步 |
| T4 | 点击消息 | Dialog 展示正文；该条变已读；角标 -1 |
| T5 | 全部已读 | 角标消失；列表项无未读样式 |
| T6 | 站内链接 | 关闭浮层并跳转 locale 路径 |
| T7 | 外链 | 新标签页打开 |
| T8 | 越权 getById | 他人消息返回 NOT_FOUND |

---

## 8. 分期路线

| 阶段 | 内容 |
|------|------|
| **Phase 1（当前）** | DB + tRPC + Sheet 翻页 + 详情 Dialog + 演示 seed |
| Phase 2 | 管理端发信、广播模型、按角色投递 |
| Phase 3 | 业务事件自动发信（账单、导入完成等） |
| Phase 4 | 实时推送 / 邮件摘要（可选） |
