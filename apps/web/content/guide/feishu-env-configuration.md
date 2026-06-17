# 飞书集成环境变量配置指南

**文档性质**：运维 / 实施查阅手册  
**适用目录**：`apps/web/.env`  
**关联设计**：[feishu-integration-design.md](../design/feishu-integration-design.md)

本文说明飞书集成中以下四个环境变量的作用、获取方式与配置示例：

| 变量 | 用途概要 |
|------|----------|
| `FEISHU_WEBHOOK_SECRET` | Webhook URL 路径密钥 |
| `FEISHU_VERIFICATION_TOKEN` | 飞书事件订阅验签 |
| `FEISHU_APPROVAL_FORM_FIELD_ID` | 审批表单摘要 textarea 控件 ID |
| `APP_BASE_URL` | CRM 对外访问地址（生成批次详情链接） |

配置由 `loadFeishuRuntimeConfig()` 读取（`apps/web/src/lib/server/integrations/feishu/config.ts`）。

---

## 1. `FEISHU_WEBHOOK_SECRET`

### 作用

Webhook URL 的**路径密钥**，用于防止他人随意调用 CRM 的飞书回调地址。

路由：`POST /api/webhooks/feishu/{secret}`（`apps/web/src/app/api/webhooks/feishu/[secret]/route.ts`）

### 如何设置

1. 自行生成一段足够长的随机字符串（建议 32 字符以上），例如：`a8f3k9m2x7p1q5w8e4r6t0y2u5i7o9p6n8`
2. 写入 `apps/web/.env`：

```env
FEISHU_WEBHOOK_SECRET=a8f3k9m2x7p1q5w8e4r6t0y2u5i7o9p6n8
```

### 飞书开放平台配置

1. 进入应用 → **事件订阅**（或审批 / 多维表格相关订阅）
2. 请求地址填写：

```
https://<你的域名>/api/webhooks/feishu/<FEISHU_WEBHOOK_SECRET>
```

本地开发若需接收回调，需使用内网穿透（如 ngrok）：

```
https://abc123.ngrok.io/api/webhooks/feishu/a8f3k9m2x7p1q5w8e4r6t0y2u5i7o9p6n8
```

### 注意事项

- URL 路径中的 `secret` 必须与 `.env` 中配置的值**完全一致**，否则返回 `401 invalid webhook secret`
- **留空时**：路径校验会被跳过（仅适合本地调试，生产环境务必配置）
- 生产 / 预发建议**分应用**、分密钥，避免环境串扰

---

## 2. `FEISHU_VERIFICATION_TOKEN`

### 作用

校验飞书事件订阅请求的合法性，包括：

1. **URL 验证**（`url_verification` 握手）：飞书保存订阅地址时发送 Challenge
2. **正式事件推送**：校验请求 header / body 中的 `token`

若 token 不匹配，Webhook 返回 `401 invalid verification token`，飞书无法完成订阅或持续推送事件。

### 如何设置

