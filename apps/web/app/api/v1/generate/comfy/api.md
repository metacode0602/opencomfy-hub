以下是为您整理的标准 Markdown 接口文档。

---

# 🎨 ComfyUI 工作流生图接口文档

该接口用于调用 ComfyUI 工作流进行图片生成。

## 接口基本信息

- **接口地址**：`/api/generate/comfyui/app`
- **请求方式**：`POST`
- **Content-Type**：`application/json`

---

## 请求参数

### 请求头
| 参数名 | 值 | 备注 |
| :--- | :--- | :--- |
| Content-Type | application/json | 必填 |

### 请求体
| 参数名 | 类型 | 是否必需 | 说明 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| **templateUuid** | string | 否 | 模版唯一标识 | 默认模版：`4df2efa0f18d46dc9758803e478eb51c` |
| **generateParams** | object | **是** | 生图参数 | JSON 结构，包含工作流节点的具体参数 |

> **💡 使用说明：**
> 1. 目前 Lib 已开放全站可商用、可在线运行的工作流供 API 使用。您可以在 [Lib 站内工作流合集](https://www.liblib.art/workflows) 进行检索。
> 2. 在工作流的详情页，若出现【本工作流已提供 API 服务】标识，即可查看相关 API 参数（未出现该标识的工作流暂不支持 API 调用）。

### 请求示例
```json
{
    "templateUuid": "4df2efa0f18d46dc9758803e478eb51c",
    "generateParams": {
        "12": {
            "class_type": "LoadImage",
            "inputs": {
                "image": "https://liblibai-tmp-image.liblib.cloud/img/baf2e419ce1cb06812314957efd2e067/af0c523d3d2b4092ab45c64c72e4deb76babb12e9b8a178eb524143c3b71bf85.png"
            }
        },
        "112": {
            "class_type": "ImageScale",
            "inputs": {
                "width": 768
            }
        },
        "136": {
            "class_type": "RepeatLatentBatch",
            "inputs": {
                "amount": 4
            }
        },
        "137": {
            "class_type": "LatentUpscaleBy",
            "inputs": {
                "scale_by": 1.5
            }
        },
        "workflowUuid": "2f22ab7ce4c044afb6d5eee2e61547f3"
    }
}
```

---

## 返回参数

| 参数名 | 类型 | 说明 |
| :--- | :--- | :--- |
| **generateUuid** | string | 生图任务唯一标识，请使用该 UUID 查询生图进度 |

---

## 附录：参数说明示例

以下是部分常见节点的参数说明，具体参数需根据所选工作流的定义为准。

### 节点参数详情表

| 节点ID | 节点类型 | 节点名称 | 参数项 | 参数名 | 参数说明 | 参数定义示例 (JSON Schema) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **80** | LoadImage | 风格图像 | image | 图像 | 传入图片的 URL 地址 | `{"parentId": 80, "id": "image", "name": "image", "displayName": "图像", "type": "IMAGE", "defaultValue": "...", "image_upload": true, "isMaskImage": false}` |
| **79** | ApplyIPAdapterFlux | 风格设置 | weight | 风格强度 | 浮点数，控制风格影响程度 | `{"parentId": 79, "id": "weight", "name": "weight", "displayName": "风格强度", "type": "FLOAT", "defaultValue": 0.75, "min": -1, "max": 5, "step": 0.05}` |
| **76** | SeargePromptCombiner | 画面描述 | prompt1 | 画面描述 | 字符串，描述要绘制的画面内容 | `{"parentId": 76, "id": "prompt1", "name": "prompt1", "displayName": "画面描述", "type": "STRING", "defaultValue": "Anime art, low angle shot..."}` |


以下是为您整理的查询生图结果的标准 Markdown 接口文档。

---

# 📊 查询生图结果接口文档

该接口用于根据任务 UUID 查询 ComfyUI 生图任务的执行状态、进度及最终生成的图片或视频结果。

## 接口基本信息

- **接口地址**：`/api/generate/comfy/status`
- **请求方式**：`POST`
- **Content-Type**：`application/json`

---

## 请求参数

### 请求头
| 参数名 | 值 | 备注 |
| :--- | :--- | :--- |
| Content-Type | application/json | 必填 |

### 请求体
| 参数名 | 类型 | 是否必需 | 说明 |
| :--- | :--- | :--- | :--- |
| **generateUuid** | string | **是** | 生图任务 UUID，发起生图任务时返回的标识 |

---

## 返回参数

| 参数名 | 类型 | 说明 |
| :--- | :--- | :--- |
| **generateUuid** | string | 生图任务 UUID |
| **generateStatus** | int | 生图任务执行状态（见下方状态码表） |
| **percentCompleted** | float | 生图进度，0 到 1 之间的浮点数（暂未实现） |
| **generateMsg** | string | 生图附加信息，如失败原因等 |
| **pointsCost** | int | 本次生图任务消耗的积分数 |
| **accountBalance** | int | 账户剩余积分数 |
| **images** | []object | 图片列表（仅包含审核通过的图片） |
| **images.imageUrl** | string | 图片地址，可直接访问，**有效期 7 天** |
| **images.seed** | int | 随机种子值 |
| **images.auditStatus** | int | 图片审核状态（见下方审核状态表） |
| **videos** | []object | 视频列表（仅包含审核通过的视频） |
| **videos.videoUrl** | string | 视频地址，可直接访问，**有效期 7 天** |
| **videos.coverPath** | string | 视频封面地址 |
| **videos.nodeId** | string | 输出视频的节点 ID（可忽略） |
| **videos.outputName** | string | 输出视频的节点名称 |
| **videos.auditStatus** | int | 视频审核状态（见下方审核状态表） |

### 状态码说明

#### 任务执行状态 (generateStatus)
| 状态码 | 含义 |
| :--- | :--- |
| 1 | 等待执行 |
| 2 | 执行中 |
| 3 | 已生图 |
| 4 | 审核中 |
| **5** | **任务成功** |
| 6 | 任务失败 |

#### 审核状态 (auditStatus)
| 状态码 | 含义 |
| :--- | :--- |
| 1 | 待审核 |
| 2 | 审核中 |
| **3** | **审核通过** |
| 4 | 审核拦截 |
| 5 | 审核失败 |

---

## 返回示例

```json
{
    "code": 0,
    "data": {
        "accountBalance": 91111,
        "generateStatus": 5,
        "generateUuid": "a996794faff8424a8ff56acb421e7305",
        "images": [
            {
                "auditStatus": 3,
                "imageUrl": "https://liblibai-tmp-image.liblib.cloud/img/360643a3d8414af8b99664b208bc9302/35801ecbf6e6ea8ad89c2606b68d30dfc9579713f5d917694d1616c57afe82fb.png",
                "nodeId": "91",
                "outputName": "SaveImage"
            }
        ],
        "percentCompleted": 1,
        "pointsCost": 10,
        "videos": []
    },
    "msg": ""
}
```

以下是为您整理的 ComfyUI 工作流推荐及 API 调用示例文档。

---

# 🚀 推荐工作流与 API 调用示例

全量工作流请前往 [LibLib 工作流合集](https://www.liblib.art/workflows) 挑选。

> **⚠️ 调用注意事项：**
> 在使用以下工作流时，**仅需修改 `inputs` 中的参数值**（如图片地址、数值、文本等），JSON 结构中的其他部分（如 `class_type`、节点 ID 等）请保持原样，不要修改。

---

### 1. 标准版_按分辨率缩放
- **功能描述**：将图片缩放到指定的宽度和高度。
- **特点**：比较推荐，速度很快。
- **工作流链接**：[查看工作流详情](https://www.liblib.art/modelinfo/1bf585fa9ae7455395ee7a595c3920a3?from=personal_page&versionUuid=fa2e042e32fa4aabbbacc255b4ab2cca)

#### API 参数示例
```json
{
    "templateUuid": "4df2efa0f18d46dc9758803e478eb51c",
    "generateParams": {
        "workflowUuid": "fa2e042e32fa4aabbbacc255b4ab2cca",
        "30": {
            "class_type": "LoadImage",
            "inputs": {
                "image": "https://liblibai-online.liblib.cloud/img/081e9f07d9bd4c2ba090efde163518f9/5fae2d9099c208487bc97867bece2bf3d904068e307c7bd30c646c9f3059af33.png"
            }
        },
        "31": {
            "class_type": "ImageScale",
            "inputs": {
                "width": 2048,
                "height": 2048
            }
        }
    }
}
```

---

### 2. 标准版_按系数放大
- **功能描述**：使用指定的模型（如 ESRGAN）将图片按倍数放大。
- **工作流链接**：[查看工作流详情](https://www.liblib.art/modelinfo/1bf585fa9ae7455395ee7a595c3920a3?from=personal_page&versionUuid=9a1c74ae498640c28e4269958b1a1b15)

#### API 参数示例
```json
{
    "templateUuid": "4df2efa0f18d46dc9758803e478eb51c",
    "generateParams": {
        "workflowUuid": "9a1c74ae498640c28e4269958b1a1b15",
        "30": {
            "class_type": "LoadImage",
            "inputs": {
                "image": "https://liblibai-online.liblib.cloud/img/081e9f07d9bd4c2ba090efde163518f9/5fae2d9099c208487bc97867bece2bf3d904068e307c7bd30c646c9f3059af33.png"
            }
        },
        "37": {
            "class_type": "CR Upscale Image",
            "inputs": {
                "upscale_model": "ESRGAN_4x",
                "rescale_factor": 2
            }
        }
    }
}
```

---

### 3. SD 放大
- **功能描述**：使用 Stable Diffusion 进行重绘放大，细节更丰富。
- **工作流链接**：[查看工作流详情](https://www.liblib.art/modelinfo/1bf585fa9ae7455395ee7a595c3920a3?from=personal_page&versionUuid=b2c5e10ee73d4cf69a0e51cb1cbc1622)

#### API 参数示例
```json
{
    "templateUuid": "4df2efa0f18d46dc9758803e478eb51c",
    "generateParams": {
        "workflowUuid": "b2c5e10ee73d4cf69a0e51cb1cbc1622",
        "30": {
            "class_type": "UltimateSDUpscale",
            "inputs": {
                "upscale_by": 2,
                "steps": 30
            }
        },
        "40": {
            "class_type": "LoadImage",
            "inputs": {
                "image": "https://liblibai-online.liblib.cloud/img/081e9f07d9bd4c2ba090efde163518f9/5fae2d9099c208487bc97867bece2bf3d904068e307c7bd30c646c9f3059af33.png"
            }
        },
        "41": {
            "class_type": "UpscaleModelLoader",
            "inputs": {
                "model_name": "ESRGAN_4x"
            }
        }
    }
}
```

---

### 4. 图像外扩
- **功能描述**：向外扩展图像边界（Outpainting），补全画面内容。
- **工作流链接**：[查看工作流详情](https://www.liblib.art/modelinfo/ef740b8a4f384db48fcf9f208372493a?from=personal_page&versionUuid=99fa146a003743bdb676179fa2e546ca)

#### API 参数示例
```json
{
    "templateUuid": "4df2efa0f18d46dc9758803e478eb51c",
    "generateParams": {
        "workflowUuid": "99fa146a003743bdb676179fa2e546ca",
        "17": {
            "class_type": "LoadImage",
            "inputs": {
                "image": "https://liblibai-online.liblib.cloud/img/081e9f07d9bd4c2ba090efde163518f9/ed68325cbfcf4b8f724b6b5aa5914e7d91358c3bbf81fccd5002950a2f8180df.png"
            }
        },
        "23": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "text": "beautiful scenery"
            }
        },
        "44": {
            "class_type": "ImagePadForOutpaint",
            "inputs": {
                "left": 400,
                "top": 400,
                "right": 400,
                "bottom": 400,
                "feathering": 24
            }
        }
    }
}
```
