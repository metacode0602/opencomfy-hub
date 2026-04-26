这是一份基于你提供的 `Liblib API.txt` 文件整理的 Markdown 格式 API 文档。LiblibAI 提供了强大的文生图、图生图及 ControlNet 接口，支持 F1-dev/XL/v3/v1.5 系列模型。

### LiblibAI API 文档

#### 1. 通用说明
- **请求头 (Headers)**:
  ```json
  {
    "Content-Type": "application/json"
  }
  ```
- **模型版本 (version_uuid)**: 需在 LiblibAI 官网模型详情页链接中获取，或通过接口查询。

---

#### 2. 接口列表

#### 2.1 查询模型版本信息
获取模型的详细参数及授权状态。
- **接口**: `POST /api/model/version/get`
- **请求 Body**:
  | 参数名 | 类型 | 必需 | 说明 |
  | :--- | :--- | :--- | :--- |
  | versionUuid | string | 是 | 模型版本 UUID |

- **返回示例**:
  ```json
  {
    "version_uuid": "21df5d84cca74f7a885ba672b5a80d19",
    "model_name": "AWPortrait XL",
    "version_name": "1.1",
    "baseAlgo": "基础算法 XL",
    "show_type": "1",
    "commercial_use": "1",
    "model_url": "https://www.liblib.art/modelinfo/..."
  }
  ```

#### 2.2 提交文生图任务 (Text-to-Image)
- **接口**: `POST /api/generate/webui/text2img`
- **请求 Body**:
  | 参数名 | 类型 | 必需 | 说明 |
  | :--- | :--- | :--- | :--- |
  | templateUuid | string | 否 | 参数模板 UUID |
  | generateParams | object | 是 | 生图参数 JSON |

- **generateParams 参数详解**:
  ```json
  {
    "checkPointId": "string",       // 底模 ID
    "prompt": "string",            // 正向提示词
    "negativePrompt": "string",    // 负向提示词
    "sampler": 15,                 // 采样器枚举值
    "steps": 20,                   // 采样步数
    "cfgScale": 7,                 // 提示词引导系数
    "width": 768,                  // 宽度
    "height": 1024,                // 高度
    "imgCount": 1,                 // 生成数量
    "seed": -1,                    // 随机种子 (-1为随机)
    "restoreFaces": 0,             // 面部修复 (0关 1开)
    "additionalNetwork": [         // LoRA 列表 (最多5个)
      {
        "modelId": "string",
        "weight": 0.3
      }
    ],
    "hiResFixInfo": {              // 高清修复参数
      "hiresSteps": 20,
      "hiresDenoisingStrength": 0.75,
      "upscaler": 10,
      "resizedWidth": 1024,
      "resizedHeight": 1536
    }
  }
  ```

- **返回值**:
  | 参数名 | 类型 | 说明 |
  | :--- | :--- | :--- |
  | generateUuid | string | 生图任务 UUID，用于查询进度 |

---

#### 2.3 提交图生图任务 (Image-to-Image)
- **接口**: `POST /api/generate/webui/img2img`
- **请求 Body**:
  与文生图类似，核心区别在于 `generateParams` 中包含图像相关参数。

- **generateParams 核心差异参数**:
  | 参数名 | 类型 | 说明 |
  | :--- | :--- | :--- |
  | sourceImage | string | 参考图公网 URL |
  | resizeMode | int | 缩放模式 (0拉伸 1裁剪 2填充) |
  | denoisingStrength | double | 重绘幅度 (0-1) |
  | mode | int | 模式 (0图生图 4局部重绘) |
  | inpaintParam | object | 局部重绘参数 (当 mode=4 时) |
  | controlNet | array | ControlNet 配置 (最多4组) |

- **ControlNet (controlNet) 参数结构**:
  ```json
  [
    {
      "unitOrder": 1,                     // 执行顺序
      "sourceImage": "string",            // ControlNet 参考图 URL
      "preprocessor": 3,                  // 预处理器枚举值
      "model": "string",                  // ControlNet 模型 UUID
      "controlWeight": 1.0,               // 控制权重
      "startingControlStep": 0.0,         // 开始步数 (百分比)
      "endingControlStep": 1.0,           // 结束步数 (百分比)
      "controlMode": 0,                   // 控制模式 (0均衡 1重提示词 2重CN)
      "annotationParameters": { ... }    // 预处理器具体参数
    }
  ]
  ```

---

#### 2.4 查询生图结果 (Status)
- **接口**: `POST /api/generate/webui/status`
- **请求 Body**:
  | 参数名 | 类型 | 必需 | 说明 |
  | :--- | :--- | :--- | :--- |
  | generateUuid | string | 是 | 生图任务 UUID |

