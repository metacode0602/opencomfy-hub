"use client"

import { useMemo, useState } from "react"

import { ApiBaseHint } from "@/components/api-base-hint"
import { GenerateResultPanel } from "@/components/generate-result-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useGenerateJob } from "@/lib/use-generate-job"

const inputClass =
  "flex w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm font-mono outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * Wan Animate 视频动作驱动 / wan2.2 图生视频 v1.2（Comfy UI 导出模板对应 Lib 工作流）
 * 模板 ID：1c2efcff309545c0a3f57848321c0712
 *
 * 最小调用：只覆盖「参考人物图」LoadImage（节点 57）的 image URL；驱动动作视频默认使用模板内资源。
 * 若需替换动作素材，再在 generateParams 中增加节点 63（VHS_LoadVideo）的 video 等字段。
 *
 * 模板内其它常用节点（按需追加到 generateParams，不必全量提交）：
 * - 57 LoadImage：参考图 image（必填，用户上传）
 * - 63 VHS_LoadVideo：驱动视频 video / force_rate / frame_load_cap 等（可选）
 * - 204 PrimitiveStringMultiline → CLIPTextEncode 正向：提示词
 * - 205 PrimitiveStringMultiline → CLIPTextEncode 负向：负向词
 * - 222 Seed (rgthree)：随机种子（widgets 首项为整数）
 */
export const WAN_ANIMATE_COMFY_TEMPLATE_UUID = "1c2efcff309545c0a3f57848321c0712"

const DEFAULT_WAN_ANIMATE_GENERATE_PARAMS_JSON = JSON.stringify(
  {
    workflowUuid: WAN_ANIMATE_COMFY_TEMPLATE_UUID,
    "57": {
      class_type: "LoadImage",
      inputs: {
        image: "https://example.com/replace-with-your-uploaded-image.png",
      },
    },
  },
  null,
  2,
)

export default function GenerateComfyPage() {
  const { phase, submit, reset } = useGenerateJob(
    "/api/v1/generate/comfy",
    "/api/v1/generate/comfy/status",
  )

  const [templateUuid, setTemplateUuid] = useState(WAN_ANIMATE_COMFY_TEMPLATE_UUID)
  const [generateParamsJson, setGenerateParamsJson] = useState(DEFAULT_WAN_ANIMATE_GENERATE_PARAMS_JSON)

  const parsedParams = useMemo(() => {
    const t = generateParamsJson.trim()
    if (!t) return { ok: false as const, error: "请输入 generateParams JSON" }
    let v: unknown
    try {
      v = JSON.parse(t) as unknown
    } catch {
      return { ok: false as const, error: "JSON 解析失败" }
    }
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      return { ok: false as const, error: "generateParams 须为 JSON 对象" }
    }
    const keys = Object.keys(v as object)
    if (keys.length === 0) {
      return { ok: false as const, error: "generateParams 不能为空对象" }
    }
    return { ok: true as const, value: v as Record<string, unknown> }
  }, [generateParamsJson])

  const canSubmit = parsedParams.ok && phase.kind !== "running"

  function onSubmit() {
    if (!parsedParams.ok) return
    const body: Record<string, unknown> = {
      generateParams: parsedParams.value,
    }
    if (templateUuid.trim()) body.templateUuid = templateUuid.trim()
    void submit(body)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Comfy 工作流生成</h1>
          <Badge variant="outline">LibLib ComfyUI</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          对应 <code className="font-mono text-xs">POST /api/v1/generate/comfy</code>；须提供{" "}
          <code className="font-mono">generateParams</code> 对象（节点 id → 配置）。结构见{" "}
          <code className="font-mono text-xs">comfy/api.md</code>。本页已预填 Wan Animate 图生视频模板：替换{" "}
          <code className="font-mono text-xs">57.inputs.image</code> 为你的图片 URL 即可提交。
        </p>
      </div>

      <ApiBaseHint />

      <Card className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          <span className="text-destructive">*</span> 必填：有效的{" "}
          <code className="font-mono">generateParams</code> JSON。<code className="font-mono">templateUuid</code>{" "}
          与 Wan 模板一致时已预填；可清空以使用服务端默认模版。
        </p>
        <div className="space-y-2">
          <Label htmlFor="cf-tpl">templateUuid</Label>
          <Input
            id="cf-tpl"
            value={templateUuid}
            onChange={(e) => setTemplateUuid(e.target.value)}
            placeholder={`可选，默认 ${WAN_ANIMATE_COMFY_TEMPLATE_UUID}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cf-json">generateParams（JSON 对象）*</Label>
          <textarea
            id="cf-json"
            className={inputClass + " min-h-[220px]"}
            value={generateParamsJson}
            onChange={(e) => setGenerateParamsJson(e.target.value)}
            spellCheck={false}
            placeholder={DEFAULT_WAN_ANIMATE_GENERATE_PARAMS_JSON}
            required
          />
          {!parsedParams.ok && generateParamsJson.trim() ? (
            <p className="text-xs text-destructive">{parsedParams.error}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!canSubmit} onClick={onSubmit}>
            提交并轮询状态
          </Button>
          <Button type="button" variant="secondary" onClick={reset} disabled={phase.kind === "running"}>
            清空结果状态
          </Button>
        </div>
        <GenerateResultPanel phase={phase} />
      </Card>
    </div>
  )
}
