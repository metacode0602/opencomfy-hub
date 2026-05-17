# Studio 图像生成 API — 对客请求示例

本文档给出通过网关调用**平台 catalog 图像模型**时的标准请求示例。客户端使用平台签发的 Virtual Key（`Authorization: Bearer`），**不要**在请求中携带 DashScope / 火山方舟的上游 API Key。

- 设计说明：[image-generation-openai-unified-api.md](../design/image-generation-openai-unified-api.md)
- 视频侧对照（任务形态、计费流水线类似）：[studio-video-request-examples.md](./studio-video-request-examples.md)
- 上游原始 API：`qwen-image/`、`qwen-image-edit/`、`z-image/`、`qwen-wan2.7/imageedit.md`、`wan2.6/text2image.md`、`qwen-image-edit/image-translate.md`、`seedream/`
- **文档结构**：§1 通用约定 → **§2 各模型完整参数说明** → §3–§10 请求示例 → §12 错误 → §13 实现状态

---

## 1. 通用约定

### 1.1 对客路径一览

| 能力 | 方法 | 路径 | 响应形态 |
| --- | --- | --- | --- |
| 同步文生图 / 图生图 | `POST` | `/v1/images/generations` | OpenAI Images JSON（`data[].url`） |
| 同步图像编辑 | `POST` | `/v1/images/edits` | 同上（`multipart/form-data`） |
| 异步图像任务（万相 async / 仅异步模型） | `POST` | `/v1/studio/image/generations` | `job_id` + `task_status` |
| 查询异步图像任务 | `GET` | `/v1/studio/image/generations/{job_id}` | 任务状态 + `data[]` |
| 任务别名 | `GET` | `/v1/studio/image/tasks/{job_id}` | 同查询异步任务 |
| 图像翻译 | `POST` | `/v1/studio/image/translations` | `job_id` |
| 查询翻译任务 | `GET` | `/v1/studio/image/translations/{job_id}` | `image_url` + `usage` |

| 项目 | 说明 |
| --- | --- |
| 网关根地址 | `{GATEWAY}`，如 `https://gateway.example.com` |
| 鉴权 | `Authorization: Bearer {PLATFORM_API_KEY}` |
| 对客 `model` | catalog id：`{provider}/{slug}`，与控制台一致（见 §1.2） |
| 非 catalog 模型 | 仍走 Portkey 透传 `/v1/images/*`（OpenAI / Stability 等），**不在本文档范围** |

### 1.2 `model` 字段（对客 catalog id）

与 [studio-video-standard-api-and-vendor-routing.md](../design/studio-video-standard-api-and-vendor-routing.md) 一致：

```text
canonicalModelId(provider, slug) =
  slug 已含 '/' ? slug : `${provider}/${slug}`
```

| `models.provider` | `models.slug` | 对客 `model` | 推荐 API |
| --- | --- | --- | --- |
| `qwen` | `qwen-image-2.0-pro` | `qwen/qwen-image-2.0-pro` | `POST /v1/images/generations` |
| `qwen` | `z-image-turbo` | `qwen/z-image-turbo` | `POST /v1/images/generations` |
| `qwen` | `qwen-image-edit-max` | `qwen/qwen-image-edit-max` | `POST /v1/images/edits` |
| `qwen` | `wan2.6-t2i` | `qwen/wan2.6-t2i` | 同步 `generations` 或异步 `studio/image/generations` |
| `qwen` | `wan2.7-image-pro` | `qwen/wan2.7-image-pro` | `generations` / `edits` |
| `qwen` | `qwen-mt-image` | `qwen/qwen-mt-image` | **仅** `studio/image/translations` |
| `qwen` | `wan2.5-t2i-preview` 等 | `qwen/wan2.5-t2i-preview` | **仅** `studio/image/generations`（无同步） |
| `volcengine` | `doubao-seedream-*` | `volcengine/doubao-seedream-*` | `POST /v1/images/generations`（同步，见 §2.9） |

### 1.3 计费与冻结流水线（图像 + 视频统一）

网关对 catalog 图像请求执行与 Studio 视频相同的 **hold → 上游 → settle / release** 流程，冻结写入统一表 **`studio_balance_holds`**（`product=image`，`hold_kind` 区分场景）：

