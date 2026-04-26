/**
 * 调用 dashboard 上的 `/api/v1/generate/*`（需与 LibLib 凭证配合）。
 * 默认 `http://localhost:3000`，可通过 NEXT_PUBLIC_OPENCOMFY_API_BASE 覆盖。
 */
export function getOpencomfyApiBase(): string {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_OPENCOMFY_API_BASE?.trim()
      : ""
  return raw && raw.length > 0 ? raw.replace(/\/$/, "") : "http://localhost:3000"
}

export function unwrapLiblibPayload(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null
  const o = json as Record<string, unknown>
  if (o.data !== undefined && typeof o.data === "object" && o.data !== null) {
    return o.data as Record<string, unknown>
  }
  return o
}

export function pickGenerateUuid(json: unknown): string | null {
  const p = unwrapLiblibPayload(json)
  if (!p) return null
  const u = p.generateUuid
  return typeof u === "string" && u.length > 0 ? u : null
}

/** LibLib 任务状态：5 成功，6 失败；1–4 为进行中/排队等 */
export function pickGenerateStatus(json: unknown): number | null {
  const p = unwrapLiblibPayload(json)
  if (!p) return null
  const s = p.generateStatus
  return typeof s === "number" ? s : null
}

export function pickGenerateMessage(json: unknown): string | undefined {
  const p = unwrapLiblibPayload(json)
  if (!p) return undefined
  const m = p.generateMsg
  return typeof m === "string" ? m : undefined
}

export type ResultMedia =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; coverUrl?: string }

export function extractResultMedia(json: unknown): ResultMedia[] {
  const p = unwrapLiblibPayload(json)
  if (!p) return []
  const out: ResultMedia[] = []

  const images = p.images
  if (Array.isArray(images)) {
    for (const item of images) {
      if (!item || typeof item !== "object") continue
      const url = (item as { imageUrl?: unknown }).imageUrl
      if (typeof url === "string" && url.length > 0) {
        out.push({ kind: "image", url })
      }
    }
  }

  const videos = p.videos
  if (Array.isArray(videos)) {
    for (const item of videos) {
      if (!item || typeof item !== "object") continue
      const rec = item as { videoUrl?: unknown; coverPath?: unknown }
      const url = rec.videoUrl
      if (typeof url === "string" && url.length > 0) {
        const cover =
          typeof rec.coverPath === "string" && rec.coverPath.length > 0
            ? rec.coverPath
            : undefined
        out.push({ kind: "video", url, coverUrl: cover })
      }
    }
  }

  return out
}

export async function postJson<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; status: number; text: string }> {
  const base = getOpencomfyApiBase()
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: unknown = text
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = { raw: text }
    }
  }
  if (!res.ok) {
    return { ok: false, status: res.status, text: text.slice(0, 4000) }
  }
  return { ok: true, data: data as T }
}
