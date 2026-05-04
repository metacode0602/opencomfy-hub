import { NextResponse } from "next/server"
import { z } from "zod"
import {
  getRequestId,
  liblibSignedPostJson,
} from "@/lib/liblib-openapi"


const bodySchema = z.object({
  versionUuid: z.string().min(1, "versionUuid 不能为空"),
})



/**
 * POST /api/v1/model/version
 * 代理 LibLib 查询模型版本（上游 POST /api/model/version/get）
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request)
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    console.warn(`[model version] requestId=${requestId} error=invalid_json_body`)
    return NextResponse.json(
      { error: "请求体须为 JSON", requestId },
      { status: 400 },
    )
  }
  
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      `[model version] requestId=${requestId} error=validation issues=${JSON.stringify(parsed.error.flatten())}`,
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



  const upstreamBody = { versionUuid: parsed.data.versionUuid }



  console.log(

    `[model version] requestId=${requestId} action=upstream_start versionUuidPrefix=${parsed.data.versionUuid.slice(0, 8)}…`,

  )



  const result = await liblibSignedPostJson(

    "/api/model/version/get",

    upstreamBody,

    { requestId, operation: "model_version_get" },

  )



  if (!result.ok) {

    console.warn(

      `[model version] requestId=${requestId} action=upstream_error`,

    )

    return result.response

  }



  console.log(

    `[model version] requestId=${requestId} action=upstream_ok`,

  )



  return NextResponse.json(result.json, { status: result.status })

}


