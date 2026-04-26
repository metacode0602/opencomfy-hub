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

export default function GenerateWebuiPage() {
  const { phase, submit, reset } = useGenerateJob(
    "/api/v1/generate/webui/txt2img",
    "/api/v1/generate/webui/status",
  )
  const { phase: phaseImg, submit: submitImg, reset: resetImg } = useGenerateJob(
    "/api/v1/generate/webui/img2img",
    "/api/v1/generate/webui/status",
  )

  const [tab, setTab] = useState("txt2img")

  const [t2i, setT2i] = useState({
    templateUuid: "",
    checkPointId: "",
    prompt: "",
    negativePrompt: "",
    sampler: "15",
    steps: "20",
    cfgScale: "7",
    width: "512",
    height: "768",
    imgCount: "1",
    seed: "-1",
    restoreFaces: "0",
  })

  const [i2i, setI2i] = useState({
    templateUuid: "",
    checkPointId: "",
    prompt: "",
    negativePrompt: "",
    sourceImage: "",
    sampler: "15",
    steps: "24",
    cfgScale: "6.5",
    width: "768",
    height: "768",
    imgCount: "1",
    seed: "-1",
    restoreFaces: "0",
    resizeMode: "1",
    mode: "0",
    denoisingStrength: "0.45",
  })

  const canSubmitTxt = useMemo(() => {
    if (t2i.checkPointId.trim().length === 0) return false
    if (t2i.prompt.trim().length === 0) return false
    return true
  }, [t2i])

  const canSubmitImg = useMemo(() => {
    if (i2i.checkPointId.trim().length === 0) return false
    if (i2i.prompt.trim().length === 0) return false
    if (!isValidHttpUrl(i2i.sourceImage)) return false
    return true
  }, [i2i])

  const busyTxt = phase.kind === "running"
  const busyImg = phaseImg.kind === "running"
  const anyBusy = busyTxt || busyImg

  function buildTxtBody(): Record<string, unknown> {
    const generateParams: Record<string, unknown> = {
      checkPointId: t2i.checkPointId.trim(),
      prompt: t2i.prompt.trim(),
      negativePrompt: t2i.negativePrompt.trim() || " ",
      sampler: parseIntField(t2i.sampler, 15),
      steps: parseIntField(t2i.steps, 20),
      cfgScale: parseFloatField(t2i.cfgScale, 7),
      width: parseIntField(t2i.width, 512),
      height: parseIntField(t2i.height, 768),
      imgCount: parseIntField(t2i.imgCount, 1),
      seed: parseIntField(t2i.seed, -1),
      restoreFaces: parseIntField(t2i.restoreFaces, 0),
    }
    const body: Record<string, unknown> = { generateParams }
    if (t2i.templateUuid.trim()) body.templateUuid = t2i.templateUuid.trim()
    return body
  }

  function buildImgBody(): Record<string, unknown> {
    const generateParams: Record<string, unknown> = {
      checkPointId: i2i.checkPointId.trim(),
      prompt: i2i.prompt.trim(),
      negativePrompt: i2i.negativePrompt.trim() || " ",
      sampler: parseIntField(i2i.sampler, 15),
      steps: parseIntField(i2i.steps, 24),
      cfgScale: parseFloatField(i2i.cfgScale, 6.5),
      width: parseIntField(i2i.width, 768),
      height: parseIntField(i2i.height, 768),
      imgCount: parseIntField(i2i.imgCount, 1),
      seed: parseIntField(i2i.seed, -1),
      restoreFaces: parseIntField(i2i.restoreFaces, 0),
      sourceImage: i2i.sourceImage.trim(),
      resizeMode: parseIntField(i2i.resizeMode, 1),
      mode: parseIntField(i2i.mode, 0),
      denoisingStrength: parseFloatField(i2i.denoisingStrength, 0.45),
    }
    const body: Record<string, unknown> = { generateParams }
    if (i2i.templateUuid.trim()) body.templateUuid = i2i.templateUuid.trim()
    return body
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">WebUI 生成</h1>
            <Badge variant="outline">LibLib WebUI</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            对应{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              POST /api/v1/generate/webui/txt2img
            </code>{" "}
            与{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">
              …/img2img
            </code>
            ；参数形态与 dashboard 内 <code className="font-mono text-xs">webui/api.md</code> 一致。
          </p>
        </div>
      </div>

      <ApiBaseHint />

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="txt2img">文生图</TabsTrigger>
          <TabsTrigger value="img2img">图生图</TabsTrigger>
        </TabsList>

        <TabsContent value="txt2img">
          <Card className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="text-destructive">*</span> 为必填：<code className="font-mono">checkPointId</code>、
              <code className="font-mono">prompt</code>。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="t2i-check">checkPointId（底模 ID）*</Label>
                <Input
                  id="t2i-check"
                  value={t2i.checkPointId}
                  onChange={(e) => setT2i((s) => ({ ...s, checkPointId: e.target.value }))}
                  placeholder="模型版本 UUID"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="t2i-prompt">prompt *</Label>
                <textarea
                  id="t2i-prompt"
                  className={inputClass + " min-h-[100px] py-2"}
                  value={t2i.prompt}
                  onChange={(e) => setT2i((s) => ({ ...s, prompt: e.target.value }))}
                  placeholder="正向提示词"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="t2i-neg">negativePrompt</Label>
                <textarea
                  id="t2i-neg"
                  className={inputClass + " min-h-[72px] py-2"}
                  value={t2i.negativePrompt}
                  onChange={(e) => setT2i((s) => ({ ...s, negativePrompt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-tpl">templateUuid</Label>
                <Input
                  id="t2i-tpl"
                  value={t2i.templateUuid}
                  onChange={(e) => setT2i((s) => ({ ...s, templateUuid: e.target.value }))}
                  placeholder="可选"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-sampler">sampler</Label>
                <Input
                  id="t2i-sampler"
                  inputMode="numeric"
                  value={t2i.sampler}
                  onChange={(e) => setT2i((s) => ({ ...s, sampler: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-steps">steps</Label>
                <Input
                  id="t2i-steps"
                  inputMode="numeric"
                  value={t2i.steps}
                  onChange={(e) => setT2i((s) => ({ ...s, steps: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-cfg">cfgScale</Label>
                <Input
                  id="t2i-cfg"
                  inputMode="decimal"
                  value={t2i.cfgScale}
                  onChange={(e) => setT2i((s) => ({ ...s, cfgScale: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-w">width</Label>
                <Input
                  id="t2i-w"
                  inputMode="numeric"
                  value={t2i.width}
                  onChange={(e) => setT2i((s) => ({ ...s, width: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-h">height</Label>
                <Input
                  id="t2i-h"
                  inputMode="numeric"
                  value={t2i.height}
                  onChange={(e) => setT2i((s) => ({ ...s, height: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-n">imgCount</Label>
                <Input
                  id="t2i-n"
                  inputMode="numeric"
                  value={t2i.imgCount}
                  onChange={(e) => setT2i((s) => ({ ...s, imgCount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-seed">seed（-1 随机）</Label>
                <Input
                  id="t2i-seed"
                  inputMode="numeric"
                  value={t2i.seed}
                  onChange={(e) => setT2i((s) => ({ ...s, seed: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t2i-rf">restoreFaces（0/1）</Label>
                <Input
                  id="t2i-rf"
                  inputMode="numeric"
                  value={t2i.restoreFaces}
                  onChange={(e) => setT2i((s) => ({ ...s, restoreFaces: e.target.value }))}
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
              <span className="text-destructive">*</span> 必填：{" "}
              <code className="font-mono">checkPointId</code>、<code className="font-mono">prompt</code>、
              <code className="font-mono">sourceImage</code>（公网可访问图片 URL）。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="i2i-check">checkPointId *</Label>
                <Input
                  id="i2i-check"
                  value={i2i.checkPointId}
                  onChange={(e) => setI2i((s) => ({ ...s, checkPointId: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="i2i-src">sourceImage *</Label>
                <Input
                  id="i2i-src"
                  value={i2i.sourceImage}
                  onChange={(e) => setI2i((s) => ({ ...s, sourceImage: e.target.value }))}
                  placeholder="https://..."
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="i2i-prompt">prompt *</Label>
                <textarea
                  id="i2i-prompt"
                  className={inputClass + " min-h-[100px] py-2"}
                  value={i2i.prompt}
                  onChange={(e) => setI2i((s) => ({ ...s, prompt: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="i2i-neg">negativePrompt</Label>
                <textarea
                  id="i2i-neg"
                  className={inputClass + " min-h-[72px] py-2"}
                  value={i2i.negativePrompt}
                  onChange={(e) => setI2i((s) => ({ ...s, negativePrompt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-tpl">templateUuid</Label>
                <Input
                  id="i2i-tpl"
                  value={i2i.templateUuid}
                  onChange={(e) => setI2i((s) => ({ ...s, templateUuid: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-denoise">denoisingStrength（0–1）</Label>
                <Input
                  id="i2i-denoise"
                  inputMode="decimal"
                  value={i2i.denoisingStrength}
                  onChange={(e) => setI2i((s) => ({ ...s, denoisingStrength: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-rm">resizeMode</Label>
                <Input
                  id="i2i-rm"
                  inputMode="numeric"
                  value={i2i.resizeMode}
                  onChange={(e) => setI2i((s) => ({ ...s, resizeMode: e.target.value }))}
                  placeholder="0 拉伸 1 裁剪 2 填充"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-mode">mode</Label>
                <Input
                  id="i2i-mode"
                  inputMode="numeric"
                  value={i2i.mode}
                  onChange={(e) => setI2i((s) => ({ ...s, mode: e.target.value }))}
                  placeholder="0 图生图"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-sampler">sampler</Label>
                <Input
                  id="i2i-sampler"
                  inputMode="numeric"
                  value={i2i.sampler}
                  onChange={(e) => setI2i((s) => ({ ...s, sampler: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-steps">steps</Label>
                <Input
                  id="i2i-steps"
                  inputMode="numeric"
                  value={i2i.steps}
                  onChange={(e) => setI2i((s) => ({ ...s, steps: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-cfg">cfgScale</Label>
                <Input
                  id="i2i-cfg"
                  inputMode="decimal"
                  value={i2i.cfgScale}
                  onChange={(e) => setI2i((s) => ({ ...s, cfgScale: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-w">width</Label>
                <Input
                  id="i2i-w"
                  inputMode="numeric"
                  value={i2i.width}
                  onChange={(e) => setI2i((s) => ({ ...s, width: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-h">height</Label>
                <Input
                  id="i2i-h"
                  inputMode="numeric"
                  value={i2i.height}
                  onChange={(e) => setI2i((s) => ({ ...s, height: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-n">imgCount</Label>
                <Input
                  id="i2i-n"
                  inputMode="numeric"
                  value={i2i.imgCount}
                  onChange={(e) => setI2i((s) => ({ ...s, imgCount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-seed">seed</Label>
                <Input
                  id="i2i-seed"
                  inputMode="numeric"
                  value={i2i.seed}
                  onChange={(e) => setI2i((s) => ({ ...s, seed: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="i2i-rf">restoreFaces</Label>
                <Input
                  id="i2i-rf"
                  inputMode="numeric"
                  value={i2i.restoreFaces}
                  onChange={(e) => setI2i((s) => ({ ...s, restoreFaces: e.target.value }))}
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
