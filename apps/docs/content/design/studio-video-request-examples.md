# Studio 视频生成 API — 各 Provider 请求示例

本文档给出通过网关 **`POST /v1/studio/video/generations`** 调用各视频 Provider 时的**标准请求体**示例。客户端只需使用平台签发的 Virtual Key，**不要**在请求中携带 DashScope / Vidu / 火山方舟的上游 API Key。

- 设计说明：[video-generation-unified-api.md](../design/video-generation-unified-api.md)
- 上游原始 API 文档：`happyhorse/`、`qwen-wan2.7/`、`vidu-dashscope/`、`vidu-official/`、`seedance/`
- **文档结构**：§1 通用约定 → **§2 各模型完整参数说明** → §3–§7 请求示例 → §8 路由速查 → §9 错误

---

## 1. 通用约定

| 项目 | 说明 |
| --- | --- |
| 创建任务 | `POST {GATEWAY}/v1/studio/video/generations` |
| 查询任务 | `GET {GATEWAY}/v1/studio/video/generations/{job_id}` |
| 鉴权 | `Authorization: Bearer {PLATFORM_API_KEY}` |
| 请求体 | JSON：`model` + `input` + `parameters`（可选） |
| 模式推导 | 网关根据 `input.media` 自动推导 `text2video` / `image2video` / `start_end2video` / `reference2video` / `video_edit` |

### 1.1 `model` 字段（对客 catalog id）

对客 **`model`** 与控制台展示一致，为目录 **catalog id**（见 [studio-video-standard-api-and-vendor-routing.md](../design/studio-video-standard-api-and-vendor-routing.md)）：

```text
canonicalModelId(provider, slug) =
  slug 已含 '/' ? slug : `${provider}/${slug}`
```

- `models.provider` + `models.slug` 为目录业务唯一键；`model_vendors.slug` 冗余存同一对客 id（多 Vendor 行可重复）。
- 网关 **路由** 按对客 `model` / `model_vendors.slug` 选行；**发往上游** 使用选中行的 `model_vendors.model_name`（可与对客 id 不同）。

| `models.provider` | `models.slug` | 对客 `model`（请求体） | 示例上游 `model_name`（百炼行） | 示例上游 `model_name`（官方行） |
| --- | --- | --- | --- | --- |
| `qwen` | `happyhorse-1.0-r2v` | `qwen/happyhorse-1.0-r2v` | `happyhorse-1.0-r2v` | — |
| `vidu` | `viduq3-turbo_text2video` | `vidu/viduq3-turbo_text2video` | `vidu/viduq3-turbo_text2video` | `viduq3-turbo` |
| `vidu` | `viduq3-pro` | `vidu/viduq3-pro` | — | `viduq3-pro` |
| `volcengine` | `doubao-seedance-1-5-pro-251215` | `volcengine/doubao-seedance-1-5-pro-251215` | `doubao-seedance-1-5-pro-251215` | — |

- 任务落库、`job_id` 查询、`canonical_model` 均使用客户端提交的 **对客 catalog id**。
- **兼容**：`request_model_aliases` 或按 `model_vendors.model_name` 匹配的旧字符串仍可解析到同一 catalog；新接入请统一使用上表 **对客 `model` 列**。

### 1.2 TypeScript 公共类型

```typescript
const GATEWAY = 'https://gateway.example.com';
const API_KEY = 'pk_your_platform_key';

type StudioVideoMediaType =
  | 'image'
  | 'first_frame'
  | 'last_frame'
  | 'video'
  | 'reference_image';

interface StudioVideoMedia {
  type: StudioVideoMediaType;
  url: string;
  role?: string;
}

interface StudioVideoCreateBody {
  model: string;
  input: {
    prompt?: string;
    negative_prompt?: string;
    audio_url?: string;
    media?: StudioVideoMedia[];
    /** Vidu 官方参考生：主体库结构，见 vidu-official/ref2video.md */
    subjects?: Array<{
      id: string;
      images?: string[];
      videos?: string[];
    }>;
  };
  parameters?: Record<string, unknown>;
}

interface StudioVideoCreateResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: string;
  };
}
```

### 1.3 创建任务（TypeScript）

```typescript
async function createStudioVideoTask(
  body: StudioVideoCreateBody
): Promise<StudioVideoCreateResponse> {
  const res = await fetch(`${GATEWAY}/v1/studio/video/generations`, {
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
  return res.json() as Promise<StudioVideoCreateResponse>;
}
```

### 1.4 创建任务（curl）

```bash
export GATEWAY='https://gateway.example.com'
export API_KEY='pk_your_platform_key'

curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d @- <<'EOF'
{
  "model": "REPLACE_MODEL",
  "input": { "prompt": "REPLACE_PROMPT" },
  "parameters": { "duration": 5 }
}
EOF
```

### 1.5 查询任务（TypeScript / curl）

```typescript
async function getStudioVideoTask(jobId: string) {
  const res = await fetch(
    `${GATEWAY}/v1/studio/video/generations/${encodeURIComponent(jobId)}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  );
  return res.json();
}
```

```bash
JOB_ID='job_01HZZZZZZZZZZZZZZZZZZZZZZZ'
curl -sS "${GATEWAY}/v1/studio/video/generations/${JOB_ID}" \
  -H "Authorization: Bearer ${API_KEY}"
