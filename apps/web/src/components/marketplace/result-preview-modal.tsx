"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import {
  X,
  Download,
  Share2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"

export type ResultType = "image" | "video"

export interface GenerationResultData {
  id: string
  type: ResultType
  url: string
  thumbnailUrl?: string
  prompt?: string
  duration?: number
  width: number
  height: number
  model?: string
  createdAt: Date
  parameters?: Record<string, number | string>
}

interface ResultPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  result: GenerationResultData | null
  isGenerating?: boolean
  progress?: number
  onRegenerate?: () => void
  onDownload?: () => void
  onShare?: () => void
  results?: GenerationResultData[]
  currentIndex?: number
  onNavigate?: (index: number) => void
}

export function ResultPreviewModal({
  isOpen,
  onClose,
  result,
  isGenerating = false,
  progress = 0,
  onDownload,
  onShare,
  results,
  currentIndex = 0,
  onNavigate,
}: ResultPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play()
      } else {
        videoRef.current.pause()
      }
    }
  }, [isPlaying])

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [isOpen])

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0] ?? 0
      setCurrentTime(value[0] ?? 0)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const handleDownload = () => {
    if (result?.url && onDownload) {
      onDownload()
    } else if (result?.url) {
      const link = document.createElement("a")
      link.href = result.url
      link.download = `comfyhub-${result.id}.${result.type === "video" ? "mp4" : "png"}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const canNavigatePrev = results && currentIndex > 0
  const canNavigateNext = results && currentIndex < results.length - 1

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
        onClick={onClose}
      >
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            "relative flex flex-col",
            isFullscreen ? "w-full h-full" : "w-[95vw] h-[95vh] max-w-[1600px]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Action Bar */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={handleDownload}
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={onShare}
            >
              <Share2 className="w-5 h-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
              onClick={onClose}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex items-center justify-center relative">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center gap-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center"
                >
                  <Sparkles className="w-12 h-12 text-primary" />
                </motion.div>
                <div className="text-center text-white">
                  <p className="font-semibold text-xl">AI 正在创作中...</p>
                  <p className="text-sm text-white/60 mt-2">请耐心等待，精彩即将呈现</p>
                </div>
                <div className="w-80 space-y-3">
                  <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                  <div className="flex justify-between text-sm text-white/60">
                    <span>{Math.round(progress)}%</span>
                    <span>预计剩余 {Math.max(1, Math.ceil((100 - progress) / 10))} 秒</span>
                  </div>
                </div>
              </div>
            ) : result?.type === "video" ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={result.url}
                  className="max-w-full max-h-full object-contain"
                  muted={isMuted}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  onClick={() => setIsPlaying(!isPlaying)}
                />
                
                {/* Center Play Button */}
                {!isPlaying && (
                  <div 
                    className="absolute inset-0 flex items-center justify-center cursor-pointer"
                    onClick={() => setIsPlaying(true)}
                  >
                    <Button
                      variant="secondary"
                      size="icon"
                      className="w-20 h-20 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                    >
                      <Play className="w-10 h-10 ml-1" />
                    </Button>
                  </div>
                )}

                {/* Video Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-white hover:bg-white/20"
                      onClick={() => setIsPlaying(!isPlaying)}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>
                    <span className="text-sm text-white/80 w-14 font-mono">
                      {formatTime(currentTime)}
                    </span>
                    <Slider
                      value={[currentTime]}
                      onValueChange={handleSeek}
                      max={videoDuration}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-sm text-white/80 w-14 text-right font-mono">
                      {formatTime(videoDuration)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-white hover:bg-white/20"
                      onClick={() => setIsMuted(!isMuted)}
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-white hover:bg-white/20"
                      onClick={toggleFullscreen}
                    >
                      {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : result ? (
              <div className="relative w-full h-full flex items-center justify-center p-4">
                <Image
                  src={result.url}
                  alt="生成结果"
                  fill
                  className="object-contain"
                  sizes="95vw"
                />
                
                {/* Fullscreen Toggle */}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-6 right-6 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-white/60">
                <Sparkles className="w-16 h-16" />
                <p>暂无生成结果</p>
              </div>
            )}

            {/* Navigation Arrows */}
            {results && results.length > 1 && !isGenerating && (
              <>
                {canNavigatePrev && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                    onClick={() => onNavigate?.(currentIndex - 1)}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                )}
                {canNavigateNext && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                    onClick={() => onNavigate?.(currentIndex + 1)}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Thumbnail Navigation */}
          {results && results.length > 1 && !isGenerating && (
            <div className="flex justify-center gap-2 p-4">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => onNavigate?.(i)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    i === currentIndex 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <Image
                    src={r.thumbnailUrl || r.url}
                    alt={`结果 ${i + 1}`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
