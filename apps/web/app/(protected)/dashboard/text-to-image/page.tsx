"use client"

import { useState } from "react"
import { Wand2, Sparkles, Lightbulb } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ModelSelector } from "@/components/create/model-selector"
import { ParametersPanel } from "@/components/create/parameters-panel"
import { GenerationResult } from "@/components/create/generation-result"

const promptSuggestions = [
  "一只可爱的柯基犬在樱花树下奔跑，阳光明媚，日系动漫风格",
  "未来主义赛博朋克城市，霓虹灯光，雨夜，电影级画质",
  "神秘的魔法森林，发光的蘑菇和精灵，奇幻风格，高细节",
  "宁静的日式庭院，锦鲤池塘，樱花飘落，水墨画风格",
]

export default function TextToImagePage() {
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState("flux-pro")
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<string | undefined>()
  const [parameters, setParameters] = useState({
    width: 1024,
    height: 1024,
    steps: 30,
    cfgScale: 7,
    seed: 42,
    negativePrompt: "低质量, 模糊, 变形, 丑陋",
  })

  const handleGenerate = () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    // Simulate generation
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
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Wand2 className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">文生图</h1>
            <p className="text-sm text-muted-foreground">用文字描述生成图片</p>
          </div>
        </div>

        {/* Model Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">选择模型</label>
          <ModelSelector type="image" value={model} onChange={setModel} />
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">描述你想要的图片</label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：一只可爱的柯基犬在樱花树下奔跑..."
              className="w-full h-32 px-4 py-3 rounded-xl bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
              {prompt.length} / 1000
            </div>
          </div>
        </div>

        {/* Prompt Suggestions */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span>灵感提示</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setPrompt(suggestion)}
                className="px-3 py-1.5 rounded-full text-xs bg-secondary hover:bg-secondary/80 transition-colors text-left"
              >
                {suggestion.slice(0, 20)}...
              </button>
            ))}
          </div>
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
          disabled={!prompt.trim() || isGenerating}
        >
          <Sparkles className="h-5 w-5 mr-2" />
          {isGenerating ? "生成中..." : "开始生成"}
        </Button>
      </div>

      {/* Right Panel - Result */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <GenerationResult
            type="image"
            isGenerating={isGenerating}
            result={result}
            prompt={prompt}
          />
        </div>
      </div>
    </div>
  )
}
