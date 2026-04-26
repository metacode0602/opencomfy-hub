## Milestone 0424 - MVP 设计文档（不含支付）

本文档基于 `apps/desktop/docs/overview.md` 的总体方向做 **MVP 裁剪**，目标是在 **不实现支付** 的前提下，跑通：
- 首页固定模板列表（3–10 个）→ 模板详情页（上传图片 + 配参）→ 调用生成 API 产出图片/视频
- 产出物可设置“价格”（仅作为元数据，不做支付拦截）并生成二维码
- 其他用户扫码访问下载页并下载产出物

---

## 1. 范围与非目标

### 1.1 本次必须实现（MVP）
- **固定模板入口**：在首页固定展示 3–10 个模板卡片，点击进入详情页
- **模板详情页**：
  - 上传图片（作为参考图/输入素材）
  - 参数表单（最小集合：prompt/negative/seed/风格/输出类型/尺寸/时长等，按模板而定）
  - 点击生成，调用生成 API，得到任务与结果（图片或视频）
- **定价与二维码**：
  - 生成成功后，允许用户为该结果设置 `price`（数值/货币单位展示即可）
  - 生成二维码，二维码指向该结果的“分享/下载页”
- **扫码下载**：
  - 其他用户扫码进入下载页，可直接下载图片/视频

### 1.2 明确不做（Non-goals）
- **支付/计费/订单**：不实现微信支付，不做“付费后下载”的拦截与对账
- **后台管理**：不做模板管理后台；模板写死在前端或本地配置
- **复杂风控/内容安全**：只预留接口与最小免责声明，不做完整鉴黄鉴暴
- **多供应商调度/容灾**：MVP 只接 1 个生成后端（或 1 组 API）

---

## 2. 产品体验与页面信息架构

### 2.1 页面与路由（建议）
- **首页**：`/index`（现有：`apps/desktop/app/index/page.tsx`）
  - 固定模板列表（3–10）
  - 每个模板卡片展示：名称、简介、示例图/视频缩略图、输出类型（图/视频）
  - 点击进入：`/templates/[templateId]`

- **模板详情**：`/templates/[templateId]`
  - 左/上：模板信息（标题、描述、示例、注意事项）
  - 中：输入区（图片上传 + 参数表单）
  - 右/下：生成区（生成按钮、进度/状态、结果预览）
  - 结果生成后：显示“设置价格 + 生成二维码 + 分享链接”

- **分享/下载页**：`/deliveries/[deliveryId]`
  - 展示：结果预览（图或视频播放器）、价格展示（仅展示）、下载按钮
  - 下载：直接拉取文件（或重定向到签名 URL）

> 说明：实际路由以项目 Next.js/桌面壳约定为准，但建议按以上拆分，避免所有逻辑堆在一个页面。

---

## 3. 核心流程（端到端）

### 3.1 生成者（创建结果 + 分享）
1. 用户进入首页 `/index`，看到固定模板列表
2. 点击模板 → 进入 `/templates/[templateId]`
3. 上传图片 + 填写参数 → 点击“生成”
4. 前端调用生成 API：
   - 若是同步返回结果：直接得到 `assetUrl`
   - 若是异步任务：返回 `jobId`，前端轮询 job 状态直到完成
5. 生成完成后前端展示结果预览
6. 用户输入 `price`（仅元数据）→ 点击“生成二维码”
7. 系统创建 `Delivery`（交付记录）→ 返回 `deliveryId` 与 `shareUrl`
8. 前端展示二维码（二维码内容为 `shareUrl`）

### 3.2 访问者（扫码下载）
1. 访问者扫码打开 `/deliveries/[deliveryId]`
2. 页面展示结果预览 + 价格信息（仅展示）
3. 点击下载 → 下载图片/视频文件

---

## 4. 模板系统（MVP 形态）

