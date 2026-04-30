"use client"

import { useState } from "react"
import { ChevronDown, Info } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

interface SliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  tooltip?: string
}

function Slider({ label, value, onChange, min, max, step = 1, tooltip }: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">{label}</span>
          {tooltip && (
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          )}
        </div>
        <span className="text-sm text-muted-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
      />
    </div>
  )
}

interface ParametersPanelProps {
  type: "image" | "video"
  parameters: {
    width: number
    height: number
    steps: number
    cfgScale: number
    seed: number
    negativePrompt: string
    duration?: number
    fps?: number
  }
  onChange: (params: ParametersPanelProps["parameters"]) => void
}

export function ParametersPanel({ type, parameters, onChange }: ParametersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const aspectRatios = [
    { label: "1:1", width: 1024, height: 1024 },
    { label: "16:9", width: 1920, height: 1080 },
    { label: "9:16", width: 1080, height: 1920 },
    { label: "4:3", width: 1440, height: 1080 },
    { label: "3:4", width: 1080, height: 1440 },
  ]

  const updateParam = <K extends keyof ParametersPanelProps["parameters"]>(
    key: K,
    value: ParametersPanelProps["parameters"][K]
  ) => {
    onChange({ ...parameters, [key]: value })
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
      >
        <span className="font-medium">高级参数</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 pt-0 space-y-6">
          {/* Aspect Ratio */}
          <div className="space-y-2">
            <span className="text-sm font-medium">画面比例</span>
            <div className="flex flex-wrap gap-2">
              {aspectRatios.map((ratio) => (
                <Button
                  key={ratio.label}
                  variant={
                    parameters.width === ratio.width &&
                    parameters.height === ratio.height
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    updateParam("width", ratio.width)
                    updateParam("height", ratio.height)
                  }}
                >
                  {ratio.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Steps */}
          <Slider
            label="生成步数"
            value={parameters.steps}
            onChange={(v) => updateParam("steps", v)}
            min={10}
            max={50}
            tooltip="更多步数通常意味着更高质量，但生成时间更长"
          />

          {/* CFG Scale */}
          <Slider
            label="引导系数"
            value={parameters.cfgScale}
            onChange={(v) => updateParam("cfgScale", v)}
            min={1}
            max={20}
            step={0.5}
            tooltip="控制 AI 对提示词的遵循程度"
          />

          {/* Video-specific parameters */}
          {type === "video" && (
            <>
              <Slider
                label="视频时长 (秒)"
                value={parameters.duration || 5}
                onChange={(v) => updateParam("duration", v)}
                min={2}
                max={30}
              />
              <Slider
                label="帧率 (FPS)"
                value={parameters.fps || 24}
                onChange={(v) => updateParam("fps", v)}
                min={12}
                max={60}
              />
            </>
          )}

          {/* Seed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">随机种子</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => updateParam("seed", Math.floor(Math.random() * 1000000))}
              >
                随机
              </Button>
            </div>
            <Input
              type="number"
              value={parameters.seed}
              onChange={(e) => updateParam("seed", Number(e.target.value))}
              className="h-9"
            />
          </div>

          {/* Negative Prompt */}
          <div className="space-y-2">
            <span className="text-sm font-medium">负面提示词</span>
            <textarea
              value={parameters.negativePrompt}
              onChange={(e) => updateParam("negativePrompt", e.target.value)}
              placeholder="描述你不想在结果中出现的内容..."
              className="w-full h-20 px-3 py-2 rounded-lg bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}
    </div>
  )
}
