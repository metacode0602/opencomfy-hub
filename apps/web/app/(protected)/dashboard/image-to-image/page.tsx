"use client"

import { useState } from "react"
import { ImageIcon, Sparkles, Lightbulb } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ModelSelector } from "@/components/create/model-selector"
import { ParametersPanel } from "@/components/create/parameters-panel"
import { GenerationResult } from "@/components/create/generation-result"
import { ImageUpload } from "@/components/create/image-upload"

const styleOptions = [
  { id: "anime", label: "动漫风格" },
  { id: "watercolor", label: "水彩画" },
  { id: "oil", label: "油画" },
  { id: "sketch", label: "素描" },
  { id: "3d", label: "3D渲染" },
  { id: "pixel", label: "像素风" },
]

export default function ImageToImagePage() {
  const [sourceImage, setSourceImage] = useState<string>()
  const [prompt, setPrompt] = useState("")
  const [selectedStyle, setSelectedStyle] = useState("anime")
  const [model, setModel] = useState("flux-pro")
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<string | undefined>()
  const [strength, setStrength] = useState(0.7)
  const [parameters, setParameters] = useState({
    width: 1024,
    height: 1024,
    steps: 30,
    cfgScale: 7,
    seed: 42,
    negativePrompt: "低质量, 模糊, 变形",
  })

  const handleGenerate = () => {
    if (!sourceImage) return
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setResult("generated")
    }, 3000)
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Controls */}
      <div className="w-[400px] flex-shrink-0 border-r border-border overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">图生图</h1>
            <p className="text-sm text-muted-foreground">基于参考图生成新图</p>
          </div>
        </div>

        {/* Model Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">选择模型</label>
          <ModelSelector type="image" value={model} onChange={setModel} />
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium">上传参考图片</label>
          <ImageUpload
            value={sourceImage}
            onChange={setSourceImage}
            label="上传参考图"
            description="支持 JPG、PNG 格式，最大 10MB"
          />
        </div>

        {/* Style Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">选择风格</label>
          <div className="grid grid-cols-3 gap-2">
            {styleOptions.map((style) => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedStyle === style.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strength Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">转换强度</span>
            <span className="text-sm text-muted-foreground">{Math.round(strength * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            数值越高，生成结果与原图差异越大
          </p>
        </div>

        {/* Additional Prompt */}
        <div className="space-y-2">
          <label className="text-sm font-medium">补充描述 (可选)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="添加额外的细节描述..."
            className="w-full h-20 px-4 py-3 rounded-xl bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Parameters */}
        <ParametersPanel
          type="image"
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
        <div className="max-w-5xl mx-auto">
          <GenerationResult
            type="image"
            isGenerating={isGenerating}
            result={result}
            prompt={`${styleOptions.find(s => s.id === selectedStyle)?.label} 风格${prompt ? `，${prompt}` : ""}`}
          />
        </div>
      </div>
    </div>
  )
}