- **返回值**:
  ```json
  {
    "generateUuid": "string",
    "generateStatus": 5,          // 状态码
    "generateMsg": "string",      // 状态信息
    "pointsCost": 10,             // 消耗积分
    "accountBalance": 1356402,     // 账户余额
    "images": [                   // 图片列表
      {
        "imageUrl": "string",     // 图片地址 (有效期7天)
        "seed": 12345,
        "auditStatus": 3          // 审核状态
      }
    ]
  }
  ```

---

#### 3. ControlNet 预处理器 (Preprocessors) 参考
以下是部分常用的预处理器枚举值及参数映射（完整列表请参考源文档）：

| 预处理器名称 | 枚举值 | 适用 ControlNet 类型 | 参数示例/说明 |
| :--- | :--- | :--- | :--- |
| **Canny (硬边缘)** | 1 | `canny` | `{"canny": {"preprocessorResolution": 512, "lowThreshold": 100, "highThreshold": 200}}` |
| **Depth (深度)** | 2 | `depth` | `{"depthMidas": {"preprocessorResolution": 512}}` |
| **Depth LeRes** | 3 | `depth` | `{"depthLeres": {"removeNear": 0, "removeBackground": 0}}` |
| **Lineart (线稿)** | 29/32 | `lineart` | `{"lineartRealistic": {"preprocessorResolution": 512}}` |
| **OpenPose** | 10 | `openpose` | `{"openpose": {"preprocessorResolution": 512}}` |
| **Tile/Blur** | 34 | `tile` | `{"tileResample": {"downSamplingRate": 1}}` |
| **IP-Adapter** | 48/49 | `ip_adapter` | `{"ipAdapterClipSd15": {"preprocessorResolution": 512}}` |
| **Instant ID** | 59 | `instant_id` | `{"instantIdFaceKeypoints": {"preprocessorResolution": 512}}` |

> **注意**: 不同的 ControlNet 模型需要搭配特定的预处理器。例如 `depth_leres` 预处理器 (枚举值 3) 需配合 `depth` 类型的 ControlNet 模型使用。

这是一份基于你提供的文档整理的 LiblibAI API 接口文档。

### LiblibAI API 文档

#### 1. 通用说明
*   **Base URL**: (需根据实际部署情况填写，文档中未明确指定域名)
*   **请求头 (Headers)**:
    ```json
    {
      "Content-Type": "application/json"
    }
    ```
*   **鉴权**: 文档中未明确提及 Token，通常需在 Header 中携带 API Key (如 `Authorization: Bearer <your_token>`)。

---

#### 2. 接口详情

#### 2.1 查询模型版本信息
获取模型的详细参数及授权状态。
*   **接口**: `POST /api/model/version/get`
*   **请求 Body**:
    | 参数名 | 类型 | 必需 | 说明 |
    | :--- | :--- | :--- | :--- |
    | versionUuid | string | 是 | 模型版本 UUID |

*   **返回示例**:
    ```json
    {
      "code": 0,
      "msg": "",
      "data": {
        "version_uuid": "21df5d84cca74f7a885ba672b5a80d19",
        "model_name": "AWPortrait XL",
        "version_name": "1.1",
        "baseAlgo": "基础算法 XL",
        "show_type": "1",
        "commercial_use": "1",
        "model_url": "https://www.liblib.art/modelinfo/..."
      }
    }
    ```

#### 2.2 提交文生图任务 (Text-to-Image)
*   **接口**: `POST /api/generate/webui/text2img`
*   **请求 Body**:
    | 参数名 | 类型 | 必需 | 说明 |
    | :--- | :--- | :--- | :--- |
    | templateUuid | string | 否 | 参数模板 UUID |
    | generateParams | object | 是 | 生图参数 JSON |

*   **generateParams 参数详解**:
    ```json
    {
      "checkPointId": "string",       // 底模 ID
      "prompt": "string",            // 正向提示词
      "negativePrompt": "string",    // 负向提示词
      "sampler": 15,                 // 采样器枚举值
      "steps": 20,                   // 采样步数
      "cfgScale": 7,                 // 提示词引导系数
      "width": 768,                  // 宽度
      "height": 1024,                // 高度
      "imgCount": 1,                 // 生成数量
      "seed": -1,                    // 随机种子 (-1为随机)
      "restoreFaces": 0,             // 面部修复 (0关 1开)
      "additionalNetwork": [         // LoRA 列表 (最多5个)
        {
          "modelId": "string",
          "weight": 0.3
        }
      ],
      "hiResFixInfo": {              // 高清修复参数
        "hiresSteps": 20,
        "hiresDenoisingStrength": 0.75,
        "upscaler": 10,
        "resizedWidth": 1024,
        "resizedHeight": 1536
      }
    }
    ```

