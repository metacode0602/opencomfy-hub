import { NextResponse } from "next/server"
import { z } from "zod"

import {
  getRequestId,
  liblibSignedPostJson,
} from "@/lib/liblib-openapi"

/** 文档固定模版 UUID（图生图） */
const DEFAULT_TEMPLATE_UUID = "1c0a9712b3d84e1b8a9f49514a46d88c"

const aspectRatioSchema = z.enum([
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "9:21",
  "21:9",
])

const modelSchema = z.enum(["pro", "max"])

const generateParamsSchema = z.object({
  model: modelSchema.optional(),
  prompt: z.string().min(1, "prompt 不能为空").max(2000),
  image_list: z
    .array(z.string().min(1, "参考图 URL 不能为空").url("参考图须为有效 URL"))
    .min(1, "至少需要 1 张参考图")
    .max(4, "参考图最多 4 张"),
  aspectRatio: aspectRatioSchema.optional(),
  imgCount: z.number().int().min(1).max(4).optional(),
  guidance_scale: z.number().min(1).max(20).optional(),
})

const bodySchema = z.object({
  templateUuid: z.string().min(1).optional(),
  generateParams: generateParamsSchema,
})

/**
 * POST /api/v1/generate/kontext/img2img
 * 代理 LibLib F.1 Kontext 图生图（上游 POST /api/generate/kontext/img2img）
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    console.warn(
      `[kontext img2img] requestId=${requestId} error=invalid_json_body`,
    )
    return NextResponse.json(
      { error: "请求体须为 JSON", requestId },
      { status: 400 },
    )
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      `[kontext img2img] requestId=${requestId} error=validation issues=${JSON.stringify(parsed.error.flatten())}`,
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

  const { templateUuid, generateParams } = parsed.data
  const upstreamBody = {
    templateUuid: templateUuid ?? DEFAULT_TEMPLATE_UUID,
    generateParams,
  }

  console.log(
    `[kontext img2img] requestId=${requestId} action=upstream_start templateUuid=${upstreamBody.templateUuid} imageCount=${generateParams.image_list.length}`,
  )

  const result = await liblibSignedPostJson(
    "/api/generate/kontext/img2img",
    upstreamBody as Record<string, unknown>,
    { requestId, operation: "kontext_img2img" },
  )

  if (!result.ok) {
    console.warn(
      `[kontext img2img] requestId=${requestId} action=upstream_error`,
    )
    return result.response
  }

  console.log(
    `[kontext img2img] requestId=${requestId} action=upstream_ok`,
  )

  return NextResponse.json(result.json, { status: result.status })
}
