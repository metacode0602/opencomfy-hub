import { createHmac, randomInt } from "node:crypto"

import { NextResponse } from "next/server"

const DEFAULT_BASE_URL = "https://openapi.liblibai.cloud"

const NONCE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

function randomNonce(length: number): string {
  let result = ""
  for (let i = 0; i < length; i++) {
    result += NONCE_CHARS[randomInt(NONCE_CHARS.length)]
  }
  return result
}

/**
 * LibLib OpenAPI URL 签名（与官方 liblibai SDK 一致）
 * @see https://unpkg.com/liblibai@0.0.11/dist/esm/utils.js
 */
export function buildSignedLiblibUrl(
  apiPath: string,
  apiKey: string,
  apiSecret: string,
  baseURL: string,
): string {
  const path = apiPath.startsWith("/") ? apiPath : `/${apiPath}`
  const timestamp = Date.now()
  const signatureNonce = randomNonce(16)
  const signPlain = `${path}&${timestamp}&${signatureNonce}`
  const hash = createHmac("sha1", apiSecret)
    .update(signPlain, "utf8")
    .digest("base64")
  const signature = hash
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  const root = baseURL.replace(/\/$/, "")
  return `${root}${path}?AccessKey=${encodeURIComponent(apiKey)}&Signature=${encodeURIComponent(signature)}&Timestamp=${timestamp}&SignatureNonce=${encodeURIComponent(signatureNonce)}`
}

export function getLiblibOpenapiConfig():
  | { ok: true; apiKey: string; apiSecret: string; baseURL: string }
  | { ok: false } {
  const apiKey = process.env.LIBLIB_API_KEY
  const apiSecret = process.env.LIBLIB_API_SECRET
  if (!apiKey?.trim() || !apiSecret?.trim()) {
    return { ok: false }
  }
  const base =
    process.env.LIBLIB_OPENAPI_BASE_URL?.trim() || DEFAULT_BASE_URL
  return { ok: true, apiKey, apiSecret, baseURL: base }
}

export type LiblibPostResult =
  | { ok: true; status: number; json: unknown }
  | { ok: false; response: NextResponse }

/**
 * 带签名的 POST JSON，统一日志与错误映射。
 */
export async function liblibSignedPostJson(
  apiPath: string,
  body: Record<string, unknown>,
  ctx: { requestId: string; operation: string },
): Promise<LiblibPostResult> {
  const cfg = getLiblibOpenapiConfig()
  if (!cfg.ok) {
    console.error(
      `[liblib-openapi] op=${ctx.operation} requestId=${ctx.requestId} error=missing_credentials`,
    )
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "服务端未配置 LibLib 凭证：请设置 LIBLIB_API_KEY 与 LIBLIB_API_SECRET",
          requestId: ctx.requestId,
        },
        { status: 503 },
      ),
    }
  }

  const url = buildSignedLiblibUrl(
    apiPath,
    cfg.apiKey,
    cfg.apiSecret,
    cfg.baseURL,
  )
  const started = Date.now()

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "opencomfy-dashboard/1.0",
      },
      body: JSON.stringify(body),
    })
    const elapsedMs = Date.now() - started
    const text = await res.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text) as unknown
      } catch {
        json = null
      }
    }

    if (!res.ok) {
      console.error(
        `[liblib-openapi] op=${ctx.operation} requestId=${ctx.requestId} upstreamHttp=${res.status} elapsedMs=${elapsedMs} bodySnippet=${text.slice(0, 800)}`,
      )
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "LibLib 开放平台返回错误",
            requestId: ctx.requestId,
            upstreamStatus: res.status,
            ...(json !== null && typeof json === "object"
              ? { upstream: json }
              : { raw: text.slice(0, 2000) }),
          },
          { status: res.status >= 500 ? 502 : res.status },
        ),
      }
    }

    if (json !== null && typeof json === "object" && "code" in json) {
      const code = (json as { code: unknown }).code
      if (code !== 0 && code !== "0") {
        console.warn(
          `[liblib-openapi] op=${ctx.operation} requestId=${ctx.requestId} upstreamBusinessCode=${String(code)} elapsedMs=${elapsedMs}`,
        )
      } else {
        console.log(
          `[liblib-openapi] op=${ctx.operation} requestId=${ctx.requestId} upstreamHttp=${res.status} elapsedMs=${elapsedMs} businessCode=0`,
        )
      }
    } else {
      console.log(
        `[liblib-openapi] op=${ctx.operation} requestId=${ctx.requestId} upstreamHttp=${res.status} elapsedMs=${elapsedMs}`,
      )
    }

    return { ok: true, status: res.status, json }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `[liblib-openapi] op=${ctx.operation} requestId=${ctx.requestId} error=fetch_failed detail=${message}`,
    )
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "无法连接 LibLib 开放平台",
          requestId: ctx.requestId,
          detail: message,
        },
        { status: 502 },
      ),
    }
  }
}

export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID()
}