| 阶段 | 行为 | 失败时 |
| --- | --- | --- |
| 1. 参数校验 | `validateStudioImageRequest` | **400** `invalid_parameter`，**不冻结** |
| 2. 价格预估 | `estimateImageBilling` ← `model_price_config` | — |
| 3. 余额预检 | 可用额 = 账面余额 − **全部** `held`（含进行中的视频任务） | **402** `insufficient_balance` |
| 4. 冻结 | `createHold` → `studio_balance_holds` | 锁定预估金额 |
| 5. 上游 | DashScope 同步 HTTP 或异步 create + 轮询 | **releaseHold**，不写 `image_usage` |
| 6a. 成功 | `settleHold` 按实际张数实扣 | 写 `image_usage`，hold → `settled` |
| 6b. 失败 | `releaseHold` | hold → `released`，**用户不扣费** |

`hold_kind` 与 API 对应关系：

| API | `hold_kind` |
| --- | --- |
| `POST /v1/images/generations` | `image_sync_generation` |
| `POST /v1/images/edits` | `image_sync_edit` |
| `POST /v1/studio/image/generations` | `image_async_generation` |
| `POST /v1/studio/image/translations` | `image_translation` |

### 1.4 TypeScript 公共类型

```typescript
const GATEWAY = 'https://gateway.example.com';
const API_KEY = 'pk_your_platform_key';

/** OpenAI Images 同步 — 文生图 / 图生图 */
interface OpenAIImageGenerationsBody {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  response_format?: 'url' | 'b64_json';
  /** 图生图：单图 URL 或 data URI */
  image?: string;
  extensions?: {
    negative_prompt?: string;
    prompt_extend?: boolean;
    watermark?: boolean;
    seed?: number;
    reference_images?: string[];
    size_tier?: '1K' | '2K' | '4K';
    enable_sequential?: boolean;
    thinking_mode?: boolean;
    bbox_list?: number[][][];
    delivery?: 'sync' | 'async';
  };
}

interface OpenAIImagesResponse {
  created: number;
  data: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
  extensions?: Record<string, unknown>;
}

/** Studio 异步图像 / 翻译 — 创建 */
interface StudioImageJobCreateResponse {
  id: string;
  object: 'studio.image.generation' | 'studio.image.translation';
  model: string;
  status: 'queued';
  output: { task_id: string; task_status: string };
  request_id?: string;
}

/** Studio 异步图像 — 查询成功 */
interface StudioImageJobGetResponse {
  id: string;
  object: string;
  model: string;
  status: 'completed' | 'queued' | 'running' | 'failed';
  output: {
    task_status: string;
    data?: Array<{ url: string }>;
    image_url?: string;
    message?: string | null;
  };
  usage?: { image_count: number };
  request_id?: string;
}

/** 翻译创建请求体 */
interface StudioImageTranslationBody {
  model: 'qwen/qwen-mt-image';
  input: {
    image_url: string;
    source_lang: string;
    target_lang: string;
    ext?: {
      domain_hint?: string;
      sensitives?: string[];
      terminologies?: Array<{ src: string; tgt: string }>;
      config?: { image_segment?: boolean };
    };
  };
}
```

### 1.5 同步文生图（TypeScript）

```typescript
async function createImageGeneration(
  body: OpenAIImageGenerationsBody
): Promise<OpenAIImagesResponse> {
  const res = await fetch(`${GATEWAY}/v1/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json() as Promise<OpenAIImagesResponse>;
}
```

### 1.6 同步文生图（curl）

```bash
export GATEWAY='https://gateway.example.com'
export API_KEY='pk_your_platform_key'

curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/qwen-image-2.0-pro",
    "prompt": "水墨山水画，留白构图，远山近水",
    "n": 1,
    "size": "1024x1024",
    "response_format": "url",
    "extensions": {
      "negative_prompt": "低分辨率，模糊",
      "watermark": false,
      "prompt_extend": true
    }
  }'
```

### 1.7 使用 OpenAI 官方 SDK

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENROUTE_API_KEY!,
  baseURL: `${process.env.GATEWAY}/v1`,
});

const res = await client.images.generate({
  model: 'qwen/qwen-image-2.0-pro',
  prompt: '一只坐在窗边的橘猫，阳光柔和',
  size: '1024x1024',
  n: 1,
  // @ts-expect-error 平台 extensions
  extensions: {
    negative_prompt: '模糊',
    watermark: false,
  },
});

console.log(res.data[0]?.url);
```

### 1.8 Studio 异步任务 — 创建与轮询（TypeScript）