1. 打开 [飞书开放平台](https://open.feishu.cn/) → 你的应用 → **事件订阅**
2. 在 **Verification Token** 处查看或生成 token
3. 复制到 `apps/web/.env`：

```env
FEISHU_VERIFICATION_TOKEN=你从飞书控制台复制的token
```

### 需要订阅的事件（按实际功能）

| 场景 | 典型事件类型 |
|------|--------------|
| 审批状态回写 CRM | `approval.approval_instance.updated`、`approval_instance` 等 |
| 多维表格工单入站 | `drive.file.bitable_record_changed_v1` 等 |

以飞书控制台当前可用事件名为准。

### 相关配置：`FEISHU_ENCRYPT_KEY`

若在飞书控制台启用了**加密推送**，还需同时配置：

```env
FEISHU_ENCRYPT_KEY=从飞书事件订阅页面复制的 Encrypt Key
```

CRM 会使用该密钥解密 `encrypt` 字段后再处理事件。

### 注意事项

- 必须与飞书控制台中的 **Verification Token** 完全一致
- **留空时**：验签逻辑会被跳过（`expected` 为空时直接通过），生产环境不建议
- 修改后需重启应用（`pnpm dev` 或生产进程）

---

## 3. `FEISHU_APPROVAL_FORM_FIELD_ID`

### 作用

创建飞书审批实例时，将 CRM 批次摘要写入审批表单中**某个多行文本（textarea）控件**。

实现见 `buildFeishuApprovalFormJson()`（`apps/web/src/lib/server/integrations/feishu/approval-client.ts`）：

- **已配置**：按 `id` + `type: textarea` 精确填值
- **未配置**：降级为不带 `id` 的 textarea，飞书 API 可能拒收或填错字段

### 如何获取 `field_id`

1. 在飞书管理后台打开对应审批模板（与 `FEISHU_APPROVAL_CODES` 中的 `approval_code` 对应）
2. 找到用于展示批次摘要的**多行文本**控件
3. 通过以下方式之一获取控件 ID（通常为 `widget_xxx` 格式）：
   - 调用飞书 API：`GET /approval/v4/approvals/:approval_code`，在返回的 widget 列表中查找
   - 在审批表单设计 / 导出配置中查看

### 如何设置

```env
FEISHU_APPROVAL_FORM_FIELD_ID=widget_1a2b3c4d5e6f
```

### 注意事项

- **推荐配置**：未配置时建单可能失败或摘要无法写入预期字段
- 控件类型应为 **textarea（多行文本）**
- 多个 `batch_kind` 若共用同一审批模板，通常可共用一个摘要字段；细粒度字段映射见设计文档 Phase 1.5

---

## 4. `APP_BASE_URL`

### 作用

生成 CRM 内**批次详情链接**，写入飞书工单或审批摘要，便于审批人从飞书跳回 CRM 查看批次。

典型链接格式：

```
{APP_BASE_URL}/supplier/onboarding-batches/{batchId}
```

用于审批建单、Bitable 工单出站等场景（如 `work-order-bitable-mapper.ts`）。

### 如何设置

```env
# 本地开发
APP_BASE_URL=http://localhost:3000

# 生产环境
APP_BASE_URL=https://crm.yourcompany.com
```

### 回退规则

未配置 `APP_BASE_URL` 时，会回退到 `NEXT_PUBLIC_APP_URL`。代码会自动去掉末尾 `/`。

### 注意事项

- 填写**对外可访问**的完整 URL（含 `http://` 或 `https://`）
- 本地填 `http://localhost:3000` 时，飞书内链接仅本机可打开；生产须填公网域名
- 建议与 `BETTER_AUTH_URL` 使用同一套对外域名，避免登录 / 跳转异常

---

## 完整配置示例

以下为飞书相关环境变量片段（需与 `FEISHU_APP_ID`、`FEISHU_APP_SECRET` 等一并配置）：

```env
# 飞书应用凭证（必填，否则集成不启用）
FEISHU_APP_ID=cli_xxxxxxxx
FEISHU_APP_SECRET=xxxxxxxx

# Webhook 安全
FEISHU_WEBHOOK_SECRET=your-random-secret-string-here
FEISHU_VERIFICATION_TOKEN=从飞书事件订阅页面复制
FEISHU_ENCRYPT_KEY=从飞书事件订阅页面复制（仅启用加密推送时）

# 审批建单
FEISHU_APPROVAL_FORM_FIELD_ID=widget_xxxxxxxx
FEISHU_APPROVAL_CODES={"online":"审批code1","device_retire":"审批code2","internal_occupancy":"...","order_access":"..."}
FEISHU_DEFAULT_USER_OPEN_ID=u-xxxxxxxx

# CRM 对外地址（批次详情链接）
APP_BASE_URL=https://crm.yourcompany.com
```

更多变量说明见仓库根目录 `.env.example`。

---

## 5. `FEISHU_AUTOMATION_SECRET` / `FEISHU_AUTOMATION_TOKEN`（多维表格自动化入站）

### 作用

当工单入站通道为 **多维表格自动化 HTTP**（默认，见 Settings「入站通道」）时，飞书表格自动化流程在「当前状态」变更后 POST 到 CRM：

```
{APP_BASE_URL}/api/integrations/feishu/bitable-automation/{FEISHU_AUTOMATION_SECRET}
```

与开放平台 Webhook（`/api/webhooks/feishu/{FEISHU_WEBHOOK_SECRET}`）**相互独立**。

### 如何设置

```env
FEISHU_AUTOMATION_SECRET=your-automation-secret
FEISHU_AUTOMATION_TOKEN=optional-header-token
```

- `FEISHU_AUTOMATION_SECRET` 未配置时，回退到 `FEISHU_WEBHOOK_SECRET`
- `FEISHU_AUTOMATION_TOKEN` 可选；配置后请求须带 Header `X-Feishu-Automation-Token`
- Settings 中也可配置「自动化 URL secret」与「Header Token」，**优先于环境变量**

详细契约见 [feishu-bitable-automation-inbound-design.md](../design/feishu-bitable-automation-inbound-design.md)。

---

## 配置后验证

1. 修改 `apps/web/.env` 后**重启**开发服务或生产进程
2. 在飞书开放平台保存事件订阅 URL → 应能通过 **Challenge** 验证（依赖 `FEISHU_VERIFICATION_TOKEN`）
3. 在 CRM 创建一条计划批次 → 检查飞书审批是否成功创建，摘要是否写入对应 textarea
4. 检查飞书工单 / 审批内容中是否包含可访问的 CRM 批次详情链接（依赖 `APP_BASE_URL`）

---

## 代码锚点

| 能力 | 路径 |
|------|------|
| 环境变量加载 | `apps/web/src/lib/server/integrations/feishu/config.ts` |
| Webhook 路由与验签 | `apps/web/src/app/api/webhooks/feishu/[secret]/route.ts` |
| 验签 / 解密 | `apps/web/src/lib/server/integrations/feishu/webhook-crypto.ts` |
| 审批表单 JSON 构建 | `apps/web/src/lib/server/integrations/feishu/approval-client.ts` |
| 批次链接（Bitable 工单） | `apps/web/src/lib/server/integrations/feishu/work-order-bitable-mapper.ts` |
| 自动化入站 API | `apps/web/src/app/api/integrations/feishu/bitable-automation/[secret]/route.ts` |
| 入站同步核心 | `apps/web/src/lib/server/dataaccess/integrations/feishu/sync-work-order-inbound.ts` |
