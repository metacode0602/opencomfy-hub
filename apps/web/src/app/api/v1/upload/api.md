# LiblibAI API 文件上传文档

## 概述

本文档介绍如何使用LiblibAI API进行文件上传操作，主要分为三个步骤：
1. 生成上传签名
2. 上传本地文件到OSS
3. 在生图参数中使用上传的图片

## 1. 生成PostObject签名

### 接口信息
- **方法**: `POST`
- **URL**: `/api/generate/upload/signature`
- **认证**: 使用AK/SK签名逻辑

### 请求参数
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 文件名，不能为空，长度不超过100字符 |
| extension | string | 是 | 文件扩展名，仅支持：`jpg`, `png`, `jpeg` |

### 请求示例
```json
{
    "name": "example_image",
    "extension": "jpg"
}
```

### 响应参数
| 参数 | 类型 | 说明 |
|------|------|------|
| code | int | 状态码，0表示成功 |
| msg | string | 错误消息 |
| data.key | string | 上传文件的键值 |
| data.policy | string | 上传策略Base64编码 |
| data.postUrl | string | 上传目标URL |
| data.xOssDate | string | OSS日期 |
| data.xOssExpires | int | 过期时间（秒） |
| data.xOssSignature | string | OSS签名 |
| data.xOssCredential | string | OSS凭证 |
| data.xOssSignatureVersion | string | 签名版本 |

### 响应示例
```json
{
    "code": 0,
    "data": {
        "key": "aliyun-cn-test/a0d9244a5ea14465955faf6b178240b8.png",
        "policy": "eyJleHBpcmF0aW9uIjoiMjAyNS0wNC0wOVQxNDo0MzoyOS45NDhaIiwiY29uZGl0aW9ucyI6W1siY29udGVudC1sZW5ndGgtcmFuZ2UiLDEsMjA5NzE1MjBdLFsiaW4iLCIkY29udGVudC10eXBlIixbInZpZGVvL21wNCIsInZpZGVvL3gtbTR2IiwidmlkZW8vd2VibSJdXSx7ImJ1Y2tldCI6ImxpYmxpYmFpLWFpcnNoaXAtdGVtcCJ9LHsieC1vc3Mtc2lnbmF0dXJlLXZlcnNpb24iOiJPU1M0LUhNQUMtU0hBMjU2In0seyJ4LW9zcy1kYXRlIjoiMjAyNTA0MDlUMTM0MzI5WiJ9LHsieC1vc3MtY3JlZGVudGlhbCI6IkxUQUk1dEx1WGo0TUg0WGhucEtCam5zWS8yMDI1MDQwOS9jbi1iZWlqaW5nL29zcy9hbGl5dW5fdjRfcmVxdWVzdCJ9XX0=",
        "postUrl": "https://liblibai-airship-temp.oss-cn-beijing.aliyuncs.com",
        "xOssDate": "20250409T134329Z",
        "xOssExpires": 3600,
        "xOssSignature": "22349dd272560cd303ac15a9fcef6572c94d9c59db29f942772c6b2f08e2f0d8",
        "xOssCredential": "LTAI5tLuXj4MH4XhnpKBjnsY/20250409/cn-beijing/oss/aliyun_v4_request",
        "xOssSignatureVersion": "OSS4-HMAC-SHA256"
    },
    "msg": ""
}
```

### 注意事项
- 图片大小不能超过10MB
- name字段不能为空，长度不能超过100字符
- extension仅支持jpg、png、jpeg格式

## 2. 上传本地文件

### 上传方式
- 通过POST表单上传
- 上传地址使用签名接口返回的`postUrl`
- 签名过期时间为1小时，必须在1小时内完成上传

### 表单字段顺序要求
- 所有参数字段必须按以下顺序添加：
  - `key`
  - `policy`
  - `x-oss-date`
  - `x-oss-expires`
  - `x-oss-signature`
  - `x-oss-credential`
  - `x-oss-signature-version`
  - `file`（必须是最后一个字段）

### 限制条件
- 浏览器页面无法直接上传（存在跨域问题）
- 文件扩展名必须与生成签名时使用的extension一致
- file字段必须放在表单最后

## 3. 代码示例