### 4.1 模板数量与存放方式
- 首页固定 3–10 个模板，**不从后台拉取**。
- 推荐将模板定义为一个本地常量或 JSON（例如 `apps/desktop/app/index/templates.ts` 一类文件），便于后续扩展到数据库/后台。

### 4.2 模板最小字段（建议）
`Template`（前端即可）
- `id`: string（路由使用）
- `name`: string
- `description`: string
- `outputType`: `"image" | "video"`
- `preview`: string（示例资源 URL 或本地静态资源）
- `schema`: 参数 schema（用于渲染表单）
- `defaults`: 默认参数

### 4.3 参数 Schema（建议约束）
MVP 只做最常用字段类型：
- `string`：prompt / negativePrompt
- `number`：seed / steps / cfg / durationSeconds
- `enum`：style / aspectRatio / resolution
- `file(image)`：上传参考图

---

## 5. 数据模型（概念级，MVP）

> 说明：支付不做，因此不需要 `Order/Payment`。但为了“扫码下载”可追踪，仍建议有 `GenerationJob/Asset/Delivery` 的最小持久化（可先用本地/轻量存储，后续再换 DB）。

### 5.1 GenerationJob
- `id`: string
- `templateId`: string
- `status`: `"queued" | "running" | "succeeded" | "failed"`
- `input`:
  - `params`: object（参数快照）
  - `imageAssetId?`: string（上传图素材）
- `output`:
  - `assetId?`: string（生成结果）
  - `errorMessage?`: string
- `createdAt` / `updatedAt`

### 5.2 Asset
- `id`: string
- `type`: `"image" | "video"`
- `url`: string（下载地址或对象存储 URL）
- `mime`: string
- `sizeBytes?`: number
- `width?` / `height?` / `durationSeconds?`
- `createdAt`

### 5.3 Delivery（分享/下载的最小单元）
- `id`: string
- `assetId`: string
- `price`: number（MVP 仅展示）
- `currency`: `"CNY"`（先固定）
- `createdBy?`: string（如后续要登录）
- `createdAt`
- `downloadCount`: number（可选）

---

## 6. API 设计（草案）

> 约束：现阶段可能已有 `apps/doc/src/app/api/*` 的示例路由。MVP 先定义清晰接口形状，便于前后端并行；具体落在哪个 app 的 API（desktop/doc/dashboard）后续实现时再定。

### 6.1 上传图片（输入素材）
- `POST /api/assets/upload`
- Request：`multipart/form-data`，字段 `file`
- Response：
  - `assetId`
  - `url`（可立即访问或后续内部使用）

### 6.2 创建生成任务
- `POST /api/generate`
- Request（JSON）：
  - `templateId`: string
  - `params`: object（与 template schema 对齐）
  - `inputImageAssetId?`: string
  - `outputType`: `"image" | "video"`（可从模板推导，也可显式传）
- Response（异步优先，便于视频生成）：
  - `jobId`: string
  - `status`: `"queued" | "running"`
  - `pollUrl`: string（例如 `/api/jobs/{jobId}`）

> 若后端只支持同步：允许直接返回 `asset`，同时 `jobId` 可省略；前端按返回结构分支处理。

### 6.3 查询任务状态（轮询）
- `GET /api/jobs/{jobId}`
- Response：
  - `jobId`
  - `status`: `"queued" | "running" | "succeeded" | "failed"`
  - `progress?`: number（0–100，可选）
  - `asset?`：
    - `assetId`
    - `type`: `"image" | "video"`
    - `url`
    - `mime`
    - `sizeBytes?` / `width?` / `height?` / `durationSeconds?`
  - `errorMessage?`

### 6.4 创建交付（设置价格 + 生成分享链接）
- `POST /api/deliveries`
- Request（JSON）：
  - `assetId`: string
  - `price`: number
  - `currency`: `"CNY"`
- Response：
  - `deliveryId`: string
  - `shareUrl`: string（例如 `/deliveries/{deliveryId}` 的绝对/相对 URL）

