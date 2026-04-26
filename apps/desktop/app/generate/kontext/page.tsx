"use client"

import { useMemo, useState } from "react"

import { ApiBaseHint } from "@/components/api-base-hint"
import { GenerateResultPanel } from "@/components/generate-result-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useGenerateJob } from "@/lib/use-generate-job"

const ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "9:21",
  "21:9",
] as const

const inputClass =
  "flex min-h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function parseIntField(s: string, fallback: number): number {
  const t = s.trim()
  if (!t) return fallback
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : fallback
}

function parseFloatField(s: string, fallback: number): number {
  const t = s.trim()
  if (!t) return fallback
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : fallback
}

function isValidHttpUrl(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  try {
    const u = new URL(t)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

function parseImageList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 4)
}

export default function GenerateKontextPage() {
  const { phase, submit, reset } = useGenerateJob(
    "/api/v1/generate/kontext/text2img",
    "/api/v1/generate/kontext/status",
  )
  const { phase: phaseImg, submit: submitImg, reset: resetImg } = useGenerateJob(
    "/api/v1/generate/kontext/img2img",
    "/api/v1/generate/kontext/status",
  )

  const [t2i, setT2i] = useState({
    templateUuid: "",
    prompt: "",
    model: "" as "" | "pro" | "max",
    aspectRatio: "1:1" as (typeof ASPECT_RATIOS)[number],
    imgCount: "1",
    guidance_scale: "3.5",
  })

  const [i2i, setI2i] = useState({
    templateUuid: "",
    prompt: "",
    imageUrls: "",
    model: "" as "" | "pro" | "max",
    aspectRatio: "1:1" as (typeof ASPECT_RATIOS)[number],
    imgCount: "1",
    guidance_scale: "3.5",
  })

  const canSubmitTxt = useMemo(() => t2i.prompt.trim().length > 0, [t2i.prompt])

  const canSubmitImg = useMemo(() => {
    if (i2i.prompt.trim().length === 0) return false
    const urls = parseImageList(i2i.imageUrls)
    if (urls.length < 1) return false
    return urls.every(isValidHttpUrl)
  }, [i2i.prompt, i2i.imageUrls])

  const busyTxt = phase.kind === "running"
  const busyImg = phaseImg.kind === "running"
  const anyBusy = busyTxt || busyImg

  function buildTxtBody(): Record<string, unknown> {
    const generateParams: Record<string, unknown> = {
      prompt: t2i.prompt.trim(),
      aspectRatio: t2i.aspectRatio,
      imgCount: parseIntField(t2i.imgCount, 1),
      guidance_scale: parseFloatField(t2i.guidance_scale, 3.5),
    }
    if (t2i.model) generateParams.model = t2i.model
    const body: Record<string, unknown> = { generateParams }
    if (t2i.templateUuid.trim()) body.templateUuid = t2i.templateUuid.trim()
    return body
  }

  function buildImgBody(): Record<string, unknown> {
    const image_list = parseImageList(i2i.imageUrls)
    const generateParams: Record<string, unknown> = {
      prompt: i2i.prompt.trim(),
      image_list,
      aspectRatio: i2i.aspectRatio,
      imgCount: parseIntField(i2i.imgCount, 1),
      guidance_scale: parseFloatField(i2i.guidance_scale, 3.5),
    }
    if (i2i.model) generateParams.model = i2i.model
    const body: Record<string, unknown> = { generateParams }
    if (i2i.templateUuid.trim()) body.templateUuid = i2i.templateUuid.trim()
    return body
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">Kontext（F.1）生成</h1>
          <Badge variant="outline">LibLib Kontext</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          对应 <code className="font-mono text-xs">kontext/text2img</code> 与{" "}
          <code className="font-mono text-xs">kontext/img2img</code>；校验规则与 dashboard 路由及{" "}
          <code className="font-mono text-xs">kontext/api.md</code> 一致。
        </p>
      </div>

      <ApiBaseHint />

      <Tabs defaultValue="text2img" className="gap-4">
        <TabsList>
          <TabsTrigger value="text2img">文生图</TabsTrigger>
          <TabsTrigger value="img2img">图生图</TabsTrigger>
        </TabsList>

        <TabsContent value="text2img">
          <Card className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="text-destructive">*</span> 必填：<code className="font-mono">prompt</code>
              （≤2000 字）。其余选填；未填 <code className="font-mono">templateUuid</code> 时使用服务端默认模版。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="kt-prompt">prompt *</Label>
                <textarea
                  id="kt-prompt"
                  className={inputClass + " min-h-[100px] py-2"}
                  value={t2i.prompt}
                  onChange={(e) => setT2i((s) => ({ ...s, prompt: e.target.value }))}
                  maxLength={2000}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="kt-tpl">templateUuid</Label>
                <Input
                  id="kt-tpl"
                  value={t2i.templateUuid}
                  onChange={(e) => setT2i((s) => ({ ...s, templateUuid: e.target.value }))}
                  placeholder="可选；默认 fe9928f…（服务端）"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kt-model">model</Label>
                <select
                  id="kt-model"
                  className={inputClass + " h-8 py-0"}
                  value={t2i.model}
                  onChange={(e) =>
                    setT2i((s) => ({
                      ...s,
                      model: e.target.value as "" | "pro" | "max",
                    }))
                  }
                >
                  <option value="">（不指定，由上游默认）</option>
                  <option value="pro">pro</option>
                  <option value="max">max</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kt-ar">aspectRatio</Label>
                <select
                  id="kt-ar"
                  className={inputClass + " h-8 py-0"}
                  value={t2i.aspectRatio}
                  onChange={(e) =>
                    setT2i((s) => ({
                      ...s,
                      aspectRatio: e.target.value as (typeof ASPECT_RATIOS)[number],
                    }))
                  }
                >
                  {ASPECT_RATIOS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="kt-n">imgCount（1–4）</Label>
                <Input
                  id="kt-n"
                  inputMode="numeric"
                  value={t2i.imgCount}
                  onChange={(e) => setT2i((s) => ({ ...s, imgCount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kt-g">guidance_scale（1–20）</Label>
                <Input
                  id="kt-g"
                  inputMode="decimal"
                  value={t2i.guidance_scale}
                  onChange={(e) => setT2i((s) => ({ ...s, guidance_scale: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!canSubmitTxt || anyBusy}
                onClick={() => void submit(buildTxtBody())}
              >
                提交并轮询状态
              </Button>
              <Button type="button" variant="secondary" onClick={reset} disabled={busyTxt}>
                清空结果状态
              </Button>
            </div>
            <GenerateResultPanel phase={phase} />
          </Card>
        </TabsContent>

        <TabsContent value="img2img">
          <Card className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="text-destructive">*</span> 必填：<code className="font-mono">prompt</code>、
              <code className="font-mono">image_list</code>（每行一个公网图片 URL，1–4 行）。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ki-prompt">prompt *</Label>
                <textarea
                  id="ki-prompt"
                  className={inputClass + " min-h-[88px] py-2"}
                  value={i2i.prompt}
                  onChange={(e) => setI2i((s) => ({ ...s, prompt: e.target.value }))}
                  maxLength={2000}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ki-urls">参考图 URL（每行一条）*</Label>
                <textarea
                  id="ki-urls"
                  className={inputClass + " min-h-[120px] py-2 font-mono text-xs"}
                  value={i2i.imageUrls}
                  onChange={(e) => setI2i((s) => ({ ...s, imageUrls: e.target.value }))}
                  placeholder={"https://...\nhttps://..."}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ki-tpl">templateUuid</Label>
                <Input
                  id="ki-tpl"
                  value={i2i.templateUuid}
                  onChange={(e) => setI2i((s) => ({ ...s, templateUuid: e.target.value }))}
                  placeholder="可选；默认 1c0a9712…（服务端）"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ki-model">model</Label>
                <select
                  id="ki-model"
                  className={inputClass + " h-8 py-0"}
                  value={i2i.model}
                  onChange={(e) =>
                    setI2i((s) => ({
                      ...s,
                      model: e.target.value as "" | "pro" | "max",
                    }))
                  }
                >
                  <option value="">（不指定）</option>
                  <option value="pro">pro</option>
                  <option value="max">max</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ki-ar">aspectRatio</Label>
                <select
                  id="ki-ar"
                  className={inputClass + " h-8 py-0"}
                  value={i2i.aspectRatio}
                  onChange={(e) =>
                    setI2i((s) => ({
                      ...s,
                      aspectRatio: e.target.value as (typeof ASPECT_RATIOS)[number],
                    }))
                  }
                >
                  {ASPECT_RATIOS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ki-n">imgCount</Label>
                <Input
                  id="ki-n"
                  inputMode="numeric"
                  value={i2i.imgCount}
                  onChange={(e) => setI2i((s) => ({ ...s, imgCount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ki-g">guidance_scale</Label>
                <Input
                  id="ki-g"
                  inputMode="decimal"
                  value={i2i.guidance_scale}
                  onChange={(e) => setI2i((s) => ({ ...s, guidance_scale: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!canSubmitImg || anyBusy}
                onClick={() => void submitImg(buildImgBody())}
              >
                提交并轮询状态
              </Button>
              <Button type="button" variant="secondary" onClick={resetImg} disabled={busyImg}>
                清空结果状态
              </Button>
            </div>
            <GenerateResultPanel phase={phaseImg} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
