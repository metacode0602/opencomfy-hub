"use client"

import { useState, useRef, useEffect } from "react"
import { Video, Sparkles, Lightbulb } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { ModelSelector } from "@/components/create/model-selector"
import { ParametersPanel } from "@/components/create/parameters-panel"
import { GenerationResult } from "@/components/create/generation-result"

const promptSuggestions = [
  "宇宙飞船穿越虫洞，绚丽的光效和星云，科幻电影风格",
  "樱花花瓣随风飘落，日式庭院，慢动作，诗意美感",
  "海浪拍打礁石，日落时分，金色阳光洒落，4K电影级",
  "夜空中璀璨的北极光，雪山背景，延时摄影效果",
]

const motionStyles = [
  { id: "cinematic", label: "电影级", description: "专业电影运镜" },
  { id: "smooth", label: "平滑", description: "流畅自然的运动" },
  { id: "dynamic", label: "动感", description: "快速剪辑风格" },
  { id: "slow", label: "慢动作", description: "细节放大" },
] as const

const MOCK_VIDEO_BY_STYLE: Record<(typeof motionStyles)[number]["id"], string> = {
  cinematic:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  smooth:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  dynamic:
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  slow: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
}

export default function TextToVideoPage() {
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState("sora")
  const [motionStyle, setMotionStyle] =
    useState<(typeof motionStyles)[number]["id"]>("cinematic")
  const [isGenerating, setIsGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(0)
  const [resultVideoUrl, setResultVideoUrl] = useState<string>()
  const [parameters, setParameters] = useState({
    width: 1920,
    height: 1080,
    steps: 50,
    cfgScale: 7,
    seed: 42,
    negativePrompt: "低质量, 抖动, 变形, 模糊",
    duration: 5,
    fps: 24,
  })

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    }
  }, [])

  const handleGenerate = () => {
    if (!prompt.trim()) return
    setResultVideoUrl(undefined)
    setIsGenerating(true)
    setGenProgress(0)
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    progressTimerRef.current = setInterval(() => {
      setGenProgress((p) => (p >= 88 ? p : p + 4 + Math.floor(Math.random() * 6)))
    }, 300)
    window.setTimeout(() => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      setGenProgress(100)
      setIsGenerating(false)
      setResultVideoUrl(MOCK_VIDEO_BY_STYLE[motionStyle])
    }, 4800)
  }

  const promptSummary = `${motionStyles.find((s) => s.id === motionStyle)?.label} · ${prompt}`

  return (
    <div className="h-full flex">
      <div className="w-[400px] flex-shrink-0 border-r border-border overflow-y-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
            <Video className="h-5 w-5 text-pink-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">文生视频</h1>
            <p className="text-sm text-muted-foreground">用文字描述生成视频</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">选择模型</label>
          <ModelSelector type="video" value={model} onChange={setModel} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">描述你想要的视频</label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：宇宙飞船穿越虫洞，绚丽的光效..."
              className="w-full h-32 px-4 py-3 rounded-xl bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
              {prompt.length} / 1000
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span>灵感提示</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPrompt(suggestion)}
                className="px-3 py-1.5 rounded-full text-xs bg-secondary hover:bg-secondary/80 transition-colors text-left"
              >
                {suggestion.slice(0, 20)}...
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">运动风格</label>
          <div className="grid grid-cols-2 gap-2">
            {motionStyles.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => setMotionStyle(style.id)}
                className={`p-3 rounded-lg text-left transition-colors ${
                  motionStyle === style.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                <p className="text-sm font-medium">{style.label}</p>
                <p
                  className={`text-xs ${
                    motionStyle === style.id
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {style.description}
                </p>
              </button>
            ))}
          </div>
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
          disabled={!prompt.trim() || isGenerating}
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
            emptyDescription="输入描述并点击生成开始创作"
          />
        </div>
      </div>
    </div>
  )
}
