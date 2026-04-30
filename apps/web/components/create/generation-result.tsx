"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Download, 
  Share2, 
  Heart, 
  RotateCcw, 
  Maximize2,
  Sparkles,
  Play,
  Pause
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

interface GenerationResultProps {
  type: "image" | "video"
  isGenerating: boolean
  result?: string
  prompt?: string
}

export function GenerationResult({
  type,
  isGenerating,
  result,
  prompt,
}: GenerationResultProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  if (isGenerating) {
    return (
      <div className="aspect-video rounded-xl border border-border bg-secondary/30 flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center"
        >
          <Sparkles className="h-8 w-8 text-primary" />
        </motion.div>
        <div className="text-center">
          <p className="font-medium">AI 正在创作中...</p>
          <p className="text-sm text-muted-foreground mt-1">
            预计需要 {type === "video" ? "30-60" : "10-20"} 秒
          </p>
        </div>
        <div className="w-48 h-1 rounded-full bg-secondary overflow-hidden">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full bg-primary"
          />
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="aspect-video rounded-xl border border-border bg-secondary/30 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary/50" />
        </div>
        <div className="text-center">
          <p className="font-medium text-muted-foreground">等待生成</p>
          <p className="text-sm text-muted-foreground mt-1">
            输入描述并点击生成按钮开始创作
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Result Display */}
      <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-secondary/30 group">
        {type === "video" ? (
          <div className="relative w-full h-full">
            {/* Video Placeholder - in real app this would be a video element */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                variant="secondary"
                size="icon"
                className="w-16 h-16 rounded-full"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8" />
                ) : (
                  <Play className="h-8 w-8 ml-1" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full">
            {/* Image Placeholder - in real app this would show the generated image */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground">生成的图像预览</p>
            </div>
          </div>
        )}

        {/* Overlay Actions */}
        <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="secondary" size="icon" className="h-8 w-8">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Prompt Display */}
      {prompt && (
        <div className="p-4 rounded-xl bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground mb-1">提示词</p>
          <p className="text-sm">{prompt}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          下载
        </Button>
        <Button variant="outline" size="sm" className="flex-1">
          <Share2 className="h-4 w-4 mr-2" />
          分享
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => setIsLiked(!isLiked)}
        >
          <Heart
            className={cn(
              "h-4 w-4",
              isLiked && "fill-red-500 text-red-500"
            )}
          />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
