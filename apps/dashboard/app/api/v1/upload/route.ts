import { NextResponse } from "next/server"

import {
  getRequestId,
  liblibSignedPostJson,
} from "@/lib/liblib-openapi"

/** 与 LibLib 文档一致：单图最大 10MB */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png"])

type SignatureData = {
  key: string
  policy: string
  postUrl: string
  xOssDate: string
  xOssExpires: number
  xOssSignature: string
  xOssCredential: string
  xOssSignatureVersion: string
}

function extensionFromFilename(name: string): string | null {
  const i = name.lastIndexOf(".")
  if (i < 0 || i === name.length - 1) return null
  const ext = name.slice(i + 1).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null
}

function extensionFromMime(mime: string): string | null {
  const m = mime.toLowerCase().split(";")[0]?.trim()
  if (m === "image/jpeg" || m === "image/jpg") return "jpg"
  if (m === "image/png") return "png"
  return null
}

/**
 * 签名接口要求 name 非空且长度 ≤100；extension 为 jpg/png/jpeg。
 * 使用不含扩展名的安全基名作为 name。
 */
function buildUploadName(originalName: string): string {
  const base =
    originalName.replace(/[/\\]/g, "_").replace(/\.[^.]+$/, "") ||
    "upload"
  const trimmed = base.trim().slice(0, 100)
  return trimmed.length > 0 ? trimmed : "upload"
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

function parseSignatureData(json: unknown):
  | { ok: true; data: SignatureData }
  | { ok: false; message: string } {
  if (!isRecord(json)) {
    return { ok: false, message: "签名接口返回非对象" }
  }
  const code = json.code
  if (code !== 0 && code !== "0") {
    const msg =
      typeof json.msg === "string" && json.msg.length > 0
        ? json.msg
        : "生成上传签名失败"
    return { ok: false, message: msg }
  }
  const data = json.data
  if (!isRecord(data)) {
    return { ok: false, message: "签名接口缺少 data" }
  }
  const key = data.key
  const policy = data.policy
  const postUrl = data.postUrl
  const xOssDate = data.xOssDate
  const xOssExpires = data.xOssExpires
  const xOssSignature = data.xOssSignature
  const xOssCredential = data.xOssCredential
  const xOssSignatureVersion = data.xOssSignatureVersion

  if (
    typeof key !== "string" ||
    typeof policy !== "string" ||
    typeof postUrl !== "string" ||
    typeof xOssDate !== "string" ||
    typeof xOssExpires !== "number" ||
    typeof xOssSignature !== "string" ||
    typeof xOssCredential !== "string" ||
    typeof xOssSignatureVersion !== "string"
  ) {
    return { ok: false, message: "签名 data 字段不完整或类型错误" }
  }

  return {
    ok: true,
    data: {
      key,
      policy,
      postUrl,
      xOssDate,
      xOssExpires,
      xOssSignature,
      xOssCredential,
      xOssSignatureVersion,
    },
  }
}

function joinImageUrl(postUrl: string, key: string): string {
  const base = postUrl.replace(/\/+$/, "")
  const path = key.replace(/^\/+/, "")
  return `${base}/${path}`
}

/**
 * POST /api/v1/update
 * 服务端代理：获取 LibLib 上传签名并将图片 POST 到 OSS（避免浏览器直连 OSS 跨域）。
 * multipart 字段：file（必填）；可选 name 覆盖默认文件名基名（不含扩展名，≤100 字符）。
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request)
  const logPrefix = `[image upload] requestId=${requestId}`

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.warn(`${logPrefix} error=invalid_multipart detail=${detail}`)
    return NextResponse.json(
      { error: "无法解析 multipart 请求体", requestId, detail },
      { status: 400 },
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    console.warn(`${logPrefix} error=missing_file_field`)
    return NextResponse.json(
      { error: "缺少 file 字段或类型不是文件", requestId },
      { status: 400 },
    )
  }

  if (file.size <= 0) {
    console.warn(`${logPrefix} error=empty_file`)
    return NextResponse.json(
      { error: "文件为空", requestId },
      { status: 400 },
    )
  }

  if (file.size > MAX_IMAGE_BYTES) {
    console.warn(
      `${logPrefix} error=file_too_large size=${file.size} max=${MAX_IMAGE_BYTES}`,
    )
    return NextResponse.json(
      {
        error: "文件超过 10MB 限制",
        requestId,
        maxBytes: MAX_IMAGE_BYTES,
        size: file.size,
      },
      { status: 413 },
    )
  }

  const extFromName = extensionFromFilename(file.name)
  const extFromType = extensionFromMime(file.type)
  const extension = extFromName ?? extFromType
  if (!extension) {
    console.warn(
      `${logPrefix} error=unsupported_type name=${file.name} type=${file.type}`,
    )
    return NextResponse.json(
      {
        error: "仅支持 jpg、jpeg、png",
        requestId,
        hint: "请使用正确扩展名或 image/jpeg、image/png",
      },
      { status: 400 },
    )
  }

  const nameOverride = formData.get("name")
  const baseName =
    typeof nameOverride === "string" && nameOverride.trim().length > 0
      ? buildUploadName(nameOverride.trim())
      : buildUploadName(file.name)

  const signatureBody = {
    name: baseName,
    extension,
  }

  console.log(
    `${logPrefix} step=signature nameLen=${baseName.length} extension=${extension} bytes=${file.size}`,
  )

  const sigResult = await liblibSignedPostJson(
    "/api/generate/upload/signature",
    signatureBody,
    { requestId, operation: "upload_signature" },
  )

  if (!sigResult.ok) {
    return sigResult.response
  }

  const parsedSig = parseSignatureData(sigResult.json)
  if (!parsedSig.ok) {
    console.warn(`${logPrefix} error=signature_parse msg=${parsedSig.message}`)
    return NextResponse.json(
      {
        error: parsedSig.message,
        requestId,
        upstream: sigResult.json,
      },
      { status: 502 },
    )
  }

  const s = parsedSig.data
  const ossForm = new FormData()
  ossForm.append("key", s.key)
  ossForm.append("policy", s.policy)
  ossForm.append("x-oss-date", s.xOssDate)
  ossForm.append("x-oss-expires", String(s.xOssExpires))
  ossForm.append("x-oss-signature", s.xOssSignature)
  ossForm.append("x-oss-credential", s.xOssCredential)
  ossForm.append("x-oss-signature-version", s.xOssSignatureVersion)
  ossForm.append("file", file, file.name || `upload.${extension}`)

  const uploadStarted = Date.now()
  try {
    const ossRes = await fetch(s.postUrl, {
      method: "POST",
      body: ossForm,
      headers: {
        "User-Agent": "opencomfy-dashboard/1.0",
      },
    })
    const uploadElapsed = Date.now() - uploadStarted
    const ossText = await ossRes.text()

    if (!ossRes.ok) {
      console.error(
        `${logPrefix} error=oss_upload_http status=${ossRes.status} elapsedMs=${uploadElapsed} bodySnippet=${ossText.slice(0, 800)}`,
      )
      return NextResponse.json(
        {
          error: "上传到 OSS 失败",
          requestId,
          upstreamStatus: ossRes.status,
          detail: ossText.slice(0, 2000),
        },
        { status: 502 },
      )
    }

    const imageUrl = joinImageUrl(s.postUrl, s.key)
    console.log(
      `${logPrefix} step=oss_ok elapsedMs=${uploadElapsed} imageUrlLen=${imageUrl.length}`,
    )

    return NextResponse.json({
      requestId,
      imageUrl,
      key: s.key,
      postUrl: s.postUrl.replace(/\/+$/, ""),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `${logPrefix} error=oss_fetch_failed elapsedMs=${Date.now() - uploadStarted} detail=${message}`,
    )
    return NextResponse.json(
      {
        error: "上传 OSS 时网络异常",
        requestId,
        detail: message,
      },
      { status: 502 },
    )
  }
}
