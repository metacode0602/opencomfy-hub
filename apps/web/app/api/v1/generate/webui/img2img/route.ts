import { NextResponse } from "next/server"
import { z } from "zod"

import {
  getRequestId,
  liblibSignedPostJson,
} from "@/lib/liblib-openapi"

const generateParamsSchema = z
  .record(z.string(), z.unknown())
  .refine((v) => Object.prototype.toString.call(v) === "[object Object]", {
    message: "generateParams 须为 JSON 对象",
  })

const bodySchema = z.object({
  templateUuid: z.string().min(1).optional(),
  generateParams: generateParamsSchema,
})

/**
 * POST /api/v1/generate/webui/img2img
 * 代理 LibLib WebUI 图生图（上游 POST /api/generate/webui/img2img）
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    console.warn(
      `[webui img2img] requestId=${requestId} error=invalid_json_body`,
    )
    return NextResponse.json(
      { error: "请求体须为 JSON", requestId },
      { status: 400 },
    )
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      `[webui img2img] requestId=${requestId} error=validation issues=${JSON.stringify(parsed.error.flatten())}`,
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

  const upstreamBody: Record<string, unknown> = {
    generateParams: parsed.data.generateParams,
  }
  if (parsed.data.templateUuid !== undefined) {
    upstreamBody.templateUuid = parsed.data.templateUuid
  }

  console.log(
    `[webui img2img] requestId=${requestId} action=upstream_start hasTemplate=${Boolean(parsed.data.templateUuid)}`,
  )

  const result = await liblibSignedPostJson(
    "/api/generate/webui/img2img",
    upstreamBody,
    { requestId, operation: "webui_img2img" },
  )

  if (!result.ok) {
    console.warn(
      `[webui img2img] requestId=${requestId} action=upstream_error`,
    )
    return result.response
  }

  console.log(
    `[webui img2img] requestId=${requestId} action=upstream_ok`,
  )

  return NextResponse.json(result.json, { status: result.status })
}