```typescript
async function createStudioImageJob(
  body: OpenAIImageGenerationsBody
): Promise<StudioImageJobCreateResponse> {
  const res = await fetch(`${GATEWAY}/v1/studio/image/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function getStudioImageJob(
  jobId: string
): Promise<StudioImageJobGetResponse> {
  const res = await fetch(
    `${GATEWAY}/v1/studio/image/generations/${encodeURIComponent(jobId)}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  );
  return res.json();
}

/** 简单轮询直到完成 */
async function waitStudioImageJob(jobId: string, intervalMs = 3000) {
  for (;;) {
    const job = await getStudioImageJob(jobId);
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(JSON.stringify(job));
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
```

```bash
# 创建异步任务（万相 delivery=async 或 wan2.5 仅异步模型）
curl -sS -X POST "${GATEWAY}/v1/studio/image/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.6-t2i",
    "prompt": "赛博朋克城市夜景，霓虹灯",
    "n": 1,
    "size": "1280x1280",
    "extensions": { "delivery": "async", "watermark": false }
  }'

# 查询（将 JOB_ID 替换为创建响应中的 id）
JOB_ID='job_01HZZZZZZZZZZZZZZZZZZZZZZZ'
curl -sS "${GATEWAY}/v1/studio/image/generations/${JOB_ID}" \
  -H "Authorization: Bearer ${API_KEY}"
```

---

## 2. 各模型完整参数说明

以下表格为网关 **对客请求体** 的完整字段说明。校验规则以 `apps/gateway/src/services/image/validation/` 为准；上游能力细节见各 Provider 原始文档。

**图例**：✅ 支持｜❌ 不支持｜⚠️ 网关拒绝｜— 不适用

### 2.1 OpenAI Images 公共字段（`generations` / `edits`）

适用于除 **§2.7 图像翻译**、**§2.8 仅异步万相** 外的所有同步/异步图像模型（异步路径请求体形态相同）。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | ✅ | 对客 catalog id，如 `qwen/qwen-image-2.0-pro` |
| `prompt` | string | 条件 | 文生图/组图必填；编辑模式必填；翻译 API 不使用 |
| `n` | integer | 否 | 生成张数上限，默认 `1`；实际上限见各模型表 |
| `size` | string | 否 | 像素尺寸，`宽x高` 或 `宽*高`（网关归一化为 `*` 发上游） |
| `response_format` | `"url"` \| `"b64_json"` | 否 | 默认 `url`；Seedream 同步支持两种 |
| `image` | string | 条件 | 单图 URL 或 data URI；图生图/编辑；与 `reference_images` 可并存 |
| `mask` | file (multipart) | 否 | OpenAI 像素 mask；**千问/万相 2.7/Seedream 均 ⚠️ 拒绝** |
| `extensions` | object | 否 | 平台扩展，默认 `{}`；各模型支持键见下表 |

**`extensions` 公共键**（是否生效取决于模型）：

| 键 | 类型 | 说明 |
| --- | --- | --- |
| `negative_prompt` | string | 反向提示词（千问/万相） |
| `prompt_extend` | boolean | 智能改写正向提示词（千问/Z-Image/万相 2.6） |
| `watermark` | boolean | 是否加水印；默认因模型而异 |
| `seed` | integer | 随机种子，可复现性（非确定性保证） |
| `reference_images` | string[] | 多图 URL/data URI；编辑/图生图；万相 2.7 最多 **9** 张 |
| `delivery` | `"sync"` \| `"async"` | `async` 须走 `POST /v1/studio/image/generations`；不可在 OpenAI 同步路径带此字段 |
| `size_tier` | `"1K"` \| `"2K"` \| `"4K"` | 仅万相 2.7；与顶层 `size` **互斥** |
| `enable_sequential` | boolean | 万相 2.7 组图；`n` 为张数上限（1–12） |
| `thinking_mode` | boolean | 万相 2.7 文生图非组图；默认上游 true |
| `bbox_list` | number[][][] | 万相 2.7 交互编辑；每张输入图一组 `[x1,y1,x2,y2]` |
| `color_palette` | object[] | 万相 2.7 调色板（3–10 色，非组图） |
| `sequential_image_generation` | `"auto"` \| `"disabled"` | Seedream 组图 |
| `sequential_image_generation_options` | object | Seedream；`max_images` 1–15 |
| `tools` | array | Seedream 5.0-lite；如 `[{ "type": "web_search" }]` |
| `guidance_scale` | number | Seedream 3.0-t2i；[1, 10] |
| `optimize_prompt_options` | object | Seedream；`mode`: `standard` \| `fast` |
| `output_format` | `"png"` \| `"jpeg"` | Seedream 5.0-lite |

**`edits`（multipart）额外约定**：

| 字段 | 说明 |
| --- | --- |
| `image` | 主图 file，必填 |
| `image_2` … `image_9` | 可选多图 file |
| `extensions` | JSON 字符串字段，或拆为独立 form 字段（与网关实现一致） |

---

### 2.2 `qwen/qwen-image-2.0-pro`（及同系列 `qwen-image-2.0*`）

| 项目 | 值 |
| --- | --- |
| **API** | `POST /v1/images/generations`（同步） |
| **模式** | `text2image` |
| **网关 `n`** | 1–6 |
| **上游** | DashScope `multimodal-generation/generation` |

| 字段 | 必填 | 约束 / 说明 |
| --- | --- | --- |
| `prompt` | ✅ | 建议 ≤800 字符（上游截断） |
| `n` | 否 | 1–6 |
| `size` | 否 | 总像素 \[512×512, 2048×2048\]；默认 2048×2048；推荐 16:9 `2688x1536` 等 |
| `response_format` | 否 | `url`（PNG 链接，24h 有效） |
| `extensions.negative_prompt` | 否 | ≤500 字符 |
| `extensions.prompt_extend` | 否 | 默认 true |
| `extensions.watermark` | 否 | 默认 false |
| `extensions.seed` | 否 | \[0, 2147483647\] |
| `image` / `reference_images` | — | 文生图不需要 |
| `mask` | — | ❌ |

---

### 2.3 `qwen/z-image-turbo`

| 项目 | 值 |
| --- | --- |
| **API** | `POST /v1/images/generations` |
| **模式** | `text2image` |
| **网关 `n`** | **仅 1** |

| 字段 | 必填 | 约束 / 说明 |
| --- | --- | --- |
| `prompt` | ✅ | 正向提示词 |
| `n` | 否 | 固定 1；传其他值 ⚠️ 400 |
| `size` | 否 | 见上游 `z-image-turbo.md` |
| `extensions.prompt_extend` | 否 | `true` 时响应可含 `extensions.revised_prompt`、`extensions.reasoning_content` |
| `extensions.watermark` | 否 | boolean |
| `extensions.seed` | 否 | integer |

---

### 2.4 `qwen/qwen-image-edit-max`（及 `qwen-image-edit*`）

| 项目 | 值 |
| --- | --- |
| **API** | `POST /v1/images/edits`（multipart）或 `POST /v1/images/generations`（JSON + `reference_images`） |
| **模式** | `image_edit` |
| **网关 `n`** | 1–6（与文生图系列一致） |

| 字段 | 必填 | 约束 / 说明 |
| --- | --- | --- |
| `prompt` | ✅ | 编辑指令 |
| `image` 或 `extensions.reference_images` | ✅ | 至少一种；多图融合用 URL 数组 |
| `n` | 否 | 1–6 |
| `size` | 否 | 可选输出尺寸 |
| `extensions.prompt_extend` | 否 | boolean |
| `extensions.watermark` | 否 | boolean |
| `extensions.seed` | 否 | integer |
| `mask` | — | ❌ 不支持 OpenAI mask |

---

### 2.5 `qwen/wan2.6-t2i`（及 `wan2.6-*`）

| 项目 | 值 |
| --- | --- |
| **API** | 同步：`POST /v1/images/generations`；异步：`POST /v1/studio/image/generations` 或 `extensions.delivery: "async"` |
| **模式** | `text2image` |
| **网关 `n`** | 1–4 |

| 字段 | 必填 | 约束 / 说明 |
| --- | --- | --- |
| `prompt` | ✅ | 文生图 |
| `n` | 否 | 1–4 |
| `size` | 否 | 总像素 \[1280², 1440²\]；宽高比 \[1:4, 4:1\] |
| `extensions.negative_prompt` | 否 | string |
| `extensions.prompt_extend` | 否 | boolean |
| `extensions.watermark` | 否 | boolean |
| `extensions.seed` | 否 | integer |
| `extensions.delivery` | 否 | `async` 时勿走 OpenAI 同步路径 |

---

### 2.6 `qwen/wan2.7-image-pro` / `qwen/wan2.7-image`

| 项目 | 值 |
| --- | --- |
| **API** | `generations` / `edits` / `studio/image/generations` |
| **模式** | `text2image` \| `image_edit` \| `interactive_edit` \| `sequential_image` |

| 字段 | 必填 | 约束 / 说明 |
| --- | --- | --- |
| `prompt` | 条件 | 文生图/编辑/组图必填 |
| `n` | 否 | 组图（`enable_sequential`）：1–**12**；否则 1–**4** |
| `size` | 否 | 像素 `宽x高`；与 `extensions.size_tier` **二选一** |
| `extensions.size_tier` | 否 | `1K` / `2K` / `4K`（pro 文生图可用 4K） |
| `extensions.enable_sequential` | 否 | `true` → 组图模式 |
| `extensions.thinking_mode` | 否 | 仅文生图且非组图 |
| `extensions.bbox_list` | 条件 | 交互编辑；长度 = 输入图张数；与 `mask` 互斥 |
| `extensions.reference_images` | 条件 | 编辑最多 **9** 张 |
| `extensions.color_palette` | 否 | 非组图调色板 |
| `extensions.negative_prompt` | 否 | 万相 2.7 文生图部分能力见上游 |
| `extensions.watermark` / `seed` | 否 | boolean / integer |
| `mask` | — | ⚠️ 400；用 `bbox_list` |

---

### 2.7 `qwen/qwen-mt-image`（图像翻译）

| 项目 | 值 |
| --- | --- |
| **API** | **仅** `POST /v1/studio/image/translations`、`GET .../translations/{job_id}` |
| **请求体** | **非** OpenAI Images 形态 |

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | ✅ | 固定 `qwen/qwen-mt-image` |
| `input.image_url` | string | ✅ | 公网 URL；JPG/PNG/WebP 等；15–8192px；≤100MB |
| `input.source_lang` | string | ✅ | 语种名/编码/`auto`；与 target 不同且含中或英 |
| `input.target_lang` | string | ✅ | 同上 |
| `input.ext.domain_hint` | string | 否 | **仅英文**，≤200 词 |
| `input.ext.sensitives` | string[] | 否 | 敏感词，建议 ≤50 |
| `input.ext.terminologies` | array | 否 | `{ src, tgt }[]` |
| `input.ext.config.image_segment` | boolean | 否 | `true` 跳过主体文字翻译 |

---

### 2.8 仅异步万相（`wan2.5-t2i-preview` 及更低版本）

| 项目 | 值 |
| --- | --- |
| **API** | **仅** `POST /v1/studio/image/generations` |
| **禁止** | `POST /v1/images/generations` → 400 |

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `model` | ✅ | 如 `qwen/wan2.5-t2i-preview` |
| `prompt` | ✅ | 文生图 |
| `n` | 否 | 默认 1；上限见上游（网关通用 ≤15 对 seedream 不适用） |
| `size` | 否 | 万相 2.5 像素范围见 `wan2.6/text2image.md` 低版本说明 |
| `extensions.*` | 否 | 与万相系列相同的键按上游支持情况传递 |

---

### 2.9 `volcengine/doubao-seedream-*`

| 项目 | 值 |
| --- | --- |
| **API** | `POST /v1/images/generations`（同步） |
| **上游** | LAS `POST {custom_host}/api/v1/online/images/generations` |
| **模式** | `text2image`（无图）\| `image_edit`（有 `image` / `reference_images`） |
| **网关 `n`** | 1–15；`n>1` 时默认 `sequential_image_generation=auto` |

| 字段 | 必填 | 约束 / 说明 |
| --- | --- | --- |
| `prompt` | ✅ | 文本提示 |
| `n` | 否 | 1–15；组图时映射 `sequential_image_generation_options.max_images` |
| `size` | 否 | 默认 `2048x2048`；各子模型像素/档位见 `seedream/image.md` |
| `response_format` | 否 | `url` \| `b64_json` |
| `image` | 条件 | 图生图；单 URL 或数组（最多 14 张参考图，5.0-lite/4.5/4.0） |
| `extensions.reference_images` | 条件 | 与 `image` 合并映射上游 `image` |
| `extensions.sequential_image_generation` | 否 | `auto` \| `disabled` |
| `extensions.sequential_image_generation_options.max_images` | 否 | 1–15；参考图数 + 生成数 ≤ 15 |
| `extensions.tools` | 否 | 仅 **5.0-lite**；`web_search` |
| `extensions.watermark` | 否 | boolean，默认 true |
| `extensions.seed` | 否 | 主要 **3.0-t2i** |
| `extensions.guidance_scale` | 否 | **3.0-t2i**；[1, 10] |
| `extensions.optimize_prompt_options.mode` | 否 | `standard` \| `fast` |
| `extensions.output_format` | 否 | **5.0-lite**：`png` \| `jpeg` |
| `mask` / `extensions.bbox_list` | — | ⚠️ 400 |
| `extensions.stream` | — | 流式 SSE **二期**，当前忽略 |

**常见 catalog slug 示例**：`volcengine/doubao-seedream-5.0-lite`、`volcengine/doubao-seedream-4.5`、`volcengine/doubao-seedream-3.0-t2i`（上游 `model_name` 以 `model_vendors` 为准）。

### 2.10 模型 slug 与章节对照

| 对客 `model`（示例） | 参数章节 | 推荐 API | 请求示例 |
| --- | --- | --- | --- |
| `qwen/qwen-image-2.0-pro` | §2.2 | `POST /v1/images/generations` | §3 |
| `qwen/z-image-turbo` | §2.3 | 同上 | §4 |
| `qwen/qwen-image-edit-max` | §2.4 | `edits` 或 `generations` | §5 |
| `qwen/wan2.6-t2i` | §2.5 | 同步 `generations` / 异步 Studio | §6 |
| `qwen/wan2.7-image-pro` | §2.6 | `generations` / `edits` | §7 |
| `qwen/qwen-mt-image` | §2.7 | `studio/image/translations` | §8 |
| `qwen/wan2.5-t2i-preview` | §2.8 | **仅** `studio/image/generations` | §9 |
| `volcengine/doubao-seedream-*` | §2.9 | `POST /v1/images/generations` | §10 |

---

## 3. 千问文生图 `qwen/qwen-image-2.0-pro`

> 完整参数见 **§2.2**。

**API**：`POST /v1/images/generations`（同步）  
**校验要点**：`prompt` 必填；`n` 1–6；`size` 支持 `1024x1024` 或 `1024*1024`（网关归一化）

```typescript
await createImageGeneration({
  model: 'qwen/qwen-image-2.0-pro',
  prompt: '冬日北京的都市街景，青灰瓦顶的中式商铺',
  n: 2,
  size: '1664x928',
  extensions: {
    negative_prompt: '低画质，肢体畸形',
    prompt_extend: true,
    watermark: false,
    seed: 42,
  },
});
```

```bash
curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/qwen-image-2.0-pro",
    "prompt": "冬日北京的都市街景",
    "n": 2,
    "size": "1664x928",
    "extensions": {
      "negative_prompt": "低画质",
      "prompt_extend": true,
      "watermark": false
    }
  }'
```

**成功响应示例**：

```json
{
  "created": 1710000000,
  "data": [
    { "url": "https://dashscope-result-....png?Expires=..." },
    { "url": "https://dashscope-result-....png?Expires=..." }
  ]
}
```

---

## 4. Z-Image `qwen/z-image-turbo`

> 完整参数见 **§2.3**。

**API**：`POST /v1/images/generations`  
**校验要点**：`n` 固定为 **1**；`prompt_extend=true` 时响应可能含 `extensions.revised_prompt`

```bash
curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/z-image-turbo",
    "prompt": "film grain, cinematic portrait, snow scene",
    "n": 1,
    "size": "1024x1024",
    "extensions": {
      "prompt_extend": true,
      "watermark": false
    }
  }'
```

---

## 5. 千问图像编辑 `qwen/qwen-image-edit-max`

> 完整参数见 **§2.4**。

**API**：`POST /v1/images/edits`（`multipart/form-data`）  
**校验要点**：`image` 或 `extensions.reference_images` 必填；`prompt` 必填；**不支持** OpenAI `mask` 像素图

```bash
curl -sS -X POST "${GATEWAY}/v1/images/edits" \
  -H "Authorization: Bearer ${API_KEY}" \
  -F "model=qwen/qwen-image-edit-max" \
  -F "prompt=将背景改为赛博朋克城市夜景" \
  -F "image=@./input.png" \
  -F "n=1" \
  -F 'extensions={"watermark":false,"prompt_extend":true}'
```

**多图融合**（JSON generations 路径，使用 `reference_images`）：

```bash
curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/qwen-image-edit-max",
    "prompt": "将图1中的闹钟放在图2的餐桌上",
    "extensions": {
      "reference_images": [
        "https://cdn.example.com/clock.png",
        "https://cdn.example.com/table.png"
      ]
    }
  }'
```

---

## 6. 万相 2.6 文生图 `qwen/wan2.6-t2i`

> 完整参数见 **§2.5**。

### 6.1 同步（推荐）

**API**：`POST /v1/images/generations`  
**校验**：`n` 1–4；`size` 总像素约 \[1280², 144²\] 量级（见上游文档）

```bash
curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.6-t2i",
    "prompt": "一间有着精致窗户的花店，漂亮的木质门",
    "n": 1,
    "size": "1280x1280",
    "extensions": {
      "negative_prompt": "低分辨率，模糊",
      "prompt_extend": true,
      "watermark": false
    }
  }'
```

### 6.2 异步（可选）

设置 `extensions.delivery: "async"`，或直接使用 Studio 路径（请求体与 OpenAI 形态相同）：

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/image/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.6-t2i",
    "prompt": "雪地里的红色邮筒，柔和日光",
    "n": 1,
    "size": "1280x1280",
    "extensions": { "watermark": false }
  }'
```

---

## 7. 万相 2.7 `qwen/wan2.7-image-pro`

> 完整参数见 **§2.6**。

### 7.1 文生图（含 `size_tier`）

```bash
curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.7-image-pro",
    "prompt": "一间有着精致窗户的花店",
    "n": 1,
    "extensions": {
      "size_tier": "2K",
      "thinking_mode": true,
      "watermark": false
    }
  }'
