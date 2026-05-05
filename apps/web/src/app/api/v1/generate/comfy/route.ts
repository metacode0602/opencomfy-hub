import { NextResponse } from "next/server"
import { z } from "zod"

import {
  getRequestId,
  liblibSignedPostJson,
} from "@/lib/liblib-openapi"

/** 文档默认模版 UUID */
const DEFAULT_TEMPLATE_UUID = "4df2efa0f18d46dc9758803e478eb51c"

const bodySchema = z.object({
  templateUuid: z.string().min(1).optional(),
  generateParams: z.record(z.string(), z.unknown()),
})

function unwrapGenerateParams(input: Record<string, unknown>): {
  templateUuid?: string
  generateParams: Record<string, unknown>
} {
  const maybeInner = input.generateParams
  const inner =
    maybeInner &&
    typeof maybeInner === "object" &&
    !Array.isArray(maybeInner) &&
    maybeInner !== null
      ? (maybeInner as Record<string, unknown>)
      : null

  // 兼容前端/历史调用：把 { templateUuid, generateParams: {...} } 解包成 {...}
  const keys = Object.keys(input)
  const nestedTemplateUuid = input.templateUuid
  const looksLikeWrappedCall =
    keys.length === 2 &&
    keys.includes("templateUuid") &&
    keys.includes("generateParams") &&
    typeof nestedTemplateUuid === "string" &&
    !!nestedTemplateUuid.trim() &&
    !!inner

  if (looksLikeWrappedCall) {
    const templateUuid =
      typeof nestedTemplateUuid === "string" && nestedTemplateUuid.trim()
        ? nestedTemplateUuid
        : undefined
    return { templateUuid, generateParams: inner }
  }

  return { generateParams: input }
}

/**
 * POST /api/v1/generate/comfy
 * 代理调用 LibLib ComfyUI 工作流生图（上游 POST /api/generate/comfyui/app）
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    console.warn(
      `[comfy generate] requestId=${requestId} error=invalid_json_body`,
    )
    return NextResponse.json(
      { error: "请求体须为 JSON", requestId },
      { status: 400 },
    )
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      `[comfy generate] requestId=${requestId} error=validation issues=${JSON.stringify(parsed.error.flatten())}`,
    )
    return NextResponse.json(
      {
        error: "参数校验失败",
        requestId,
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  const { templateUuid: rawTemplateUuid, generateParams: rawGenerateParams } =
    parsed.data

  const unwrapped = unwrapGenerateParams(rawGenerateParams)
  const templateUuid =
    rawTemplateUuid ?? unwrapped.templateUuid ?? DEFAULT_TEMPLATE_UUID
  const generateParams = unwrapped.generateParams
  const upstreamBody = {
    templateUuid,
    generateParams,
  }
  console.warn("liblibSignedPostJson: upstreamBody", JSON.stringify(upstreamBody, null, 2))
  const result = await liblibSignedPostJson(
    "/api/generate/comfyui/app",
    upstreamBody,
    { requestId, operation: "comfy_generate" },
  )

  console.warn("liblibSignedPostJson: comfy generate result", result)

  if (!result.ok) {
    return result.response
  }

  return NextResponse.json(result.json, { status: result.status })
}