```

---

## 2. 各模型完整参数说明

网关对客统一为 `POST /v1/studio/video/generations` 的 JSON：`model` + `input` + `parameters`。模式由 `input.media` **自动推导**（`deriveStudioVideoMode`）。校验以 `apps/gateway/src/services/video/validation/` 为准。

**图例**：✅ 必填｜— 不适用｜⚠️ 网关 400

### 2.1 公共字段（全 Provider）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `model` | string | ✅ 对客 catalog id |
| `input` | object | ✅ |
| `input.prompt` | string | 多数模式必填；Vidu 部分图生视频可选 |
| `input.negative_prompt` | string | 否；Wan 2.7 文生视频等 |
| `input.audio_url` | string | 否；Seedance / Wan 多模态等（见各模型） |
| `input.media` | array | 图/视频/首尾帧/参考图；`type` + `url`（+ 可选 `role`） |
| `input.subjects` | array | Vidu 官方参考生；`{ id, images?, videos? }` |
| `parameters` | object | 否；分辨率、时长、种子等 |

**`input.media[].type` 与推导模式**：

| `type` | 含义 |
| --- | --- |
| `image` | 单图图生视频，或首尾帧之一 |
| `first_frame` | 首帧（HappyHorse / Wan / Seedance） |
| `last_frame` | 尾帧 |
| `video` | 源视频（编辑/参考） |
| `reference_image` | 参考图（HappyHorse R2V、Seedance 多模态） |

| 推导 `mode` | 典型 `media` 组合 |
| --- | --- |
| `text2video` | 无 `media` |
| `image2video` | 1×`image` 或 1×`first_frame` |
| `start_end2video` | 2×`image` 或 `first_frame`+`last_frame` |
| `reference2video` | 多图/多视频参考 |
| `video_edit` | 1×`video` + 可选参考图 |

---

### 2.2 HappyHorse（`qwen/happyhorse-1.0-*`）

上游：`video-synthesis`（DashScope）。对客 `model` 去 `qwen/` 前缀后上游仍为 `happyhorse-1.0-*`。

#### 2.2.1 `qwen/happyhorse-1.0-t2v` — 文生视频

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `input.prompt` | ✅ | string |
| `input.media` | — | 必须为空 |
| `parameters.resolution` | 否 | `720P` \| `1080P` |
| `parameters.ratio` | 否 | `16:9` \| `9:16` \| `1:1` \| `4:3` \| `3:4` |
| `parameters.duration` | 否 | 整数 **3–15**（秒） |
| `parameters.watermark` | 否 | boolean |
| `parameters.seed` | 否 | integer |

#### 2.2.2 `qwen/happyhorse-1.0-i2v` — 图生视频（首帧）

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `input.prompt` | 否 | 若提供须为 string |
| `input.media` | ✅ | **恰好 1** 个 `type=first_frame` |
| `parameters.resolution` | 否 | `720P` \| `1080P` |
| `parameters.duration` | 否 | **3–15** |
| `parameters.watermark` / `seed` | 否 | boolean / integer |

#### 2.2.3 `qwen/happyhorse-1.0-r2v` — 参考生视频

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `input.prompt` | ✅ | 用 `[Image n]` 指代参考图 |
| `input.media` | ✅ | **1–9** 个 `type=reference_image` |
| `parameters.resolution` | 否 | `720P` \| `1080P` |
| `parameters.ratio` | 否 | 同 t2v |
| `parameters.duration` | 否 | **3–15** |
| `parameters.watermark` / `seed` | 否 | |

#### 2.2.4 `qwen/happyhorse-1.0-video-edit` — 视频编辑

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `input.prompt` | ✅ | 编辑指令 |
| `input.media` | ✅ | **1** 个 `video` + 0–5 个 `reference_image` |
| `parameters.resolution` | 否 | `720P` \| `1080P` |
| `parameters.duration` | 否 | 秒数（见上游；网关不强制上下限） |
| `parameters.audio_setting` | 否 | `auto` \| `origin` |
| `parameters.watermark` / `seed` | 否 | |

---

### 2.3 Wan 2.7（`qwen/wan2.7-*`）

slug 示例：`qwen/wan2.7-t2v-2026-04-25`、`wan2.7-i2v-*`、`wan2.7-r2v-*`、`wan2.7-video-edit-*`。

#### 2.3.1 文生视频 `wan2.7-t2v`

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `input.prompt` | ✅ | |
| `input.negative_prompt` | 否 | string |
| `input.media` | — | 必须为空 |
| `parameters.resolution` | 否 | `720P` \| `1080P` |
| `parameters.ratio` | 否 | `16:9` \| `9:16` \| `1:1` \| `4:3` \| `3:4` |
| `parameters.duration` | 否 | **2–15** |
| `parameters.prompt_extend` | 否 | boolean |
| `parameters.watermark` / `seed` | 否 | |

#### 2.3.2 图生视频 `wan2.7-i2v`

| 字段 | 必填 | 约束 |
| --- | --- | --- |
| `input.media` | ✅ | 1×`first_frame` 或 1×`image`；可选 `driving_audio` 等（见上游） |
| `input.prompt` | 否 | 建议提供 |
| `parameters.resolution` | 否 | `720P` \| `1080P` |
| `parameters.duration` | 否 | **2–15** |
| `parameters.prompt_extend` | 否 | |

#### 2.3.3 首尾帧 / 参考生 / 视频续写 / 编辑

| 对客 slug 特征 | `media` 要点 | `parameters` |
| --- | --- | --- |
| `*-i2v` 首尾帧 | `first_frame` + `last_frame` 各 1 | `duration` 2–15；`prompt` 建议填写 |
| `*-r2v` | `video` / `image` 组合 | `ratio`、`resolution`、`duration` 2–15 |
| `*-video-edit` | 1×`video` + 可选 `image` | `resolution`、`duration` |

---

### 2.4 Vidu 百炼托管（`qwen/vidu/*`）

对客 `model` 含能力后缀，如 `qwen/vidu/viduq3-turbo_text2video`。网关**原样**转发 `video-synthesis`。

#### 2.4.1 文生视频 `*_text2video`

| 字段 | 约束 |
| --- | --- |
| `input.prompt` | ✅ |
| `input.media` | 必须为空 |
| `parameters.resolution` | `540P` \| `720P` \| `1080P` |
| `parameters.size` | 可选，`宽*高` 字符串 |
| `parameters.duration` | **1–16**（`viduq2_text2video` 上限 **10**） |
| `parameters.audio` | 仅 `viduq3-pro_text2video`、`viduq3-turbo_text2video` |
| `parameters.watermark` / `seed` | 可选 |

#### 2.4.2 图生视频 `*_img2video`

| 字段 | 约束 |
| --- | --- |
| `input.media` | **1** 个 `type=image` |
| `input.prompt` | 可选 string |
| `parameters.duration` | 1–16（q3）或 1–10 |
| `parameters.audio` | 仅 `viduq3-pro_img2video`、`viduq3-turbo_img2video` |

#### 2.4.3 首尾帧 `*_start-end2video`

| 字段 | 约束 |
| --- | --- |
| `input.prompt` | ✅ |
| `input.media` | **2** 个 `type=image`（首帧、尾帧顺序） |
| `parameters.resolution` | 可选 |
| `parameters.duration` | 1–16 / 1–10 |

#### 2.4.4 参考生 `*_reference2video`

| 字段 | 约束 |
| --- | --- |
| `input.prompt` | ✅；可用 `@1` 指代 |
| `input.media` | 1–7×`image`；`viduq2-pro_reference2video` 可 1–4 图 + 0–2 视频 |
| `parameters.size` | 可选 |
| `parameters.duration` | 0–16（q3 mix/ref） |
| `parameters.audio` | `viduq3-mix` / `viduq3_reference2video` / `viduq3-turbo_reference2video` |

---

### 2.5 Vidu 官方（`vidu/*`，`api.vidu.cn`）

`parameters.resolution` 使用 **小写**：`540p` \| `720p` \| `1080p`；`parameters.ratio` 映射上游 `aspect_ratio`。

#### 2.5.1 文生视频（如 `vidu/viduq3-pro`）

| 字段 | 约束 |
| --- | --- |
| `input.prompt` | ✅ |
| `parameters.ratio` | `16:9` \| `9:16` \| `3:4` \| `4:3` \| `1:1` |
| `parameters.duration` | q3：**1–16**；q2：**1–10**；更老：**1–5** |
| `parameters.audio` | boolean |
| `parameters.bgm` | boolean（文生） |
| `parameters.off_peak` | boolean（错峰） |
| `parameters.style` | 上游风格（示例 `general`） |
| `parameters.watermark` / `seed` | 可选 |

#### 2.5.2 图生 / 首尾帧

| 模式 | `media` | 备注 |
| --- | --- | --- |
| 图生 | 1×`image` 或 `first_frame` | `prompt` 可选 |
| 首尾帧 | 2×`image` | `duration` 1–16 |

#### 2.5.3 参考生（如 `vidu/viduq3`）

| 字段 | 约束 |
| --- | --- |
| `input.prompt` | ✅ |
| `input.subjects` | 官方主体库 **或** `input.media` 多图 |
| `parameters.audio` | boolean |
| `parameters.audio_type` | 如 `all`（见 `vidu-official/ref2video.md`） |
| `parameters.ratio` / `resolution` / `duration` | 同上 |

---

### 2.6 Seedance / 方舟（`volcengine/doubao-seedance-*`）

| 字段 | 约束 |
| --- | --- |
| `parameters.resolution` | `480p` \| `720p` \| `1080p` |
| `parameters.duration` | **2–15** |
| `parameters.ratio` | string（如 `16:9`、`adaptive`） |
| `parameters.generate_audio` | boolean；与 `parameters.audio` 二选一映射上游 |
| `parameters.camera_fixed` | boolean（部分模型） |
| `parameters.watermark` / `seed` | 可选 |

| 模式 | `input` 要点 |
| --- | --- |
| 文生 | `prompt` ✅；无 `media` |
| 图生 | 1×`first_frame` 或 `image` |
| 首尾帧 | `first_frame` + `last_frame` 或 2×`image` |
| 多模态参考 | ≥1 `reference_image` / `video` / `audio_url` |

---

### 2.7 未单独列出的 catalog 模型

若 `model` 未命中 §2.2–§2.6 规则，网关走 **通用 DashScope** 校验：`input` 必填、`parameters.duration` **1–60**、媒体 URL 合法即可。新模型接入时请补充本节表格。

### 2.8 模型 slug 与章节对照

| 对客 `model`（示例） | 参数章节 | 推导模式 | 请求示例 |
| --- | --- | --- | --- |
| `qwen/happyhorse-1.0-t2v` | §2.2.1 | `text2video` | §3.1 |
| `qwen/happyhorse-1.0-i2v` | §2.2.2 | `image2video` | §3.2 |
| `qwen/happyhorse-1.0-r2v` | §2.2.3 | `reference2video` | §3.3 |
| `qwen/happyhorse-1.0-video-edit` | §2.2.4 | `video_edit` | §3.4 |
| `qwen/wan2.7-t2v-*` | §2.3.1 | `text2video` | §4.1 |
| `qwen/wan2.7-i2v-*` | §2.3.2 | `image2video` | §4.2 |
| `qwen/wan2.7-r2v-*` | §2.3.3 | `reference2video` | §4.3 |
| `qwen/wan2.7-video-edit-*` | §2.3.3 | `video_edit` | §4.4 |
| `qwen/vidu/viduq3-turbo_text2video` | §2.4.1 | `text2video` | §5.1 |
| `qwen/vidu/viduq3-pro_img2video` | §2.4.2 | `image2video` | §5.2 |
| `qwen/vidu/viduq3-turbo_start-end2video` | §2.4.3 | `start_end2video` | §5.3 |
| `qwen/vidu/viduq3-mix_reference2video` | §2.4.4 | `reference2video` | §5.4 |
| `vidu/viduq3-pro` | §2.5.1 | `text2video` | §6.1 |
| `vidu/viduq3-turbo` | §2.5.2 | `image2video` | §6.2 |
| `vidu/viduq3` | §2.5.3 | `reference2video` | §6.4 |
| `volcengine/doubao-seedance-*` | §2.6 | 多模式 | §7 |

---

## 3. DashScope — HappyHorse

> 完整参数见 **§2.2**。

`video_provider`: **dashscope**  
上游：`POST {custom_host}/services/aigc/video-generation/video-synthesis`  
对客 `model`：`qwen/happyhorse-1.0-t2v` | `qwen/happyhorse-1.0-i2v` | `qwen/happyhorse-1.0-r2v` | `qwen/happyhorse-1.0-video-edit`（上游仍为 `happyhorse-1.0-*`）

### 2.1 文生视频 `happyhorse-1.0-t2v`

**推导模式**：`text2video`（无 `input.media`）

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/happyhorse-1.0-t2v',
  input: {
    prompt:
      '一座由硬纸板和瓶盖搭建的微型城市，在夜晚焕发出生机。一列硬纸板火车缓缓驶过。',
  },
  parameters: {
    resolution: '720P',
    ratio: '16:9',
    duration: 5,
    watermark: false,
    seed: 42,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/happyhorse-1.0-t2v",
    "input": {
      "prompt": "一座由硬纸板和瓶盖搭建的微型城市，在夜晚焕发出生机。"
    },
    "parameters": {
      "resolution": "720P",
      "ratio": "16:9",
      "duration": 5,
      "watermark": false,
      "seed": 42
    }
  }'
```

### 2.2 图生视频（首帧）`happyhorse-1.0-i2v`

**推导模式**：`image2video`（`media` 含 1×`first_frame`）

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/happyhorse-1.0-i2v',
  input: {
    prompt: '一只猫在草地上奔跑',
    media: [
      {
        type: 'first_frame',
        url: 'https://cdn.example.com/cat-first-frame.png',
      },
    ],
  },
  parameters: {
    resolution: '720P',
    duration: 5,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/happyhorse-1.0-i2v",
    "input": {
      "prompt": "一只猫在草地上奔跑",
      "media": [
        {
          "type": "first_frame",
          "url": "https://cdn.example.com/cat-first-frame.png"
        }
      ]
    },
    "parameters": {
      "resolution": "720P",
      "duration": 5
    }
  }'
```

### 2.3 参考生视频 `happyhorse-1.0-r2v`

**推导模式**：`reference2video`（`media` 含 1~9×`reference_image`，`prompt` 必填）

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/happyhorse-1.0-r2v',
  input: {
    prompt:
      '[Image 1]中身着红色旗袍的女性，与[Image 2]中的折扇、耳坠同框，电影感镜头。',
    media: [
      {
        type: 'reference_image',
        url: 'https://cdn.example.com/ref-1.png',
      },
      {
        type: 'reference_image',
        url: 'https://cdn.example.com/ref-2.png',
      },
    ],
  },
  parameters: {
    ratio: '16:9',
    duration: 5,
    resolution: '720P',
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/happyhorse-1.0-r2v",
    "input": {
      "prompt": "[Image 1]与[Image 2]同框，电影感镜头",
      "media": [
        { "type": "reference_image", "url": "https://cdn.example.com/ref-1.png" },
        { "type": "reference_image", "url": "https://cdn.example.com/ref-2.png" }
      ]
    },
    "parameters": {
      "ratio": "16:9",
      "duration": 5,
      "resolution": "720P"
    }
  }'
```

### 2.4 视频编辑 `happyhorse-1.0-video-edit`

**推导模式**：`video_edit`（`media` 含 `video`，可选 `reference_image`）

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/happyhorse-1.0-video-edit',
  input: {
    prompt: '让视频中的角色穿上图片中的条纹毛衣',
    media: [
      {
        type: 'video',
        url: 'https://cdn.example.com/source.mp4',
      },
      {
        type: 'reference_image',
        url: 'https://cdn.example.com/sweater.png',
      },
    ],
  },
  parameters: {
    duration: 10,
    audio_setting: 'auto',
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/happyhorse-1.0-video-edit",
    "input": {
      "prompt": "让视频中的角色穿上图片中的条纹毛衣",
      "media": [
        { "type": "video", "url": "https://cdn.example.com/source.mp4" },
        { "type": "reference_image", "url": "https://cdn.example.com/sweater.png" }
      ]
    },
    "parameters": {
      "duration": 10,
      "audio_setting": "auto"
    }
  }'
```

---

## 4. DashScope — Wan 2.7

> 完整参数见 **§2.3**。

`video_provider`: **dashscope**  
对客 `model` 前缀：`qwen/wan2.7*`（如 `qwen/wan2.7-t2v-2026-04-25`）；上游仍为 `wan2.7-*`  
上游与 HappyHorse 相同（`video-synthesis`）。

### 3.1 文生视频

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/wan2.7-t2v-2026-04-25',
  input: {
    prompt: '一只小猫在月光下奔跑',
    negative_prompt: '花朵',
  },
  parameters: {
    resolution: '720P',
    ratio: '16:9',
    duration: 10,
    prompt_extend: true,
    watermark: false,
    seed: 12345,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.7-t2v-2026-04-25",
    "input": {
      "prompt": "一只小猫在月光下奔跑",
      "negative_prompt": "花朵"
    },
    "parameters": {
      "resolution": "720P",
      "ratio": "16:9",
      "duration": 10,
      "prompt_extend": true,
      "watermark": false
    }
  }'
```

### 3.2 图生视频（首帧）

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/wan2.7-i2v-2026-04-25',
  input: {
    prompt: '涂鸦少年对着镜头说唱，都市夜景',
    media: [
      {
        type: 'first_frame',
        url: 'https://cdn.example.com/graffiti-boy.png',
      },
    ],
  },
  parameters: {
    resolution: '720P',
    duration: 15,
    prompt_extend: true,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.7-i2v-2026-04-25",
    "input": {
      "prompt": "涂鸦少年对着镜头说唱",
      "media": [
        { "type": "first_frame", "url": "https://cdn.example.com/graffiti-boy.png" }
      ]
    },
    "parameters": {
      "resolution": "720P",
      "duration": 15,
      "prompt_extend": true
    }
  }'
```

### 3.3 参考生视频

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/wan2.7-r2v-2026-04-25',
  input: {
    prompt: '视频2抱着图片3在咖啡厅弹奏民谣，视频1笑着走向视频2',
    media: [
      { type: 'video', url: 'https://cdn.example.com/ref-a.mp4' },
      { type: 'video', url: 'https://cdn.example.com/ref-b.mp4' },
      { type: 'image', url: 'https://cdn.example.com/ref-c.png' },
    ],
  },
  parameters: {
    resolution: '720P',
    ratio: '16:9',
    duration: 15,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.7-r2v-2026-04-25",
    "input": {
      "prompt": "视频2抱着图片3在咖啡厅弹奏民谣",
      "media": [
        { "type": "video", "url": "https://cdn.example.com/ref-a.mp4" },
        { "type": "image", "url": "https://cdn.example.com/ref-c.png" }
      ]
    },
    "parameters": {
      "resolution": "720P",
      "ratio": "16:9",
      "duration": 15
    }
  }'
```

### 3.4 视频编辑

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/wan2.7-video-edit-2026-04-25',
  input: {
    prompt: '将视频中女孩的衣服替换为图片中的衣服',
    media: [
      { type: 'video', url: 'https://cdn.example.com/girl.mp4' },
      { type: 'image', url: 'https://cdn.example.com/dress.png' },
    ],
  },
  parameters: {
    resolution: '720P',
    duration: 10,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/wan2.7-video-edit-2026-04-25",
    "input": {
      "prompt": "将视频中女孩的衣服替换为图片中的衣服",
      "media": [
        { "type": "video", "url": "https://cdn.example.com/girl.mp4" },
        { "type": "image", "url": "https://cdn.example.com/dress.png" }
      ]
    },
    "parameters": { "resolution": "720P", "duration": 10 }
  }'
```

---

## 5. DashScope — Vidu（百炼托管）

> 完整参数见 **§2.4**。

`video_provider`: **dashscope**  
对客 `model` 使用 `qwen/vidu/` 前缀（如 `qwen/vidu/viduq3-turbo_text2video`）；上游 body 中 `model` 仍为 `vidu/viduq3-turbo_text2video`。  
网关将标准体**原样**转发至 `video-synthesis`。

### 4.1 文生视频 `vidu/viduq3-turbo_text2video`

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/vidu/viduq3-turbo_text2video',
  input: {
    prompt: '一只猫在草地上跑，电影感镜头',
  },
  parameters: {
    resolution: '720P',
    size: '1280*720',
    duration: 5,
    audio: true,
    watermark: false,
    seed: 0,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/vidu/viduq3-turbo_text2video",
    "input": { "prompt": "一只猫在草地上跑，电影感镜头" },
    "parameters": {
      "resolution": "720P",
      "size": "1280*720",
      "duration": 5,
      "audio": true,
      "watermark": false
    }
  }'
```

### 4.2 图生视频 `vidu/viduq3-pro_img2video`

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/vidu/viduq3-pro_img2video',
  input: {
    prompt: '镜头从海龟下方缓缓上移，海龟悠然游动',
    media: [
      {
        type: 'image',
        url: 'https://cdn.example.com/turtle.png',
      },
    ],
  },
  parameters: {
    resolution: '720P',
    duration: 5,
    audio: true,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/vidu/viduq3-pro_img2video",
    "input": {
      "prompt": "镜头从海龟下方缓缓上移",
      "media": [
        { "type": "image", "url": "https://cdn.example.com/turtle.png" }
      ]
    },
    "parameters": {
      "resolution": "720P",
      "duration": 5,
      "audio": true
    }
  }'
```

### 4.3 首尾帧 `vidu/viduq3-turbo_start-end2video`

**推导模式**：`start_end2video`（恰好 2×`image`，顺序为首帧、尾帧）

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/vidu/viduq3-turbo_start-end2video',
  input: {
    prompt: '镜头推近，鸟儿飞向右侧，红色光效跟随',
    media: [
      { type: 'image', url: 'https://cdn.example.com/start.jpeg' },
      { type: 'image', url: 'https://cdn.example.com/end.jpeg' },
    ],
  },
  parameters: {
    resolution: '1080P',
    duration: 5,
    audio: true,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/vidu/viduq3-turbo_start-end2video",
    "input": {
      "prompt": "镜头推近，鸟儿飞向右侧",
      "media": [
        { "type": "image", "url": "https://cdn.example.com/start.jpeg" },
        { "type": "image", "url": "https://cdn.example.com/end.jpeg" }
      ]
    },
    "parameters": {
      "resolution": "1080P",
      "duration": 5,
      "audio": true
    }
  }'
```

### 4.4 参考生视频 `vidu/viduq3-mix_reference2video`

```typescript
const body: StudioVideoCreateBody = {
  model: 'qwen/vidu/viduq3-mix_reference2video',
  input: {
    prompt: '@1 和 @2 在海边散步，夕阳逆光',
    media: [
      { type: 'image', url: 'https://cdn.example.com/person.png' },
      { type: 'image', url: 'https://cdn.example.com/dog.png' },
    ],
  },
  parameters: {
    resolution: '720P',
    size: '1280*720',
    duration: 8,
    audio: true,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen/vidu/viduq3-mix_reference2video",
    "input": {
      "prompt": "@1 和 @2 在海边散步",
      "media": [
        { "type": "image", "url": "https://cdn.example.com/person.png" },
        { "type": "image", "url": "https://cdn.example.com/dog.png" }
      ]
    },
    "parameters": {
      "resolution": "720P",
      "size": "1280*720",
      "duration": 8,
      "audio": true
    }
  }'
```

---

## 6. Vidu 官方 API（`api.vidu.cn`）

> 完整参数见 **§2.5**。

`video_provider`: **vidu**  
对客 `model` 为 `vidu/{官方短名}`（如 `vidu/viduq3-pro`）；上游 `model` 为 `viduq3-pro`。  
网关映射：

| 推导模式 | 上游路径 |
| --- | --- |
| `text2video` | `POST /ent/v2/text2video` |
| `image2video` | `POST /ent/v2/img2video` |
| `start_end2video` | `POST /ent/v2/start-end2video` |
| `reference2video` | `POST /ent/v2/reference2video` |

标准侧使用 `parameters.ratio`，网关映射为上游 `aspect_ratio`；`parameters.resolution` 使用小写（如 `720p`）。

### 5.1 文生视频 `viduq3-pro`

```typescript
const body: StudioVideoCreateBody = {
  model: 'vidu/viduq3-pro',
  input: {
    prompt:
      'Ultra-realistic astronaut walking through fog, cinematic lighting.',
  },
  parameters: {
    ratio: '4:3',
    resolution: '540p',
    duration: 5,
    seed: 0,
    audio: true,
    off_peak: false,
    style: 'general',
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "vidu/viduq3-pro",
    "input": {
      "prompt": "Ultra-realistic astronaut walking through fog, cinematic lighting."
    },
    "parameters": {
      "ratio": "4:3",
      "resolution": "540p",
      "duration": 5,
      "audio": true,
      "off_peak": false,
      "style": "general"
    }
  }'
```

### 5.2 图生视频 `viduq3-turbo`

**推导模式**：`image2video`（1×`image` 或 `first_frame`）

```typescript
const body: StudioVideoCreateBody = {
  model: 'vidu/viduq3-turbo',
  input: {
    prompt: '海龟在珊瑚礁间缓慢游动',
    media: [
      {
        type: 'image',
        url: 'https://cdn.example.com/turtle.jpeg',
      },
    ],
  },
  parameters: {
    resolution: '720p',
    duration: 5,
    audio: true,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "vidu/viduq3-turbo",
    "input": {
      "prompt": "海龟在珊瑚礁间缓慢游动",
      "media": [
        { "type": "image", "url": "https://cdn.example.com/turtle.jpeg" }
      ]
    },
    "parameters": {
      "resolution": "720p",
      "duration": 5,
      "audio": true
    }
  }'
```

### 5.3 首尾帧 `viduq3-pro`

```typescript
const body: StudioVideoCreateBody = {
  model: 'vidu/viduq3-pro',
  input: {
    prompt: 'The camera zooms in on the bird, which then flies to the right.',
    media: [
      { type: 'image', url: 'https://cdn.example.com/start-end-1.jpeg' },
      { type: 'image', url: 'https://cdn.example.com/start-end-2.jpeg' },
    ],
  },
  parameters: {
    resolution: '1080p',
    duration: 5,
    audio: true,
    off_peak: false,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "vidu/viduq3-pro",
    "input": {
      "prompt": "The camera zooms in on the bird, which then flies to the right.",
      "media": [
        { "type": "image", "url": "https://cdn.example.com/start-end-1.jpeg" },
        { "type": "image", "url": "https://cdn.example.com/start-end-2.jpeg" }
      ]
    },
    "parameters": {
      "resolution": "1080p",
      "duration": 5,
      "audio": true,
      "off_peak": false
    }
  }'
```

### 5.4 参考生视频 `viduq3`（主体 / 多图）

可使用 `input.subjects`（官方主体结构）或 `input.media` 多图。

```typescript
const body: StudioVideoCreateBody = {
  model: 'vidu/viduq3',
  input: {
    prompt: '@1 和 @2 在一起吃火锅，旁白说大家都爱吃火锅。',
    subjects: [
      {
        id: '1',
        images: ['https://cdn.example.com/subject-a.png'],
      },
      {
        id: '2',
        images: ['https://cdn.example.com/subject-b.png'],
      },
    ],
  },
  parameters: {
    ratio: '16:9',
    resolution: '720p',
    duration: 5,
    audio: true,
    audio_type: 'all',
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "vidu/viduq3",
    "input": {
      "prompt": "@1 和 @2 在一起吃火锅",
      "subjects": [
        { "id": "1", "images": ["https://cdn.example.com/subject-a.png"] },
        { "id": "2", "images": ["https://cdn.example.com/subject-b.png"] }
      ]
    },
    "parameters": {
      "ratio": "16:9",
      "resolution": "720p",
      "duration": 5,
      "audio": true,
      "audio_type": "all"
    }
  }'
```

**多图简写**（无 `subjects` 时，`media` 映射为上游 `images[]`）：

```typescript
const body: StudioVideoCreateBody = {
  model: 'vidu/viduq3-mix',
  input: {
    prompt: '两只猫在沙发上打闹，搞笑风格',
    media: [
      { type: 'image', url: 'https://cdn.example.com/cat1.png' },
      { type: 'image', url: 'https://cdn.example.com/cat2.png' },
    ],
  },
  parameters: {
    resolution: '720p',
    duration: 8,
    audio: true,
  },
};

await createStudioVideoTask(body);
```

---

## 7. Volcengine — Seedance（方舟）

> 完整参数见 **§2.6**。

`video_provider`: **volcengine**  
对客 `model` 为 `volcengine/{方舟 Model ID}`（如 `volcengine/doubao-seedance-1-5-pro-251215`）；上游 `model` 仍为 `doubao-seedance-*`。  
网关将 `input.prompt` + `input.media` 映射为上游 `content[]`；`parameters.audio` 映射为 `generate_audio`。

| 推导模式 | `content[]` 要点 |
| --- | --- |
| `text2video` | `{ type: "text", text }` |
| `image2video` | 1×`image_url`，`role`: `first_frame` |
| `start_end2video` | 2×`image_url`，`role`: `first_frame` / `last_frame` |
| `reference2video` | 多图 `reference_image`、可选 `video_url` / `audio_url` |

### 6.1 文生视频

```typescript
const body: StudioVideoCreateBody = {
  model: 'volcengine/doubao-seedance-1-5-pro-251215',
  input: {
    prompt: '小猫对着镜头打哈欠，室内暖光，电影感',
  },
  parameters: {
    resolution: '720p',
    ratio: '16:9',
    duration: 5,
    seed: 11,
    generate_audio: true,
    watermark: false,
    camera_fixed: false,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "volcengine/doubao-seedance-1-5-pro-251215",
    "input": {
      "prompt": "小猫对着镜头打哈欠，室内暖光，电影感"
    },
    "parameters": {
      "resolution": "720p",
      "ratio": "16:9",
      "duration": 5,
      "seed": 11,
      "generate_audio": true,
      "watermark": false,
      "camera_fixed": false
    }
  }'
```

### 6.2 图生视频（首帧）

```typescript
const body: StudioVideoCreateBody = {
  model: 'volcengine/doubao-seedance-2-0-260128',
  input: {
    prompt: '女孩转头微笑，发丝随风飘动',
    media: [
      {
        type: 'first_frame',
        url: 'https://cdn.example.com/portrait.png',
      },
    ],
  },
  parameters: {
    resolution: '720p',
    ratio: 'adaptive',
    duration: 5,
    generate_audio: true,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "volcengine/doubao-seedance-2-0-260128",
    "input": {
      "prompt": "女孩转头微笑，发丝随风飘动",
      "media": [
        { "type": "first_frame", "url": "https://cdn.example.com/portrait.png" }
      ]
    },
    "parameters": {
      "resolution": "720p",
      "ratio": "adaptive",
      "duration": 5,
      "generate_audio": true
    }
  }'
```

### 6.3 首尾帧

```typescript
const body: StudioVideoCreateBody = {
  model: 'volcengine/doubao-seedance-1-5-pro-251215',
  input: {
    prompt: '从静态肖像平滑过渡到奔跑姿态',
    media: [
      {
        type: 'first_frame',
        url: 'https://cdn.example.com/frame-start.png',
      },
      {
        type: 'last_frame',
        url: 'https://cdn.example.com/frame-end.png',
      },
    ],
  },
  parameters: {
    resolution: '1080p',
    duration: 5,
    generate_audio: false,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "volcengine/doubao-seedance-1-5-pro-251215",
    "input": {
      "prompt": "从静态肖像平滑过渡到奔跑姿态",
      "media": [
        { "type": "first_frame", "url": "https://cdn.example.com/frame-start.png" },
        { "type": "last_frame", "url": "https://cdn.example.com/frame-end.png" }
      ]
    },
    "parameters": {
      "resolution": "1080p",
      "duration": 5,
      "generate_audio": false
    }
  }'
```

### 6.4 多模态参考生视频（Seedance 2.0）

```typescript
const body: StudioVideoCreateBody = {
  model: 'volcengine/doubao-seedance-2-0-260128',
  input: {
    prompt: '[图1]戴着眼镜穿蓝T恤的男生和[图2]的柯基坐在[图3]的草坪上',
    media: [
      {
        type: 'reference_image',
        url: 'https://cdn.example.com/ref-boy.png',
      },
      {
        type: 'reference_image',
        url: 'https://cdn.example.com/ref-dog.png',
      },
      {
        type: 'reference_image',
        url: 'https://cdn.example.com/ref-grass.png',
      },
      {
        type: 'video',
        url: 'https://cdn.example.com/ref-motion.mp4',
        role: 'reference_video',
      },
    ],
  },
  parameters: {
    resolution: '720p',
    ratio: '16:9',
    duration: 8,
    generate_audio: true,
  },
};

await createStudioVideoTask(body);
```

```bash
curl -sS -X POST "${GATEWAY}/v1/studio/video/generations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "volcengine/doubao-seedance-2-0-260128",
    "input": {
      "prompt": "[图1]男生和[图2]柯基坐在[图3]草坪上",
      "media": [
        { "type": "reference_image", "url": "https://cdn.example.com/ref-boy.png" },
        { "type": "reference_image", "url": "https://cdn.example.com/ref-dog.png" },
        { "type": "reference_image", "url": "https://cdn.example.com/ref-grass.png" },
        { "type": "video", "url": "https://cdn.example.com/ref-motion.mp4", "role": "reference_video" }
      ]
    },
    "parameters": {
      "resolution": "720p",
      "ratio": "16:9",
      "duration": 8,
      "generate_audio": true
    }
  }'
```

---

## 8. Provider 与模型对照速查

| Provider | 对客 `model` 示例 | 上游 `model` | 路由要求（`custom_host`） |
| --- | --- | --- | --- |
| dashscope | `qwen/happyhorse-1.0-t2v`、`qwen/wan2.7-t2v-*`、`qwen/vidu/viduq3-*` | 去掉 `qwen/` 前缀 | `*.aliyuncs.com` |
| vidu | `vidu/viduq3-pro`、`vidu/viduq3-turbo` | 去掉 `vidu/` 前缀 | `api.vidu.cn` |
| volcengine | `volcengine/doubao-seedance-*` | 去掉 `volcengine/` 前缀 | `*.volces.com` |

若 `model` 解析的 `video_provider` 与租户路由 `custom_host` 不一致，网关返回 **400** `model_route_mismatch`。

---

## 9. 常见错误响应

校验失败（**400** `invalid_parameter`）：

```json
{
  "error": {
    "code": "invalid_parameter",
    "message": "happyhorse-1.0-t2v 文生视频参数校验未通过",
    "model": "qwen/happyhorse-1.0-t2v",
    "mode": "text2video",
    "details": [
      { "field": "input.prompt", "message": "input.prompt 为必填字符串，且不能为空" }
    ]
  }
}
```

余额不足（**402** `insufficient_balance`）、未注册模型（**400** `model_not_supported`）等见设计文档 §5。
