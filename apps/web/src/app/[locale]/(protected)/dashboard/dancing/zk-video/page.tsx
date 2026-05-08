"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Sparkles, 
  User, 
  Settings2,
  ChevronDown,
  ChevronUp,
  Play,
  Upload,
  Clock,
  Film,
  AlertCircle,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Textarea } from "@workspace/ui/components/textarea"
import { Label } from "@workspace/ui/components/label"
import { Slider } from "@workspace/ui/components/slider"
import { Switch } from "@workspace/ui/components/switch"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { dancingTemplates, EffectTemplate, effectTemplates } from "@/lib/types/marketplace-data"
import { cn } from "@workspace/ui/lib/utils"
import { ResultPreviewModal, GenerationResultData } from "@/components/marketplace/result-preview-modal"

const ZK_TEMPLATE_UUID = "4df2efa0f18d46dc9758803e478eb51c"
const ZK_WORKFLOW_UUID = "2f2fd156c9774cd7b94accfb674d8a0b"
const ZK_FIXED_REFERENCE_VIDEO =
  "https://liblibai-tmp-image.liblib.cloud/video/920809fc878b42509425f8bb79d905c6/2821d4cc40edcb11224302188ead7a5a22f209b9027ae4acafc469caaf80deb8.mp4"

const POLL_INTERVAL_MS = 4000
const POLL_MAX_ATTEMPTS = 450

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

function liblibCodeOk(code: unknown): boolean {
  return code === 0 || code === "0"
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { parseError: true, raw: text.slice(0, 500) }
  }
}

function pickErrorMessage(json: unknown, fallback: string): string {
  if (!isRecord(json)) return fallback
  if (typeof json.error === "string" && json.error.trim()) return json.error
  if (typeof json.msg === "string" && json.msg.trim()) return json.msg
  return fallback
}

/**
 * 生图用的完整源图 URL，规则与 `api/v1/upload/api.md` §4 一致：`{postUrl}/{key}`。
 * `POST /api/v1/upload` 同时返回 `imageUrl` 与 `postUrl`、`key`；二者应等价，此处按文档用 postUrl+key 拼接（缺一则回退 imageUrl）。
 */
function resolveSourceImageUrlForGenerate(
  uploadJson: Record<string, unknown>,
): string | null {
  const postUrl =
    typeof uploadJson.postUrl === "string" ? uploadJson.postUrl.trim() : ""
  const key = typeof uploadJson.key === "string" ? uploadJson.key.trim() : ""
  if (postUrl.length > 0 && key.length > 0) {
    const base = postUrl.replace(/\/+$/, "")
    const path = key.replace(/^\/+/, "")
    return `${base}/${path}`
  }
  const imageUrl =
    typeof uploadJson.imageUrl === "string" ? uploadJson.imageUrl.trim() : ""
  return imageUrl.length > 0 ? imageUrl : null
}

function extractGenerateUuid(json: unknown): string | null {
  if (!isRecord(json) || !liblibCodeOk(json.code)) return null
  const data = json.data
  if (!isRecord(data)) return null
  const id = data.generateUuid
  return typeof id === "string" && id.trim() ? id.trim() : null
}

type StatusPayload = {
  generateStatus: number
  percentCompleted?: number
  generateMsg?: string
  videos?: { videoUrl?: string; coverPath?: string }[]
  images?: { imageUrl?: string }[]
}

function parseStatusData(json: unknown): StatusPayload | null {
  if (!isRecord(json) || !liblibCodeOk(json.code)) return null
  const data = json.data
  if (!isRecord(data)) return null
  const generateStatus = data.generateStatus
  if (typeof generateStatus !== "number") return null
  const percentCompleted =
    typeof data.percentCompleted === "number" ? data.percentCompleted : undefined
  const generateMsg =
    typeof data.generateMsg === "string" ? data.generateMsg : undefined
  const videos = Array.isArray(data.videos) ? data.videos : undefined
  const images = Array.isArray(data.images) ? data.images : undefined
  return { generateStatus, percentCompleted, generateMsg, videos, images }
}

function progressFromStatus(status: number, percent?: number): number {
  if (typeof percent === "number" && percent >= 0 && percent <= 1) {
    return Math.min(99, Math.round(percent * 100))
  }
  const map: Record<number, number> = {
    1: 8,
    2: 35,
    3: 55,
    4: 75,
    5: 100,
    6: 0,
  }
  return map[status] ?? 20
}