### Java 示例
```java
HttpHeaders headers = new HttpHeaders();
headers.setContentType(MediaType.parseMediaType("multipart/form-data"));

MultiValueMap<String, Object> params = new LinkedMultiValueMap<>();
params.add("key", key);
params.add("policy", policy);
params.add("x-oss-date", xOssDate);
params.add("x-oss-expires", xOssExpires);
params.add("x-oss-signature", xOssSignature);
params.add("x-oss-credential", xOssCredential);
params.add("x-oss-signature-version", xOssSignatureVersion);
params.add("file", new FileSystemResource("/Users/xxx/Downloads/1743155076031.jpg"));

ResponseEntity<String> response = new RestTemplate().exchange(postUrl, HttpMethod.POST, new HttpEntity<>(params, headers), String.class);
System.out.println(JSON.toJSONString(response));
```

### Python 示例
```python
import requests

data = {
    'key': key,
    'policy': policy,
    'x-oss-date': xOssDate,
    'x-oss-expires': xOssExpires,
    'x-oss-signature': xOssSignature,
    'x-oss-credential': xOssCredential,
    'x-oss-signature-version': xOssSignatureVersion,
}

files = {'file': ('20250415-170009.jpg', open('/Users/zhuanzmima0000/Downloads/20250415-170009.jpg', 'rb'), 'image/jpg')}

response = requests.post(postUrl, data=data, files=files)
print(f"Status Code: {response.status_code}")
```

## 4. 在生图参数中使用上传的图片

### 使用场景
当需要在图像生成中使用上传的图片作为源图片时。

### 图片地址构成规则
- **格式**: `{postUrl}/{key}`
- **示例**: 
  - postUrl: `https://liblibai-airship-temp.oss-cn-beijing.aliyuncs.com`
  - key: `aliyun-cn-prod/a0d9244a5ea14465955faf6b178240b8.png`
  - 完整URL: `https://liblibai-airship-temp.oss-cn-beijing.aliyuncs.com/aliyun-cn-prod/a0d9244a5ea14465955faf6b178240b8.png`

### 请求示例
```json
{
    "templateUuid": "07e00af4fc464c7ab55ff906f8acf1b7",
    "generateParams": {
        "prompt": "girl with beautiful face, beautiful and aesthetic",
        "imgCount": 1,
        "sourceImage": "https://liblibai-airship-temp.oss-cn-beijing.aliyuncs.com/aliyun-cn-prod/a0d9244a5ea14465955faf6b178240b8.png"
    }
}
```

### 注意事项
- 必须先完成文件上传成功后才能使用
- sourceImage参数值应为完整的图片URL地址
- 图片URL由postUrl和key拼接而成

### 本仓库：`POST /api/v1/upload` 与 Comfy 工作流

服务端代理上传完成后，响应 JSON 中会包含：

| 字段 | 说明 |
|------|------|
| `imageUrl` | 已按 `{postUrl}/{key}` 规则拼好的完整可访问 URL，可直接用于生图 |
| `postUrl` | OSS 根地址（无末尾 `/`） |
| `key` | 对象键（可含路径前缀，如 `aliyun-cn-prod/xxx.png`） |

在 **Comfy 工作流**（例如 `POST /api/v1/generate/comfy`）中，应将上述**完整图片 URL** 写入对应节点的 `inputs.image`（如 `LoadImage` 节点），例如：

```json
{
  "templateUuid": "<模版 UUID>",
  "generateParams": {
    "33": {
      "class_type": "LoadImage",
      "inputs": {
        "image": "https://liblibai-airship-temp.oss-cn-beijing.aliyuncs.com/aliyun-cn-prod/a0d9244a5ea14465955faf6b178240b8.png"
      }
    },
    "workflowUuid": "<工作流 UUID>"
  }
}
```

其中 `inputs.image` 的值须与上传结果中的 `imageUrl`（或自行拼接的 `{postUrl}/{key}`）一致，且为带协议的完整 URL。

## 错误处理

常见错误情况：
- 文件过大（超过10MB）
- 文件格式不支持
- 签名已过期（超过1小时）
- 文件扩展名与生成签名时不一致
- 表单字段顺序错误