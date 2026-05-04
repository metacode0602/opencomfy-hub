"use client"

import { useState, useRef, useEffect } from "react"
import { RefreshCw, Sparkles, Video, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ModelSelector } from "@/components/create/model-selector"
import { ParametersPanel } from "@/components/create/parameters-panel"
import { GenerationResult } from "@/components/create/generation-result"
import { ImageUpload } from "@/components/create/image-upload"
import { cn } from "@workspace/ui/lib/utils"

const transferModes = [
  { id: "motion", label: "运动迁移", description: "学习参考视频的运动轨迹" },
  { id: "style", label: "风格迁移", description: "学习参考视频的视觉风格" },
  { id: "both", label: "综合迁移", description: "同时迁移运动和风格" },
] as const

const MOCK_VIDEO_BY_MODE: Record<(typeof transferModes)[number]["id"], string> = {
  motion:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  style:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  both: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
}

export default function RefToVideoPage() {
  const [referenceVideo, setReferenceVideo] = useState<string>()
  const [sourceImage, setSourceImage] = useState<string>()
  const [prompt, setPrompt] = useState("")
  const [transferMode, setTransferMode] =
    useState<(typeof transferModes)[number]["id"]>("motion")
  const [model, setModel] = useState("runway-gen3")
  const [isGenerating, setIsGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(0)
  const [resultVideoUrl, setResultVideoUrl] = useState<string>()
  const [parameters, setParameters] = useState({
    width: 1920,
    height: 1080,
    steps: 50,
    cfgScale: 7,
    seed: 42,
    negativePrompt: "抖动, 变形, 模糊",
    duration: 5,
    fps: 24,
  })

  const referenceInputRef = useRef<HTMLInputElement | null>(null)
  const referenceBlobRef = useRef<string | undefined>(undefined)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    referenceBlobRef.current = referenceVideo
  }, [referenceVideo])

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      const r = referenceBlobRef.current
      if (r?.startsWith("blob:")) URL.revokeObjectURL(r)
    }
  }, [])

  const clearReferenceVideo = () => {
    if (referenceVideo?.startsWith("blob:")) URL.revokeObjectURL(referenceVideo)
    setReferenceVideo(undefined)
  }

  const handleReferenceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      if (referenceVideo?.startsWith("blob:")) URL.revokeObjectURL(referenceVideo)
      setReferenceVideo(URL.createObjectURL(file))
    }
    e.target.value = ""
  }

  const handleGenerate = () => {
    if (!referenceVideo) return
    setResultVideoUrl(undefined)
    setIsGenerating(true)
    setGenProgress(0)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    progressTimerRef.current = setInterval(() => {
      setGenProgress((p) => (p >= 88 ? p : p + 3 + Math.floor(Math.random() * 5)))
    }, 350)
    window.setTimeout(() => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      setGenProgress(100)
      setIsGenerating(false)
      setResultVideoUrl(MOCK_VIDEO_BY_MODE[transferMode])
    }, 5600)
  }

  const promptSummary = `${transferModes.find((m) => m.id === transferMode)?.label}${prompt ? ` · ${prompt}` : ""}`

  return (
    <div className="h-full flex">
      <div className="w-[400px] flex-shrink-0 border-r border-border overflow-y-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">参考生视频</h1>
            <p className="text-sm text-muted-foreground">基于参考视频生成新视频</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">选择模型</label>
          <ModelSelector type="video" value={model} onChange={setModel} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">参考视频</label>
          {referenceVideo ? (
            <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-secondary/50">
              <video
                src={referenceVideo}
                className="w-full h-full object-contain"
                controls
              />
              <input
                ref={referenceInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleReferenceFile}
              />
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end gap-2 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 bg-background/90 hover:bg-background"
                  onClick={() => referenceInputRef.current?.click()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  更换视频
                </Button>
              </div>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={clearReferenceVideo}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="relative aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept="video/*"
                onChange={handleReferenceFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">选择视频</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    点击或拖拽上传，AI 将学习运动与风格
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    支持点击选择或拖拽到此处
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">起始画面 (可选)</label>
          <ImageUpload
            value={sourceImage}
            onChange={setSourceImage}
            label="选择图片"
            description="不上传则自动生成；JPG / PNG，最大 10MB"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">迁移模式</label>
          <div className="space-y-2">
            {transferModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setTransferMode(mode.id)}
                className={cn(
                  "w-full p-3 rounded-lg text-left transition-colors",
                  transferMode === mode.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80"
                )}
              >
                <p className="text-sm font-medium">{mode.label}</p>
                <p
                  className={cn(
                    "text-xs",
                    transferMode === mode.id
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {mode.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">补充描述 (可选)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你希望生成的内容..."
            className="w-full h-20 px-4 py-3 rounded-xl bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <ParametersPanel
          type="video"
          parameters={parameters}
          onChange={setParameters}
          defaultExpanded={false}
        />

        <Button
          size="lg"
          className="w-full glow-primary"
          onClick={handleGenerate}
          disabled={!referenceVideo || isGenerating}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          {isGenerating ? "生成中..." : "开始生成"}
        </Button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <GenerationResult
            type="video"
            isGenerating={isGenerating}
            resultVideoUrl={resultVideoUrl}
            progress={genProgress}
            prompt={promptSummary}
            emptyDescription="上传参考视频并点击生成开始创作"
          />
        </div>
      </div>
    </div>
  )
}
