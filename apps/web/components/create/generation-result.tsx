"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
  Download,
  Share2,
  Heart,
  RotateCcw,
  Maximize2,
  Sparkles,
  Play,
  Pause,
  X,
  Volume2,
  VolumeX,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"

interface GenerationResultProps {
  type: "image" | "video"
  isGenerating: boolean
  /** 兼容旧逻辑：任意真值表示已有结果（无 URL 时显示占位） */
  result?: string
  resultImageUrl?: string
  resultVideoUrl?: string
  prompt?: string
  progress?: number
  /** 空状态副标题 */
  emptyDescription?: string
}

async function downloadMediaUrl(url: string, filename: string) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

async function shareImageUrl(url: string, title: string) {
  try {
    if (navigator.share) {
      const res = await fetch(url)
      const blob = await res.blob()
      const ext = blob.type.includes("png") ? "png" : "jpg"
      const file = new File([blob], `share.${ext}`, { type: blob.type || "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title })
        toast.success("已打开系统分享")
        return
      }
      await navigator.share({ title, text: title, url })
      toast.success("已分享")
      return
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success("链接已复制到剪贴板")
  } catch {
    toast.error("分享失败，请尝试下载后手动分享")
  }
}

async function shareVideoUrl(url: string, title: string) {
  try {
    if (navigator.share) {
      const res = await fetch(url)
      const blob = await res.blob()
      const file = new File([blob], "share.mp4", { type: blob.type || "video/mp4" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title })
        toast.success("已打开系统分享")
        return
      }
      await navigator.share({ title, text: title, url })
      toast.success("已分享")
      return
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return
  }
  try {
    await navigator.clipboard.writeText(url)
    toast.success("链接已复制到剪贴板")
  } catch {
    toast.error("分享失败，请尝试下载后手动分享")
  }
}

export function GenerationResult({
  type,
  isGenerating,
  result,
  resultImageUrl,
  resultVideoUrl,
  prompt,
  progress = 0,
  emptyDescription,
}: GenerationResultProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [showVideoPreview, setShowVideoPreview] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fsVideoRef = useRef<HTMLVideoElement>(null)

  const hasResult =
    Boolean(result) || Boolean(resultImageUrl) || Boolean(resultVideoUrl)
  const imageDisplayUrl = type === "image" ? resultImageUrl : undefined
  const videoDisplayUrl = type === "video" ? resultVideoUrl : undefined
  const hasMediaUrl = Boolean(imageDisplayUrl || videoDisplayUrl)

  const defaultEmpty =
    type === "video"
      ? "填写内容后点击生成开始创作"
      : "输入描述并点击生成按钮开始创作"

  useEffect(() => {
    const active = showVideoPreview ? fsVideoRef : videoRef
    if (active.current) {
      if (isPlaying) void active.current.play()
      else active.current.pause()
    }
  }, [isPlaying, showVideoPreview])

  useEffect(() => {
    if (!showVideoPreview) setIsPlaying(false)
  }, [showVideoPreview])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowImagePreview(false)
        setShowVideoPreview(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const handleTimeUpdate = (ref: React.RefObject<HTMLVideoElement | null>) => {
    if (ref.current) setCurrentTime(ref.current.currentTime)
  }

  const handleLoadedMetadata = (ref: React.RefObject<HTMLVideoElement | null>) => {
    if (ref.current) setVideoDuration(ref.current.duration)
  }

  const handleSeek = (value: number[]) => {
    const ref = showVideoPreview ? fsVideoRef : videoRef
    if (ref.current) {
      ref.current.currentTime = value[0] ?? 0
      setCurrentTime(value[0] ?? 0)
    }
  }

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60)
    const s = Math.floor(time % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  const handleDownload = () => {
    if (imageDisplayUrl) void downloadMediaUrl(imageDisplayUrl, "generation.png")
    if (videoDisplayUrl) void downloadMediaUrl(videoDisplayUrl, "generation.mp4")
  }

  const handleShare = () => {
    if (imageDisplayUrl) void shareImageUrl(imageDisplayUrl, prompt || "生成结果")
    if (videoDisplayUrl) void shareVideoUrl(videoDisplayUrl, prompt || "生成结果")
  }

  if (isGenerating) {
    return (
      <div className="aspect-video rounded-xl border border-border bg-secondary/30 flex flex-col items-center justify-center gap-4 p-6">
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
        <div className="w-full max-w-xs space-y-2">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25 }}
              className="h-full bg-primary rounded-full"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {Math.min(100, Math.round(progress))}%
          </p>
        </div>
      </div>
    )
  }

  if (!hasResult) {
    return (
      <div className="aspect-video rounded-xl border border-border bg-secondary/30 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary/50" />
        </div>
        <div className="text-center">
          <p className="font-medium text-muted-foreground">等待生成</p>
          <p className="text-sm text-muted-foreground mt-1">
            {emptyDescription ?? defaultEmpty}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "relative aspect-video rounded-xl overflow-hidden border border-border bg-black/5 group",
          imageDisplayUrl && "cursor-pointer"
        )}
        onClick={() => {
          if (imageDisplayUrl) setShowImagePreview(true)
        }}
      >
        {type === "video" && videoDisplayUrl ? (
          <div className="relative w-full h-full bg-black">
            <video
              ref={videoRef}
              src={videoDisplayUrl}
              className="w-full h-full object-contain"
              muted={isMuted}
              playsInline
              onTimeUpdate={() => handleTimeUpdate(videoRef)}
              onLoadedMetadata={() => handleLoadedMetadata(videoRef)}
              onEnded={() => setIsPlaying(false)}
              onClick={(e) => {
                e.stopPropagation()
                setIsPlaying(!isPlaying)
              }}
            />
            {!isPlaying && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                aria-hidden
              >
                <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                  <Play className="h-8 w-8 text-white ml-1" />
                </div>
              </div>
            )}
          </div>
        ) : type === "video" ? (
          <div className="relative w-full h-full min-h-[200px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                variant="secondary"
                size="icon"
                className="w-16 h-16 rounded-full"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsPlaying(!isPlaying)
                }}
              >
                {isPlaying ? (
                  <Pause className="h-8 w-8" />
                ) : (
                  <Play className="h-8 w-8 ml-1" />
                )}
              </Button>
            </div>
          </div>
        ) : imageDisplayUrl ? (
          <Image
            src={imageDisplayUrl}
            alt="生成结果"
            fill
            className="object-contain"
            sizes="(max-width: 1280px) 100vw, 896px"
            priority
          />
        ) : (
          <div className="relative w-full h-full min-h-[200px]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20" />
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-muted-foreground">生成的图像预览</p>
            </div>
          </div>
        )}

        {hasMediaUrl && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
            <Button
              variant="secondary"
              size="icon"
              type="button"
              className="h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 shadow-md"
              onClick={(e) => {
                e.stopPropagation()
                handleDownload()
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              type="button"
              className="h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 shadow-md"
              onClick={(e) => {
                e.stopPropagation()
                handleShare()
              }}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              type="button"
              className="h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 shadow-md"
              onClick={(e) => {
                e.stopPropagation()
                if (imageDisplayUrl) setShowImagePreview(true)
                if (videoDisplayUrl) setShowVideoPreview(true)
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {prompt && (
        <div className="p-4 rounded-xl bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground mb-1">提示词</p>
          <p className="text-sm">{prompt}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          type="button"
          disabled={!hasMediaUrl}
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" />
          下载
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          type="button"
          disabled={!hasMediaUrl}
          onClick={handleShare}
        >
          <Share2 className="h-4 w-4 mr-2" />
          分享
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          type="button"
          onClick={() => setIsLiked(!isLiked)}
        >
          <Heart
            className={cn("h-4 w-4", isLiked && "fill-red-500 text-red-500")}
          />
        </Button>
        <Button variant="outline" size="icon" className="h-9 w-9" type="button">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <AnimatePresence>
        {showImagePreview && imageDisplayUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
            onClick={() => setShowImagePreview(false)}
          >
            <div
              className="absolute top-4 right-4 z-20 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="secondary"
                size="icon"
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={handleDownload}
              >
                <Download className="w-5 h-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={() => setShowImagePreview(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 relative flex items-center justify-center p-6 pt-16"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={imageDisplayUrl}
                alt="生成结果全屏"
                fill
                className="object-contain"
                sizes="100vw"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVideoPreview && videoDisplayUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
            onClick={() => setShowVideoPreview(false)}
          >
            <div
              className="absolute top-4 right-4 z-20 flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="secondary"
                size="icon"
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={handleDownload}
              >
                <Download className="w-5 h-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                type="button"
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white border-0"
                onClick={() => setShowVideoPreview(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div
              className="flex-1 flex flex-col items-center justify-center pt-14 pb-6 px-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full max-w-5xl flex-1 min-h-0 flex items-center justify-center">
                <video
                  ref={fsVideoRef}
                  src={videoDisplayUrl}
                  className="max-h-[70vh] w-full object-contain"
                  muted={isMuted}
                  playsInline
                  onTimeUpdate={() => handleTimeUpdate(fsVideoRef)}
                  onLoadedMetadata={() => handleLoadedMetadata(fsVideoRef)}
                  onEnded={() => setIsPlaying(false)}
                  onClick={() => setIsPlaying(!isPlaying)}
                />
                {!isPlaying && (
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center bg-black/30"
                    onClick={() => setIsPlaying(true)}
                    aria-label="播放"
                  >
                    <span className="w-20 h-20 rounded-full bg-black/60 flex items-center justify-center">
                      <Play className="w-10 h-10 text-white ml-1" />
                    </span>
                  </button>
                )}
              </div>
              <div className="w-full max-w-5xl mt-4 space-y-2">
                <div className="flex items-center gap-3 text-white">
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-10 w-10 text-white hover:bg-white/10 shrink-0"
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </Button>
                  <span className="text-xs font-mono text-white/80 w-12 shrink-0">
                    {formatTime(currentTime)}
                  </span>
                  <Slider
                    value={[currentTime]}
                    onValueChange={handleSeek}
                    max={Math.max(videoDuration, 0.1)}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-xs font-mono text-white/80 w-12 text-right shrink-0">
                    {formatTime(videoDuration)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    className="h-10 w-10 text-white hover:bg-white/10 shrink-0"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