### 6.5 获取交付详情（下载页渲染）
- `GET /api/deliveries/{deliveryId}`
- Response：
  - `deliveryId`
  - `price`
  - `currency`
  - `asset`：同上
  - `downloadCount?`

### 6.6 下载（两种实现二选一）
- **方案 A（最简单）**：`asset.url` 可公开访问，下载页直接链接到该 URL
- **方案 B（更安全，推荐预留）**：下载页先请求一次“下载令牌/重定向”
  - `POST /api/deliveries/{deliveryId}/download`
  - Response：`{ url }`（短期有效的签名链接）

---

## 7. 状态机（MVP）

### 7.1 生成任务状态
- `queued`：已提交，排队中
- `running`：生成中
- `succeeded`：生成成功，返回 `asset`
- `failed`：生成失败，返回 `errorMessage`

### 7.2 交付状态（MVP 简化）
MVP 可以不做复杂状态，仅保证：
- 创建 `Delivery` 必须绑定一个有效 `assetId`
- `price` 可改为“创建时固定”（MVP 先不提供修改接口）

---

## 8. 二维码与分享链接规则

### 8.1 二维码内容
- 二维码内容为 `shareUrl`（例如 `https://<host>/deliveries/{deliveryId}`）
- 若桌面端是本地协议/内置 webview，仍建议使用可外部访问的 HTTP(S) URL，便于手机扫码访问

### 8.2 分享信息最小展示
- 标题：模板名称 + “生成结果”
- 描述：价格（仅展示）+ 输出类型

---

## 9. 关键 UX 细节（MVP 必要）

- **首页**：固定模板不要滚动加载，确保“点开就能玩”
- **详情页表单**：
  - 上传图限制：仅图片；大小限制（例如 10MB）与失败提示
  - 参数校验：必填项/范围校验（否则后端报错体验差）
- **生成反馈**：
  - 生成中禁用重复提交（或支持取消但 MVP 不做取消）
  - 轮询频率建议：2s/次，最多 5–10 分钟超时（按视频模板调整）
- **结果展示**：
  - 图片：可放大预览
  - 视频：可播放、可全屏
- **下载页**：
  - 明确文件格式与大小（如有）
  - 一键下载按钮 + 下载失败提示（网络/跨域/链接过期）

---

## 10. 安全与合规（仅预留）

- **免责声明（MVP 页面文案）**：
  - “生成内容仅供个人学习/娱乐，请勿用于侵权或违法用途”
- **最小输入过滤（可选）**：
  - 对 prompt 做敏感词命中提示（先本地/轻量规则即可）
- **资源可访问性**：
  - MVP 可以先公开 URL；但应在接口层预留 “签名下载链接” 的能力（见 6.6 方案 B）

---

## 11. 验收标准（Definition of Done）

### 11.1 功能验收
- 首页固定展示至少 **3 个**模板，点击可进入对应详情页
- 详情页可上传图片并填写参数，点击生成后能看到：
  - 生成中状态（至少“生成中/完成/失败”）
  - 生成成功后可预览图片/视频
- 生成成功后可设置价格并生成二维码
- 使用手机扫码二维码可打开下载页，下载页能成功下载对应图片/视频

### 11.2 稳定性验收（最低要求）
- 重复刷新页面不应丢失下载能力（`deliveryId` 可被重新加载）
- 生成失败可展示明确错误提示，并允许用户修改参数后重试

---

## 12. 后续迭代（支付前的演进路径）

- **支付接入**：
  - 在 `Delivery` 上增加 `isPaid` / `price` 强校验
  - 下载接口改为必须通过支付校验后签发下载 URL
- **模板配置化**：
  - 将 template/schema 从本地常量迁移到数据库 + 管理后台
- **对象存储与签名下载**：
  - 输出物统一入库对象存储，下载页只拿短期签名 URL
- **风控与内容安全**：
  - 输入过滤升级 + 输出审核（按成本逐步开启）
