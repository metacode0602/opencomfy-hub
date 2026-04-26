"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { getTemplateById } from "@/lib/mvp/templates"
import { mvpActions, useMvpStore } from "@/lib/mvp/store"
import type { TemplateField } from "@/lib/mvp/types"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField
  value: string | number | undefined
  onChange: (v: string | number) => void
}) {
  if (field.type === "enum") {
    return (
      <select
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
      >
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === "number") {
    return (
      <Input
        type="number"
        value={typeof value === "number" ? value : value ? Number(value) : ""}
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    )
  }

  return (
    <Input
      value={typeof value === "string" ? value : value === undefined ? "" : String(value)}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function TemplateDetailClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const templateId = sp.get("templateId") ?? ""

  const template = useMemo(() => getTemplateById(templateId), [templateId])
  const [inputImageDataUrl, setInputImageDataUrl] = useState<string | undefined>(undefined)
  const [form, setForm] = useState<Record<string, string | number>>(() =>
    template ? { ...template.defaults } : {},
  )
  const [price, setPrice] = useState<number>(9.9)
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const [lastDeliveryId, setLastDeliveryId] = useState<string | null>(null)

  const job = useMvpStore((s) => (lastJobId ? s.jobs[lastJobId] : undefined))
  const asset = useMvpStore((s) => {
    const assetId = job?.output?.assetId
    return assetId ? s.assets[assetId] : undefined
  })

  if (!template) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Card className="p-4">
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">模板不存在</h1>
            <p className="text-sm text-muted-foreground">templateId: {templateId || "-"}</p>
            <Button asChild>
              <Link href="/index">返回首页</Link>
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const canGenerate = template.fields.every((f) => (f.required ? Boolean(form[f.key]) : true))

  async function onPickImage(file: File) {
    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error("读取图片失败"))
      reader.readAsDataURL(file)
    })
    setInputImageDataUrl(dataUrl)
  }

  function startGenerate() {
    setLastDeliveryId(null)
    if (!template) return
    const jobId = mvpActions().createMockJob({
      templateId: template.id,
      outputType: template.outputType,
      params: form,
      inputImageDataUrl,
    })
    setLastJobId(jobId)
  }

  function createDelivery() {
    if (!asset) return
    const deliveryId = mvpActions().createDelivery({ assetId: asset.id, price, currency: "CNY" })
    setLastDeliveryId(deliveryId)
  }

  const shareUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/deliveries?deliveryId=${encodeURIComponent(lastDeliveryId ?? "")}`
  const qrUrl =
    lastDeliveryId && shareUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`
      : ""

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-xl">{template.previewEmoji}</div>
            <h1 className="truncate text-xl font-semibold">{template.name}</h1>
            <Badge variant={template.outputType === "video" ? "secondary" : "default"}>
              {template.outputType === "video" ? "视频" : "图片"}
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/index">返回首页</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">输入与参数</h2>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>上传图片（可选）</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void onPickImage(file)
                }}
              />
              {inputImageDataUrl ? (
                <img
                  src={inputImageDataUrl}
                  alt="input"
                  className="mt-2 h-40 w-full rounded-md border object-cover"
                />
              ) : null}
            </div>

            <div className="space-y-3">
              {template.fields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={f.key}>
                      {f.label}
                      {f.required ? <span className="ml-1 text-destructive">*</span> : null}
                    </Label>
                    {f.description ? (
                      <span className="text-xs text-muted-foreground">{f.description}</span>
                    ) : null}
                  </div>
                  <FieldInput
                    field={f}
                    value={form[f.key]}
                    onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Button onClick={startGenerate} disabled={!canGenerate || job?.status === "running"}>
                {job?.status === "running" ? "生成中…" : "开始生成（Mock）"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 font-medium">生成结果</h2>

          {job ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">job: {job.id}</Badge>
                <Badge
                  variant={
                    job.status === "succeeded"
                      ? "default"
                      : job.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {job.status}
                </Badge>
                {typeof job.progress === "number" ? (
                  <Badge variant="secondary">{job.progress}%</Badge>
                ) : null}
              </div>

              {job.status === "failed" ? (
                <div className="rounded-md border bg-destructive/5 p-3 text-sm text-destructive">
                  {job.errorMessage ?? "生成失败"}
                </div>
              ) : null}

              {asset ? (
                <div className="space-y-3">
                  {asset.type === "image" ? (
                    <img
                      src={asset.url}
                      alt="result"
                      className="h-56 w-full rounded-md border object-cover"
                    />
                  ) : (
                    <video
                      className="h-56 w-full rounded-md border object-cover"
                      src={asset.url}
                      controls
                    />
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>设置价格（仅展示）</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={createDelivery} disabled={job.status !== "succeeded"}>
                        生成二维码（Mock）
                      </Button>
                      {lastDeliveryId ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            router.push(
                              `/deliveries?deliveryId=${encodeURIComponent(lastDeliveryId)}`,
                            )
                          }
                        >
                          打开下载页
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {lastDeliveryId ? (
                    <div className="rounded-md border bg-muted/30 p-3 text-sm">
                      <div className="mb-1 font-medium">分享链接</div>
                      <div className="break-all text-muted-foreground">{shareUrl}</div>
                      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt="qr"
                            className="h-[220px] w-[220px] rounded-md border bg-background"
                          />
                        ) : null}
                        <div className="text-xs text-muted-foreground">
                          二维码为 Mock：使用外部服务生成图片（便于在 Tauri 内直接展示）。后续可替换为本地二维码组件/后端生成。
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  还没有结果。点击左侧“开始生成（Mock）”。
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              还没有开始生成。
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

