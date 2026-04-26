"use client"

import { getOpencomfyApiBase } from "@/lib/opencomfy-api-client"

export function ApiBaseHint() {
  return (
    <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
      <p>
        请求基址：{" "}
        <span className="font-mono text-foreground">{getOpencomfyApiBase()}</span>
        （<code className="font-mono">NEXT_PUBLIC_OPENCOMFY_API_BASE</code>）
      </p>
      <p className="mt-2">需启动 dashboard 并配置 LibLib 开放平台凭证。</p>
    </div>
  )
}