```

> `size`（像素）与 `extensions.size_tier` **二选一**，不可同时使用。

### 7.2 图像编辑（multipart）

```bash
curl -sS -X POST "${GATEWAY}/v1/images/edits" \
  -H "Authorization: Bearer ${API_KEY}" \
  -F "model=qwen/wan2.7-image-pro" \
  -F "prompt=把车身改成红色" \
  -F "image=@./car.webp" \
  -F 'extensions={"size_tier":"2K","n":1}'
```

### 7.3 交互式编辑（`bbox_list`，非 mask）

万相 2.7 **不支持** OpenAI `mask` 文件；使用 `extensions.bbox_list`（每张输入图一组 `[[x1,y1,x2,y2], ...]`）。

```bash
curl -sS -X POST "${GATEWAY}/v1/images/edits" \
  -H "Authorization: Bearer ${API_KEY}" \
  -F "model=qwen/wan2.7-image-pro" \
  -F "prompt=在框选区域放置闹钟" \
  -F "image=@./scene.webp" \
  -F 'extensions={"bbox_list":[[[989,515,1138,681]]],"size_tier":"2K","n":1}'
```

### 7.4 组图 `enable_sequential`

```bash
curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.7-image-pro",
    "prompt": "四季风景连环画，统一水彩风格",
    "n": 4,
    "extensions": {
      "enable_sequential": true,
      "watermark": false
    }
  }'
