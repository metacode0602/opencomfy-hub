以下是为您整理的 Liblib API - F.1 Kontext 的标准接口文档。

---

# 🎨 Liblib API - F.1 Kontext 接口文档

F.1 Kontext 是新一代多模态生成模型，具备强大的语义理解和风格对齐能力。

### 计费说明
单次调用消耗 API 积分（1 积分 = 0.01 元）：
- **Pro 版本**：29 积分/次（约 0.29 元/张）
- **Max 版本**：58 积分/次（约 0.58 元/张）

---

## 1. 文生图 (Text-to-Image)

通过文本描述生成图片。

### 1.1 接口定义
- **请求地址**：`POST /api/generate/kontext/text2img`
- **Content-Type**：`application/json`

### 1.2 请求参数

| 参数名 | 类型 | 是否必需 | 说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| **templateUuid** | string | **是** | 固定值 | `fe9928fde1b4491c9b360dd24aa2b115` |
| **generateParams** | object | **是** | 生图参数 | JSON 结构 |

#### generateParams 参数详情

| 变量名 | 类型 | 是否必需 | 说明 | 默认值/范围 |
| :--- | :--- | :--- | :--- | :--- |
| **model** | enum | 否 | 模型版本- `pro`- `max` | 默认：`max` |
| **prompt** | string | **是** | 正向提示词 | 不超过 2000 字符 |
| **aspectRatio** | enum | 否 | 图片宽高比- `1:1`, `2:3`, `3:2`, `3:4`, `4:3`- `9:16`, `16:9`, `9:21`, `21:9` | 默认：`1:1` |
| **imgCount** | int | 否 | 单次生图张数 | 默认：1 (范围: 1~4) |
| **guidance_scale** | double | 否 | 提示词引导系数 | 默认：3.5 (范围: 1.0~20.0) |

### 1.3 请求示例
```json
{
    "templateUuid": "fe9928fde1b4491c9b360dd24aa2b115",
    "generateParams": {
        "model": "pro",
        "prompt": "画一个LibLib公司的品牌海报",
        "aspectRatio": "3:4",
        "guidance_scale": 3.5,
        "imgCount": 1
    }
}
```

### 1.4 返回参数
| 参数名 | 类型 | 说明 |
| :--- | :--- | :--- |
| **generateUuid** | string | 生图任务 UUID，用于查询进度 |

---

## 2. 图生图 (Image-to-Image)

支持指令编辑和多图参考（最多 4 张）。

### 2.1 接口定义
- **请求地址**：`POST /api/generate/kontext/img2img`
- **Content-Type**：`application/json`

### 2.2 请求参数

| 参数名 | 类型 | 是否必需 | 说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| **templateUuid** | string | **是** | 固定值 | `1c0a9712b3d84e1b8a9f49514a46d88c` |
| **generateParams** | object | **是** | 生图参数 | JSON 结构 |

#### generateParams 参数详情

| 变量名 | 类型 | 是否必需 | 说明 | 默认值/范围 |
| :--- | :--- | :--- | :--- | :--- |
| **model** | enum | 否 | 模型版本- `pro` (**暂不支持多图参考**)- `max` | 默认：`max` |
| **prompt** | string | **是** | 正向提示词 | 不超过 2000 字符 |
| **image_list** | Array | **是** | 参考图列表 | 1~4 张，公网可访问 URL格式：PNG/JPG/JPEG/WEBP大小：每张 ≤10MB |
| **aspectRatio** | enum | 否 | 图片宽高比 | 默认：`1:1` (同文生图选项) |
| **imgCount** | int | 否 | 单次生图张数 | 默认：1 (范围: 1~4) |
| **guidance_scale** | double | 否 | 提示词引导系数 | 默认：3.5 (范围: 1.0~20.0) |

### 2.3 请求示例
```json
{
    "templateUuid": "1c0a9712b3d84e1b8a9f49514a46d88c",
    "generateParams": {
        "prompt": "Turn this image into a Ghibli-style, a traditional Japanese anime aesthetics.",
        "aspectRatio": "2:3",
        "guidance_scale": 3.5,
        "imgCount": 1,
        "image_list": [
            "https://liblibai-online.liblib.cloud/img/081e9f07d9bd4c2ba090efde163518f9/3c65a38d7df2589c4bf834740385192128cf035c7c779ae2bbbc354bf0efcfcb.png"
        ]
    }
}
```

### 2.4 返回参数
| 参数名 | 类型 | 说明 |
| :--- | :--- | :--- |
| **generateUuid** | string | 生图任务 UUID，用于查询进度 |

---

## 3. 查询任务结果

### 3.1 接口定义
- **请求地址**：`POST /api/generate/status`
- **Content-Type**：`application/json`

### 3.2 请求参数
| 参数名 | 类型 | 是否必需 | 说明 |
| :--- | :--- | :--- | :--- |
| **generateUuid** | string | **是** | 生图任务 UUID |

### 3.3 返回参数

| 参数名 | 类型 | 说明 |
| :--- | :--- | :--- |
| **generateUuid** | string | 生图任务 UUID |
| **generateStatus** | int | 生图状态（见下方状态码表） |
| **percentCompleted** | float | 生图进度（智能算法 IMG1 不支持） |
| **generateMsg** | string | 生图附加信息（如失败原因） |
| **pointsCost** | int | 本次消耗积分 |
| **accountBalance** | int | 账户剩余积分 |
| **images** | []object | 图片列表（仅审核通过） |
| **images.imageUrl** | string | 图片地址（有效期 7 天） |
| **images.seed** | int | 随机种子值（智能算法 IMG1 不支持） |
| **images.auditStatus** | int | 审核状态（见下方状态码表） |

#### 状态码说明

**任务执行状态 (generateStatus)**
| 状态码 | 含义 |
| :--- | :--- |
| 1 | 等待执行 |
| 2 | 执行中 |
| 3 | 已生图 |
| 4 | 审核中 |
| **5** | **任务成功** |
| 6 | 任务失败 |

**审核状态 (auditStatus)**
| 状态码 | 含义 |
| :--- | :--- |
| 1 | 待审核 |
| 2 | 审核中 |
| **3** | **审核通过** |
| 4 | 审核拦截 |
| 5 | 审核失败 |