*   **返回值**:
  | 参数名 | 类型 | 说明 |
  | :--- | :--- | :--- |
  | generateUuid | string | 生图任务 UUID，用于查询进度 |

#### 2.3 提交图生图任务 (Image-to-Image)
*   **接口**: `POST /api/generate/webui/img2img`
*   **请求 Body**:
  与文生图类似，核心区别在于 `generateParams` 中包含图像相关参数。

*   **generateParams 核心差异参数**:
    | 参数名 | 类型 | 说明 |
    | :--- | :--- | :--- |
    | sourceImage | string | 参考图公网 URL |
    | resizeMode | int | 缩放模式 (0拉伸 1裁剪 2填充) |
    | denoisingStrength | double | 重绘幅度 (0-1) |
    | mode | int | 模式 (0图生图 4局部重绘) |
    | inpaintParam | object | 局部重绘参数 (当 mode=4 时) |
    | controlNet | array | ControlNet 配置 (最多4组) |

*   **ControlNet (controlNet) 参数结构**:
    ```json
    [
      {
        "unitOrder": 1,                     // 执行顺序
        "sourceImage": "string",            // ControlNet 参考图 URL
        "preprocessor": 3,                  // 预处理器枚举值
        "model": "string",                  // ControlNet 模型 UUID
        "controlWeight": 1.0,               // 控制权重
        "startingControlStep": 0.0,         // 开始步数 (百分比)
        "endingControlStep": 1.0,           // 结束步数 (百分比)
        "controlMode": 0,                   // 控制模式 (0均衡 1重提示词 2重CN)
        "annotationParameters": { ... }      // 预处理器具体参数
      }
    ]
    ```

#### 2.4 查询生图结果 (Status)
*   **接口**: `POST /api/generate/webui/status`
*   **请求 Body**:
    | 参数名 | 类型 | 必需 | 说明 |
    | :--- | :--- | :--- | :--- |
    | generateUuid | string | 是 | 生图任务 UUID |

*   **返回值**:
    ```json
    {
      "code": 0,
      "msg": "",
      "data": {
        "generateUuid": "string",
        "generateStatus": 5,          // 状态码
        "percentCompleted": 0,        // 进度 (暂未实现)
        "pointsCost": 10,             // 消耗积分
        "accountBalance": 1356402,    // 账户余额
        "images": [                   // 图片列表
          {
            "imageUrl": "string",     // 图片地址 (有效期7天)
            "seed": 12345,
            "auditStatus": 3          // 审核状态
          }
        ]
      }
    }
    ```

---

#### 3. ControlNet 预处理器 (Preprocessors) 参考
以下是部分常用的预处理器枚举值及参数映射（完整列表请参考源文档）：

| 预处理器名称 | 枚举值 | 适用 ControlNet 类型 | 参数示例/说明 |
| :--- | :--- | :--- | :--- |
| **Canny (硬边缘)** | 1 | `canny` | `{"canny": {"preprocessorResolution": 512, "lowThreshold": 100, "highThreshold": 200}}` |
| **Depth (深度)** | 2 | `depth` | `{"depthMidas": {"preprocessorResolution": 512}}` |
| **Depth LeRes** | 3 | `depth` | `{"depthLeres": {"removeNear": 0, "removeBackground": 0}}` |
| **Lineart (线稿)** | 29/32 | `lineart` | `{"lineartRealistic": {"preprocessorResolution": 512}}` |
| **OpenPose** | 10 | `openpose` | `{"openpose": {"preprocessorResolution": 512}}` |
| **Tile/Blur** | 34 | `tile` | `{"tileResample": {"downSamplingRate": 1}}` |
| **IP-Adapter** | 48/49 | `ip_adapter` | `{"ipAdapterClipSd15": {"preprocessorResolution": 512}}` |
| **Instant ID** | 59 | `instant_id` | `{"instantIdFaceKeypoints": {"preprocessorResolution": 512}}` |

> **注意**: 不同的 ControlNet 模型需要搭配特定的预处理器。例如 `depth_leres` 预处理器 (枚举值 3) 需配合 `depth` 类型的 ControlNet 模型使用。

从你提供的文档来看，你正在查阅关于 **Resonate**（可能是基于 LiblibAI 或类似技术的图像生成平台）的 **API 接口参数说明** 和 **飞书同步块** 内容。

这些文档详细列出了不同生图场景（文生图、图生图、局部重绘等）的 JSON 参数结构和模板 UUID。

为了帮助你快速上手，我根据你提供的 7 个网页内容和参数文档，为你整理了核心参数模版对照表及使用建议：