export default function EffectDetailPage() {
  const id = "zk-video";
  const template = dancingTemplates.find((t) => t.id === id) || dancingTemplates[0] as EffectTemplate
  
  const [description, setDescription] = useState("")
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showResultModal, setShowResultModal] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationResult, setGenerationResult] = useState<GenerationResultData | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const pollAttemptRef = useRef(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelledRef = useRef(false)
  const previewBlobRef = useRef<string | null>(null)
  const demoVideoRef = useRef<HTMLVideoElement | null>(null)
  const [isDemoVideoPlaying, setIsDemoVideoPlaying] = useState(false)

  // Advanced parameters
  const [fps, setFps] = useState(template.parameters.fps)
  const [motionStrength, setMotionStrength] = useState(template.parameters.motionStrength)
  const [styleStrength, setStyleStrength] = useState(template.parameters.styleStrength)
  const [duration, setDuration] = useState(template.duration)

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    previewBlobRef.current = previewUrl
  }, [previewUrl])

  useEffect(() => {
    return () => {
      cancelledRef.current = true
      clearPollTimer()
      const b = previewBlobRef.current
      if (b?.startsWith("blob:")) URL.revokeObjectURL(b)
    }
  }, [clearPollTimer])

  useEffect(() => {
    if (!isDemoVideoPlaying || !template.videoUrl) return
    const el = demoVideoRef.current
    if (!el) return
    void el.play().catch(() => {
      /* 部分环境需用户手势后才可播；点击已触发，忽略即可 */
    })
  }, [isDemoVideoPlaying, template.videoUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setPipelineError("请上传 JPG 或 PNG 图片（本流程通过 LibLib 图片上传接口提交）")
      return
    }
    setPipelineError(null)
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(file)
    previewBlobRef.current = url
    setPreviewUrl(url)
    setSelectedFile(file)
  }

  const pollStatus = useCallback(
    (generateUuid: string) => {
      const schedule = (delay: number) => {
        clearPollTimer()
        pollTimerRef.current = setTimeout(run, delay)
      }

      const run = async () => {
        if (cancelledRef.current) return
        pollAttemptRef.current += 1
        if (pollAttemptRef.current > POLL_MAX_ATTEMPTS) {
          setIsGenerating(false)
          setShowResultModal(false)
          setPipelineError("任务超时：轮询已达到上限，请在 LibLib 后台查看任务状态")
          return
        }

        let res: Response
        try {
          res = await fetch("/api/v1/generate/comfy/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ generateUuid }),
          })
        } catch {
          schedule(POLL_INTERVAL_MS)
          return
        }

        const json = await readJsonSafe(res)
        if (!res.ok) {
          setIsGenerating(false)
          setShowResultModal(false)
          setPipelineError(pickErrorMessage(json, `查询状态失败 HTTP ${res.status}`))
          return
        }

        if (!isRecord(json) || !liblibCodeOk(json.code)) {
          setIsGenerating(false)
          setShowResultModal(false)
          setPipelineError(pickErrorMessage(json, "查询状态失败"))
          return
        }

        const payload = parseStatusData(json)
        if (!payload) {
          setIsGenerating(false)
          setShowResultModal(false)
          setPipelineError("状态接口返回数据格式异常，请稍后重试")
          return
        }

        const { generateStatus, percentCompleted, generateMsg, videos, images } = payload
        setGenerationProgress(progressFromStatus(generateStatus, percentCompleted))

        if (generateStatus === 6) {
          setIsGenerating(false)
          setShowResultModal(false)
          setPipelineError(generateMsg?.trim() || "生成任务失败")
          return
        }

        if (generateStatus === 5) {
          const videoUrl = videos?.find((v) => typeof v.videoUrl === "string")?.videoUrl
          const imageUrl = images?.find((i) => typeof i.imageUrl === "string")?.imageUrl
          const resultUrl = videoUrl || imageUrl
          if (!resultUrl) {
            setIsGenerating(false)
            setShowResultModal(false)
            setPipelineError("任务已完成但未返回图片或视频地址")
            return
          }
          setGenerationProgress(100)
          setIsGenerating(false)
          setGenerationResult({
            id: generateUuid,
            type: videoUrl ? "video" : "image",
            url: resultUrl,
            thumbnailUrl: template.thumbnail,
            prompt: `${template.name} - ${description || "默认效果"}`,
            duration,
            width: 1920,
            height: 1080,
            model: template.baseModel,
            createdAt: new Date(),
            parameters: {
              帧率: `${fps} FPS`,
              运动强度: `${Math.round(motionStrength * 100)}%`,
              风格强度: `${Math.round(styleStrength * 100)}%`,
              时长: `${duration}s`,
            },
          })
          return
        }

        schedule(POLL_INTERVAL_MS)
      }

      void run()
    },
    [
      clearPollTimer,
      description,
      duration,
      fps,
      motionStrength,
      styleStrength,
      template.baseModel,
      template.name,
      template.thumbnail,
    ],
  )

  const handleGenerate = async () => {
    if (!selectedFile) return
    cancelledRef.current = false
    clearPollTimer()
    pollAttemptRef.current = 0
    setPipelineError(null)
    setGenerationResult(null)
    setIsGenerating(true)
    setShowResultModal(true)
    setGenerationProgress(0)

    let imageUrl: string
    try {
      setIsUploading(true)
      const form = new FormData()
      form.append("file", selectedFile)
      const upRes = await fetch("/api/v1/upload", { method: "POST", body: form })
      const upJson = await readJsonSafe(upRes)
      if (!upRes.ok) {
        throw new Error(pickErrorMessage(upJson, `上传失败 HTTP ${upRes.status}`))
      }
      if (!isRecord(upJson)) {
        throw new Error("上传响应格式错误")
      }
      const resolved = resolveSourceImageUrlForGenerate(upJson)
      if (!resolved) {
        throw new Error(
          "上传成功但未返回可用的图片地址（需 postUrl+key 或 imageUrl，参见上传接口文档 §4）",
        )
      }
      imageUrl = resolved
    } catch (e) {
      const msg = e instanceof Error ? e.message : "上传失败"
      setPipelineError(msg)
      setIsGenerating(false)
      setShowResultModal(false)
      setIsUploading(false)
      return
    } finally {
      setIsUploading(false)
    }

    setGenerationProgress(12)
    // 测试代码，正式代码需要删除
    // imageUrl = "https://liblibai-tmp-image.liblib.cloud/img/920809fc878b42509425f8bb79d905c6/f06d53252886e8b3e9267b39db612759b1ebb7782d4c22e901eaf16bb8a75b9b.png";
    const generateBody = {
      templateUuid: ZK_TEMPLATE_UUID,
      generateParams: {
        "33": {
          class_type: "LoadImage",
          inputs: {
            image: imageUrl,
          },
        },
        "51": {
          class_type: "VHS_LoadVideo",
          inputs: {
            video: ZK_FIXED_REFERENCE_VIDEO,
          },
        },
        workflowUuid: ZK_WORKFLOW_UUID,
      },
    }

    let genRes: Response
    try {
      genRes = await fetch("/api/v1/generate/comfy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generateBody),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "网络错误"
      setPipelineError(`提交生成任务失败：${msg}`)
      setIsGenerating(false)
      setShowResultModal(false)
      return
    }

    const genJson = await readJsonSafe(genRes)
    if (!genRes.ok) {
      setPipelineError(pickErrorMessage(genJson, `提交任务失败 HTTP ${genRes.status}`))
      setIsGenerating(false)
      setShowResultModal(false)
      return
    }

    if (!isRecord(genJson) || !liblibCodeOk(genJson.code)) {
      setPipelineError(pickErrorMessage(genJson, "提交任务失败"))
      setIsGenerating(false)
      setShowResultModal(false)
      return
    }

    const generateUuid = extractGenerateUuid(genJson)
    if (!generateUuid) {
      setPipelineError("提交成功但未返回 generateUuid")
      setIsGenerating(false)
      setShowResultModal(false)
      return
    }

    setGenerationProgress(18)
    pollStatus(generateUuid)
  }

  const handleRegenerate = () => {
    setGenerationResult(null)
    void handleGenerate()
  }

  const handleCloseResultModal = () => {
    cancelledRef.current = true
    clearPollTimer()
    setShowResultModal(false)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Back Button */}
        <Link href="/dashboard/dancing">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回舞蹈生成列表
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Template Info */}
          <div>
            {/* Video Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-video rounded-2xl overflow-hidden border border-border bg-muted"
            >
              {isDemoVideoPlaying && template.videoUrl ? (
                <video
                  ref={demoVideoRef}
                  src={template.videoUrl}
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : (
                <>
                  <Image
                    src={template.thumbnail}
                    alt={template.name}
                    fill
                    className="object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                    <Button
                      type="button"
                      size="lg"
                      className="gap-2 rounded-full"
                      disabled={!template.videoUrl}
                      onClick={() => {
                        if (!template.videoUrl) return
                        setIsDemoVideoPlaying(true)
                      }}
                    >
                      <Play className="w-5 h-5" />
                      预览舞蹈生成
                    </Button>
                  </div>
                </>
              )}
              <Badge className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm pointer-events-none z-10">
                <Clock className="w-3 h-3 mr-1" />
                {template.duration}秒
              </Badge>
            </motion.div>

            {/* Template Info */}
            <div className="mt-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{template.name}</h1>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>{template.author}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsLiked(!isLiked)}
                  >
                    <Heart className={cn("w-4 h-4", isLiked && "fill-red-500 text-red-500")} />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <p className="text-muted-foreground">{template.description}</p>

              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-6 text-sm">
                <span className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-muted-foreground" />
                  {template.likes.toLocaleString()} 喜欢
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  {template.uses.toLocaleString()} 次使用
                </span>
                <span className="flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-muted-foreground" />
                  {template.baseModel}
                </span>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="text-center">
                  <div className="text-lg font-semibold">{template.parameters.fps}</div>
                  <div className="text-xs text-muted-foreground">帧率 (FPS)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{template.duration}s</div>
                  <div className="text-xs text-muted-foreground">时长</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{Math.round(template.parameters.motionStrength * 100)}%</div>
                  <div className="text-xs text-muted-foreground">运动强度</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Generation Panel */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="text-lg font-semibold mb-4">应用此特效</h2>

              <div className="space-y-4">
                {/* Upload Area */}
                <div>
                  <Label>上传人物图片</Label>
                  <div 
                    className="mt-2 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    {previewUrl ? (
                      <div className="relative aspect-video max-w-xs mx-auto rounded-lg overflow-hidden">
                        <Image
                          src={previewUrl}
                          alt="上传的素材"
                          fill
                          className="object-cover"
                          unoptimized={previewUrl.startsWith("blob:")}
                        />
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          点击上传图片
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          仅支持 JPG / PNG，最大 10MB（将上传至 LibLib）
                        </p>
                      </>
                    )}
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description">效果描述（可选）</Label>
                  <Textarea
                    id="description"
                    placeholder="描述你想要的效果细节..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2 min-h-[80px] resize-none"
                  />
                </div>

                {/* Advanced Mode Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">高级模式</span>
                  </div>
                  <Switch
                    checked={showAdvanced}
                    onCheckedChange={setShowAdvanced}
                  />
                </div>

                {/* Advanced Parameters */}
                {showAdvanced && (
                  <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        参数调整
                        {isAdvancedOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                      {/* Duration */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>时长 (秒)</Label>
                          <span className="text-muted-foreground">{duration}s</span>
                        </div>
                        <Slider
                          value={[duration]}
                          onValueChange={([v]) => setDuration(v ?? 0)}
                          min={1}
                          max={10}
                          step={1}
                        />
                      </div>

                      {/* FPS */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>帧率 (FPS)</Label>
                          <span className="text-muted-foreground">{fps}</span>
                        </div>
                        <Slider
                          value={[fps]}
                          onValueChange={([v]) => setFps(v ?? 0)}
                          min={12}
                          max={60}
                          step={6}
                        />
                      </div>

                      {/* Motion Strength */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>运动强度</Label>
                          <span className="text-muted-foreground">{Math.round(motionStrength * 100)}%</span>
                        </div>
                        <Slider
                          value={[motionStrength * 100]}
                          onValueChange={([v]) => setMotionStrength((v ?? 0) / 100)}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>

                      {/* Style Strength */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>风格强度</Label>
                          <span className="text-muted-foreground">{Math.round(styleStrength * 100)}%</span>
                        </div>
                        <Slider
                          value={[styleStrength * 100]}
                          onValueChange={([v]) => setStyleStrength((v ?? 0) / 100)}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Generate Button */}
                {pipelineError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>操作未成功</AlertTitle>
                    <AlertDescription className="text-sm">{pipelineError}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating || !selectedFile}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      {isUploading ? "上传素材中..." : "生成中，请稍候..."}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      应用特效
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Tips */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <h3 className="font-medium text-sm mb-2">使用技巧</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>上传清晰的人物正面照效果更好</li>
                <li>特效参数已为你优化，可直接使用</li>
                <li>高级模式可调整时长、帧率等参数</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Result Preview Modal */}
      <ResultPreviewModal
        isOpen={showResultModal}
        onClose={handleCloseResultModal}
        result={generationResult}
        isGenerating={isGenerating}
        progress={generationProgress}
        onRegenerate={handleRegenerate}
        onDownload={() => console.log("Download")}
        onShare={() => console.log("Share")}
      />
    </div>
  )
}
