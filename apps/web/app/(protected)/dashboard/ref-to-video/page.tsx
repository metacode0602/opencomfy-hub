"use client"

import { useState } from "react"
import { RefreshCw, Sparkles, Upload, X, Video } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ModelSelector } from "@/components/create/model-selector"
import { ParametersPanel } from "@/components/create/parameters-panel"
import { GenerationResult } from "@/components/create/generation-result"
import { cn } from "@workspace/ui/lib/utils"

const transferModes = [
  { id: "motion", label: "运动迁移", description: "学习参考视频的运动轨迹" },
  { id: "style", label: "风格迁移", description: "学习参考视频的视觉风格" },
  { id: "both", label: "综合迁移", description: "同时迁移运动和风格" },
]

export default function RefToVideoPage() {
  const [referenceVideo, setReferenceVideo] = useState<string>()
  const [sourceImage, setSourceImage] = useState<string>()
  const [prompt, setPrompt] = useState("")
  const [transferMode, setTransferMode] = useState("motion")
  const [model, setModel] = useState("runway-gen3")
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<string | undefined>()
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

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "reference" | "source") => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      if (type === "reference") {
        setReferenceVideo(url)
      } else {
        setSourceImage(url)
      }
    }
  }

  const handleGenerate = () => {
    if (!referenceVideo) return
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setResult("generated")
    }, 6000)
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Controls */}
      <div className="w-[400px] flex-shrink-0 border-r border-border overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <RefreshCw className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">参考生视频</h1>
            <p className="text-sm text-muted-foreground">基于参考视频生成新视频</p>
          </div>
        </div>

        {/* Model Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">选择模型</label>
          <ModelSelector type="video" value={model} onChange={setModel} />
        </div>

        {/* Reference Video Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">上传参考视频</label>
          {referenceVideo ? (
            <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-secondary/50">
              <video
                src={referenceVideo}
                className="w-full h-full object-contain"
                controls
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => setReferenceVideo(undefined)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="relative aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleVideoUpload(e, "reference")}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Video className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">上传参考视频</p>
                  <p className="text-xs text-muted-foreground mt-1">AI 将学习视频的运动和风格</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Source Image (Optional) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">起始画面 (可选)</label>
          {sourceImage ? (
            <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-secondary/50">
              <img
                src={sourceImage}
                alt="Source"
                className="w-full h-full object-contain"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => setSourceImage(undefined)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="relative aspect-video rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (event) => {
                      setSourceImage(event.target?.result as string)
                    }
                    reader.readAsDataURL(file)
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">上传起始画面</p>
                  <p className="text-xs text-muted-foreground mt-1">不上传则自动生成</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transfer Mode */}
        <div className="space-y-2">
          <label className="text-sm font-medium">迁移模式</label>
          <div className="space-y-2">
            {transferModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setTransferMode(mode.id)}
                className={cn(
                  "w-full p-3 rounded-lg text-left transition-colors",
                  transferMode === mode.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80"
                )}
              >
                <p className="text-sm font-medium">{mode.label}</p>
                <p className={cn(
                  "text-xs",
                  transferMode === mode.id ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {mode.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Additional Prompt */}
        <div className="space-y-2">
          <label className="text-sm font-medium">补充描述 (可选)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你希望生成的内容..."
            className="w-full h-20 px-4 py-3 rounded-xl bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Parameters */}
        <ParametersPanel
          type="video"
          parameters={parameters}
          onChange={setParameters}
        />

        {/* Generate Button */}
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

      {/* Right Panel - Result */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <GenerationResult
            type="video"
            isGenerating={isGenerating}
            result={result}
            prompt={`${transferModes.find(m => m.id === transferMode)?.label}${prompt ? ` - ${prompt}` : ""}`}
          />
        </div>
      </div>
    </div>
  )
}