```

---

## 8. 图像翻译 `qwen/qwen-mt-image`

> 完整参数见 **§2.7**。

**API**：**仅** `POST /v1/studio/image/translations` + `GET .../translations/{job_id}`  
**禁止**：OpenAI `images/generations` / OpenAI Batch

### 8.1 创建翻译任务

```typescript
async function createImageTranslation(
  body: StudioImageTranslationBody
): Promise<StudioImageJobCreateResponse> {
  const res = await fetch(`${GATEWAY}/v1/studio/image/translations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/image/translations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/qwen-mt-image",
    "input": {
      "image_url": "https://cdn.example.com/cn-poster.webp",
      "source_lang": "zh",
      "target_lang": "en",
      "ext": {
        "domain_hint": "E-commerce product description",
        "config": { "image_segment": false }
      }
    }
  }'
```

**创建响应示例**（202）：

```json
{
  "id": "job_ulid_xxx",
  "object": "studio.image.translation",
  "model": "qwen/qwen-mt-image",
  "status": "queued",
  "output": {
    "task_id": "job_ulid_xxx",
    "task_status": "PENDING"
  },
  "request_id": "req_xxx"
}
```

### 8.2 查询翻译结果

```bash
JOB_ID='job_ulid_xxx'
curl -sS "${GATEWAY}/v1/studio/image/translations/${JOB_ID}" \
  -H "Authorization: Bearer ${API_KEY}"
```

**成功响应示例**：

```json
{
  "id": "job_ulid_xxx",
  "object": "studio.image.translation",
  "model": "qwen/qwen-mt-image",
  "status": "completed",
  "output": {
    "task_id": "job_ulid_xxx",
    "task_status": "SUCCEEDED",
    "image_url": "https://dashscope-result-....jpg?Expires=...",
    "message": null
  },
  "usage": { "image_count": 1 },
  "request_id": "req_xxx"
}
```

> 无可翻译文字时上游仍可能 `SUCCEEDED` 且计费；`output.message` 可为 `"No text detected for translation"`。

---

## 9. 仅异步万相模型（如 `wan2.5-t2i-preview`）

> 完整参数见 **§2.8**。

对 `wan2.5` 及以下版本，调用 `POST /v1/images/generations` 将返回 **400**，提示使用 Studio 路径：

```json
{
  "error": {
    "code": "invalid_parameter",
    "message": "参数校验失败",
    "details": [
      {
        "field": "model",
        "message": "该模型仅支持异步 Studio API：POST /v1/studio/image/generations"
      }
    ]
  }
}
```

**正确用法**：

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/image/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.5-t2i-preview",
    "prompt": "一只猫在草地上奔跑",
    "n": 1,
    "size": "1024x1024"
  }'
```

---

## 10. Volcengine Seedream 示例 `volcengine/doubao-seedream-*`

完整参数见 **§2.9**。以下为文生图与图生图 curl 示例。

```bash
# 文生图 + 组图
curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "volcengine/doubao-seedream-5.0-lite",
    "prompt": "赛博朋克城市夜景，霓虹与雨雾",
    "n": 3,
    "size": "2048x2048",
    "extensions": {
      "watermark": false,
      "sequential_image_generation": "auto",
      "tools": [{ "type": "web_search" }]
    }
  }'