### 核心参数模版速查表

根据文档 `3.1 模版选择` 和网页中的 `templateUuid`，以下是各场景的对应关系：

| 场景分类 | 模版名称 | Template UUID | 适用模型 | 网页示例链接 |
| :--- | :--- | :--- | :--- | :--- |
| **F.1 文生图** | F.1文生图 - 自定义完整参数 | `6f7c4652...` | 基础算法 F.1 | [网页2](https://resonate.feishu.cn/sync/UklAdrkqos0NNubQ42jcymktnSe) |
| **F.1 图生图** | F.1图生图 - 自定义完整参数 | `63b72710...` | 基础算法 F.1 | [网页5](https://resonate.feishu.cn/sync/YasbdeCAasWRaibd0tkc0ZU4nkd) |
| **1.5/XL 文生图** | 1.5和XL文生图 - 自定义完整参数 | `e10adc39...` | 基础算法 1.5/XL | [网页7](https://resonate.feishu.cn/sync/VrLRdFII0sSVtJbpj8NccFOqnYb) |
| **1.5/XL 图生图** | 1.5和XL图生图 - 自定义完整参数 | `9c7d531d...` | 基础算法 1.5/XL | [网页1](https://resonate.feishu.cn/sync/JPsPdxCIvskntObd6vNc3a0knAb) |
| **局部重绘** | 图生图局部重绘 | `74509e1b...` | 基础算法 1.5/XL | [网页4](https://resonate.feishu.cn/sync/HH8UdbOOzsNQ8Vb3kktcKm7JnHg) |

---

### 常用场景参数配置详解

根据网页内容，我为你提取了不同场景下的关键参数配置方式：

#### 1. 最简文生图 (Text-to-Image)
**适用场景：** 快速生成图片，仅需提示词。
**参考网页：** 网页 3
**核心参数：**
*   **Template:** `e10adc3949ba59abbe56e057f20f883e`
*   **关键字段：**
    ```json
    "prompt": "an asian girl,20 years old,realistic...", // 正向提示词
    "width": 768, "height": 1024, // 分辨率
    "steps": 20, // 采样步数
    ```

#### 2. 最简图生图 (Image-to-Image)
**适用场景：** 基于原图进行重绘。
**参考网页：** 网页 1
**核心参数：**
*   **Template:** `9c7d531dc75f476aa833b3d452b8f7ad`
*   **关键字段：**
    ```json
    "sourceImage": "https://.../image.png", // 原图URL
    "mode": 0, // 0代表图生图模式
    "denoisingStrength": 0.75, // 重绘幅度 (0-1，越低越像原图)
    ```

#### 3. 进阶图生图 (含 ControlNet 和 LoRA)
**适用场景：** 需要保留原图结构（如姿势、构图）并添加特定风格。
**参考网页：** 网页 6
**核心参数：**
*   **Template:** `9c7d531dc75f476aa833b3d452b8f7ad` (同上，但参数更全)
*   **关键字段：**
    ```json
    "mode": 4, // 4代表蒙版重绘/局部重绘模式
    "controlNet": [ // ControlNet 配置
        {
            "sourceImage": "https://.../control.png",
            "model": "6349e9dae8814084bd9c1585d335c24c", // ControlNet模型ID
            "preprocessor": 3 // 预处理器
        }
    ],
    "additionalNetwork": [ // LoRA 配置
        {
            "modelId": "31360f2f031b4ff6b589412a52713fcf",
            "weight": 0.3
        }
    ]
    ```

#### 4. 局部重绘 (Inpainting)
**适用场景：** 修改图片的某一部分（如换衣服、换背景）。
**参考网页：** 网页 4
**核心参数：**
*   **Template:** `74509e1b072a4c45a7f1843a963c8462`
*   **关键字段：**
    ```json
    "sourceImage": "原图地址",
    "inpaintParam": {
        "maskImage": "蒙版地址" // 白色区域为重绘区域
    },
    "denoisingStrength": 0.75
    ```

---

### 注意事项
1.  **参数精简：** 如果你使用的是“自定义完整参数”模版（如网页7），但不想使用某些功能（如 LoRA、ControlNet、高分修复），建议**直接删除**对应的 JSON 结构体，而不是留空，以免报错。
2.  **模型匹配：** 请注意 `checkPointId` (底模) 需要与你选择的 `templateUuid` 兼容（例如 F.1 模版不能用 XL 的底模）。
3.  **状态码：** 文档中提到的 `generateStatus` 和 `auditStatus` 可用于程序化监控任务进度，其中状态码 `7` 代表超时（任务创建30分钟后无结果）。
