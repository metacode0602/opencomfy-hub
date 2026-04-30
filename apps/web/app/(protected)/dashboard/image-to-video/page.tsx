"use client"

import { useState } from "react"
import { Play, Sparkles } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ModelSelector } from "@/components/create/model-selector"
import { ParametersPanel } from "@/components/create/parameters-panel"
import { GenerationResult } from "@/components/create/generation-result"
import { ImageUpload } from "@/components/create/image-upload"

const motionTypes = [
  { id: "zoom-in", label: "缩放靠近" },
  { id: "zoom-out", label: "缩放远离" },
  { id: "pan-left", label: "向左平移" },
  { id: "pan-right", label: "向右平移" },
  { id: "rotate", label: "旋转" },
  { id: "auto", label: "智能识别" },
]

export default function ImageToVideoPage() {
  const [sourceImage, setSourceImage] = useState<string>()
  const [prompt, setPrompt] = useState("")
  const [motionType, setMotionType] = useState("auto")
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

  const handleGenerate = () => {
    if (!sourceImage) return
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setResult("generated")
    }, 5000)
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Controls */}
      <div className="w-[400px] flex-shrink-0 border-r border-border overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <Play className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">图生视频</h1>
            <p className="text-sm text-muted-foreground">将图片转化为动态视频</p>
          </div>
        </div>

        {/* Model Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">选择模型</label>
          <ModelSelector type="video" value={model} onChange={setModel} />
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">上传起始画面</label>
          <ImageUpload
            value={sourceImage}
            onChange={setSourceImage}
            label="上传图片"
            description="将作为视频的第一帧"
          />
        </div>

        {/* Motion Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium">运动方式</label>
          <div className="grid grid-cols-3 gap-2">
            {motionTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setMotionType(type.id)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  motionType === type.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Motion Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium">运动描述 (可选)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述画面中元素的运动方式，例如：花瓣缓缓飘落，微风吹动树叶..."
            className="w-full h-24 px-4 py-3 rounded-xl bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
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
          disabled={!sourceImage || isGenerating}
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
            prompt={`${motionTypes.find(t => t.id === motionType)?.label}${prompt ? ` - ${prompt}` : ""}`}
          />
        </div>
      </div>
    </div>
  )
}