# 图生图（reference_images）
curl -sS -X POST "${GATEWAY}/v1/images/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "volcengine/doubao-seedream-4.5",
    "prompt": "保持人物姿态，将服装改为红色礼服",
    "extensions": {
      "reference_images": ["https://cdn.example.com/portrait.png"],
      "watermark": false
    }
  }'
```

---

## 11. Provider 与路由速查

| 内部 `media_provider` | 对客 `model` 前缀 | 同步 Adapter | 异步路径 |
| --- | --- | --- | --- |
| `dashscope` | `qwen/` | `multimodal-generation/generation` | `image-generation/generation` + `tasks` |
| `volcengine` | `volcengine/` | `volcengineSeedream` → LAS `/api/v1/online/images/generations` | — |

租户需在 `model_vendors` + `vendor_credentials`（或 `system_model_route_config`）配置 `custom_host` 与上游 `model_name`。路由要求与视频类似：`*.aliyuncs.com`（DashScope）、`*.volces.com`（火山）。

---

## 12. 常见错误响应

### 12.1 参数校验失败（400，不冻结、不扣费）

```json
{
  "error": {
    "code": "invalid_parameter",
    "message": "参数校验失败",
    "details": [
      { "field": "prompt", "message": "prompt 为必填字符串" }
    ]
  }
}
```

### 12.2 余额不足（402，无 hold）

```json
{
  "error": {
    "code": "insufficient_balance",
    "message": "Insufficient balance",
    "required": "0.1200",
    "available": "0.0500"
  }
}
```

### 12.3 上游失败（已 releaseHold，不扣费）

```json
{
  "error": {
    "code": "upstream_error",
    "message": "Upstream returned no images"
  }
}
```

### 12.4 模型未配置 / 未实现

| HTTP | code | 说明 |
| --- | --- | --- |
| 404 | `model_not_found` | catalog 无此 `model` |
| 403 | `model_not_allowed` | Virtual Key 未授权该模型 |
| 501 | `not_implemented` | 未实现的 `imageProvider` 或能力 |

### 12.5 万相 mask 不支持（400）

```json
{
  "error": {
    "code": "invalid_parameter",
    "message": "参数校验失败",
    "details": [
      {
        "field": "mask",
        "message": "万相 2.7 不支持 OpenAI mask，请使用 extensions.bbox_list"
      }
    ]
  }
}
```

---

## 13. 实现状态速查（网关代码）

| 能力 | 状态 |
| --- | --- |
| 参数校验 `services/image/validation` | ✅ 已实现（通用 + 分模型要点） |
| 统一冻结 `studio_balance_holds` + 跨 video/image 余额汇总 | ✅ 已实现 |
| 同步 DashScope 文生图/编辑 | ✅ `dashscopeMultimodal` |
| 异步图像任务 + 轮询结算 | ✅ `dashscopeAsyncImage` |
| 图像翻译 create + poll + 结算 | ✅ `dashscopeTranslate` |
| `image_usage` 写入 | ✅ 成功 `settleHold` 后 |
| Volcengine Seedream 同步 | ✅ `volcengineSeedream`（`POST /v1/images/generations`，LAS `/api/v1/online/images/generations`） |
| OpenAI Batch 用于图像/翻译 | ❌ 不支持（设计明确排除） |

更多细节见 [image-generation-openai-unified-api.md](../design/image-generation-openai-unified-api.md) 与 [video-generation-unified-api.md](../design/video-generation-unified-api.md)。
