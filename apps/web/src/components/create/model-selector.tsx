"use client"

import { Check, ChevronDown, Sparkles } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu"

export type ModelType = "image" | "video"

interface Model {
  id: string
  name: string
  badge?: string
  description: string
}

const imageModels: Model[] = [
  { id: "flux-pro", name: "FLUX.1 Pro", badge: "推荐", description: "最新一代文生图模型" },
  { id: "sdxl", name: "Stable Diffusion XL", badge: "经典", description: "稳定可靠的开源模型" },
  { id: "sd3", name: "Stable Diffusion 3", description: "SD 系列最新版本" },
  { id: "midjourney", name: "Midjourney Style", badge: "艺术", description: "艺术风格突出" },
]

const videoModels: Model[] = [
  { id: "sora", name: "Sora", badge: "顶级", description: "OpenAI 视频生成模型" },
  { id: "runway-gen3", name: "Runway Gen-3", badge: "专业", description: "专业级视频生成" },
  { id: "kling", name: "Kling AI", badge: "高效", description: "快速高效的视频生成" },
  { id: "pika", name: "Pika Labs", description: "创意视频生成" },
]

interface ModelSelectorProps {
  type: ModelType
  value: string
  onChange: (value: string) => void
}

export function ModelSelector({ type, value, onChange }: ModelSelectorProps) {
  const models = type === "image" ? imageModels : videoModels
  const selectedModel = models.find((m) => m.id === value) ?? models[0]!

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-auto py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedModel.name}</span>
                {selectedModel.badge && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                    {selectedModel.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{selectedModel.description}</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>
          {type === "image" ? "图像生成模型" : "视频生成模型"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onChange(model.id)}
            className="flex items-center justify-between py-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{model.name}</span>
                  {model.badge && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      {model.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{model.description}</p>
              </div>
            </div>
            {value === model.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
