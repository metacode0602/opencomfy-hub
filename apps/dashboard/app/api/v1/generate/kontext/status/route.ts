import { NextResponse } from "next/server"
import { z } from "zod"

import {
  getRequestId,
  liblibSignedPostJson,
} from "@/lib/liblib-openapi"

const bodySchema = z.object({
  generateUuid: z.string().min(1),
})

/**
 * POST /api/v1/generate/kontext/status
 * 查询 Kontext 等任务状态（上游 POST /api/generate/status）
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request)

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    console.warn(
      `[kontext status] requestId=${requestId} error=invalid_json_body`,
    )
    return NextResponse.json(
      { error: "请求体须为 JSON", requestId },
      { status: 400 },
    )
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      `[kontext status] requestId=${requestId} error=validation issues=${JSON.stringify(parsed.error.flatten())}`,
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

  const result = await liblibSignedPostJson(
    "/api/generate/status",
    { generateUuid: parsed.data.generateUuid },
    { requestId, operation: "kontext_status" },
  )

  if (!result.ok) {
    return result.response
  }

  return NextResponse.json(result.json, { status: result.status })
}
