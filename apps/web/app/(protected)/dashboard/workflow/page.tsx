"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  Layers, 
  Upload, 
  Play, 
  Pause, 
  Settings2, 
  Plus,
  FileJson,
  Sparkles,
  ChevronRight,
  X
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const presetWorkflows = [
  {
    id: "anime-style",
    name: "动漫风格转换",
    description: "将照片转换为动漫风格",
    nodes: 8,
    category: "风格迁移",
  },
  {
    id: "upscale-4k",
    name: "4K 超分辨率",
    description: "将图片放大到 4K 清晰度",
    nodes: 5,
    category: "图像增强",
  },
  {
    id: "video-interpolation",
    name: "视频插帧",
    description: "将视频帧率提升到 60fps",
    nodes: 6,
    category: "视频处理",
  },
  {
    id: "portrait-enhance",
    name: "人像美化",
    description: "智能人像美化和修复",
    nodes: 10,
    category: "人像处理",
  },
  {
    id: "background-remove",
    name: "背景移除",
    description: "自动识别并移除背景",
    nodes: 4,
    category: "图像编辑",
  },
  {
    id: "style-transfer",
    name: "艺术风格迁移",
    description: "应用艺术家风格到图片",
    nodes: 12,
    category: "风格迁移",
  },
]

const categories = ["全部", "风格迁移", "图像增强", "视频处理", "人像处理", "图像编辑"]

interface WorkflowNode {
  id: string
  type: string
  name: string
  x: number
  y: number
}

export default function WorkflowPage() {
  const [selectedCategory, setSelectedCategory] = useState("全部")
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)
  const [customWorkflowFile, setCustomWorkflowFile] = useState<File | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const filteredWorkflows = selectedCategory === "全部"
    ? presetWorkflows
    : presetWorkflows.filter(w => w.category === selectedCategory)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith(".json")) {
      setCustomWorkflowFile(file)
    }
  }

  const handleRun = () => {
    setIsRunning(true)
    setTimeout(() => setIsRunning(false), 3000)
  }

  return (
    <div className="h-full flex">
      {/* Left Panel - Workflow Selection */}
      <div className="w-[400px] flex-shrink-0 border-r border-border overflow-y-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
            <Layers className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">工作流</h1>
            <p className="text-sm text-muted-foreground">使用 ComfyUI 工作流</p>
          </div>
        </div>

        {/* Upload Custom Workflow */}
        <div className="space-y-2">
          <label className="text-sm font-medium">导入工作流</label>
          {customWorkflowFile ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary border border-border">
              <FileJson className="h-5 w-5 text-teal-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{customWorkflowFile.name}</p>
                <p className="text-xs text-muted-foreground">自定义工作流</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCustomWorkflowFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-secondary/50 transition-colors cursor-pointer">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">上传 ComfyUI JSON 文件</span>
              </div>
            </div>
          )}
        </div>

        {/* Preset Workflows */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">预设工作流</span>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs transition-colors",
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary hover:bg-secondary/80"
                )}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Workflow List */}
          <div className="space-y-2">
            {filteredWorkflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => setSelectedWorkflow(workflow.id)}
                className={cn(
                  "w-full p-4 rounded-xl text-left transition-colors",
                  selectedWorkflow === workflow.id
                    ? "bg-primary/10 border border-primary/50"
                    : "bg-secondary hover:bg-secondary/80 border border-transparent"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{workflow.name}</span>
                  <ChevronRight className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    selectedWorkflow === workflow.id && "rotate-90"
                  )} />
                </div>
                <p className="text-xs text-muted-foreground mb-2">{workflow.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                    {workflow.nodes} 节点
                  </span>
                  <span className="text-xs text-muted-foreground">{workflow.category}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Run Button */}
        <Button
          size="lg"
          className="w-full glow-primary"
          onClick={handleRun}
          disabled={!selectedWorkflow && !customWorkflowFile || isRunning}
        >
          {isRunning ? (
            <>
              <Pause className="h-5 w-5 mr-2" />
              运行中...
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              运行工作流
            </>
          )}
        </Button>
      </div>

      {/* Right Panel - Workflow Visualization */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="h-full rounded-xl border border-border bg-secondary/30 relative overflow-hidden">
          {/* Grid Background */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `linear-gradient(oklch(0.25 0.02 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.25 0.02 260) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />

          {selectedWorkflow || customWorkflowFile ? (
            <div className="relative z-10 h-full flex items-center justify-center">
              {/* Simple Workflow Visualization */}
              <div className="flex items-center gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className={cn(
                      "w-24 h-16 rounded-lg border flex items-center justify-center",
                      isRunning && i <= 3
                        ? "bg-primary/20 border-primary"
                        : "bg-card border-border"
                    )}>
                      <Settings2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground">节点 {i}</span>
                    {i < 5 && (
                      <div className="absolute" style={{ left: `${i * 128 + 96}px`, top: "50%" }}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Running Indicator */}
              {isRunning && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 border border-primary">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="h-4 w-4 text-primary" />
                    </motion.div>
                    <span className="text-sm">正在运行工作流...</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="relative z-10 h-full flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Layers className="h-8 w-8 text-primary/50" />
              </div>
              <div className="text-center">
                <p className="font-medium text-muted-foreground">选择或导入工作流</p>
                <p className="text-sm text-muted-foreground mt-1">
                  从左侧选择预设工作流或上传自定义 JSON 文件
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
