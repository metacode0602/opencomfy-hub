"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import QRCode from "react-qr-code"
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
  Copy,
  Check,
  Loader2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Slider } from "@workspace/ui/components/slider"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"

export type ResultType = "image" | "video"

export interface GenerationResultData {
  id: string
  type: ResultType
  url: string
  /** 用于分享的公开链接（如 CDN）；不填则对 http(s) 或站内路径使用 url */
  shareUrl?: string
  thumbnailUrl?: string
  prompt?: string
  duration?: number
  width: number
  height: number
  model?: string
  createdAt: Date
  parameters?: Record<string, number | string>
}

function toAbsoluteShareUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw
  if (typeof window !== "undefined" && raw.startsWith("/")) {
    return `${window.location.origin}${raw}`
  }
  return raw
}

function getSharePayload(
  result: GenerationResultData | null,
  shareUrlOverride?: string
): { text: string; qrValue: string; canScanOnOtherDevices: boolean } {
  if (!result) return { text: "", qrValue: "", canScanOnOtherDevices: false }
  const raw = (shareUrlOverride ?? result.shareUrl ?? result.url).trim()
  if (!raw) return { text: "", qrValue: "", canScanOnOtherDevices: false }
  const absolute = toAbsoluteShareUrl(raw)
  const canScan = /^https?:\/\//i.test(absolute)
  return { text: absolute, qrValue: absolute, canScanOnOtherDevices: canScan }
}

async function downloadMedia(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = filename
      link.rel = "noopener"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.target = "_blank"
    link.rel = "noopener"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

interface ResultPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  result: GenerationResultData | null
  isGenerating?: boolean
  progress?: number
  onRegenerate?: () => void
  /** 下载完成后额外回调（例如统计） */
  onDownload?: () => void
  /** 打开分享弹窗时回调（例如统计） */
  onShare?: () => void
  /** 覆盖用于二维码与复制的链接，优先于 result.shareUrl / result.url */
  shareUrl?: string
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
  shareUrl: shareUrlProp,
  results,
  currentIndex = 0,
  onNavigate,
}: ResultPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sharePayload = useMemo(
    () => getSharePayload(result, shareUrlProp),
    [result, shareUrlProp]
  )

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
      setShareOpen(false)
      setCopied(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!shareOpen) setCopied(false)
  }, [shareOpen])

  useEffect(() => {
    if (!shareOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [shareOpen])

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

  const handleDownload = useCallback(async () => {
    if (!result?.url || isGenerating) return
    const ext = result.type === "video" ? "mp4" : "png"
    const filename = `comfyhub-${result.id}.${ext}`
    setIsDownloading(true)
    try {
      await downloadMedia(result.url, filename)
      onDownload?.()
    } finally {
      setIsDownloading(false)
    }
  }, [result, isGenerating, onDownload])

  const handleShareClick = () => {
    if (!result?.url || isGenerating) return
    onShare?.()
    setShareOpen(true)
  }

  const handleCopyShareLink = async () => {
    if (!sharePayload.text) {
      toast.error("暂无可复制的链接")
      return
    }
    try {
      await navigator.clipboard.writeText(sharePayload.text)
      setCopied(true)
      toast.success("链接已复制")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("复制失败，请手动选择链接复制")
    }
  }

  const canNavigatePrev = results && currentIndex > 0
  const canNavigateNext = results && currentIndex < results.length - 1

  if (!isOpen) return null

  return (
    <>
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
              className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 disabled:opacity-50"
              onClick={() => void handleDownload()}
              disabled={!result?.url || isGenerating || isDownloading}
              aria-label="下载"
            >
              {isDownloading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white border-0 disabled:opacity-50"
              onClick={handleShareClick}
              disabled={!result?.url || isGenerating}
              aria-label="分享"
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

    <AnimatePresence>
      {shareOpen && (
        <motion.div
          key="share-dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShareOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-sm rounded-2xl bg-background p-6 text-foreground shadow-xl ring-1 ring-foreground/10"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-9 w-9"
              onClick={() => setShareOpen(false)}
              aria-label="关闭分享"
            >
              <X className="h-5 w-5" />
            </Button>
            <h2 className="pr-10 font-heading text-lg font-medium">分享作品</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result?.type === "video"
                ? "扫码即可在手机上播放视频"
                : "扫码即可在手机上查看图片"}
            </p>
            {!sharePayload.text ? (
              <p className="mt-4 text-sm text-muted-foreground">暂无可用链接</p>
            ) : (
              <>
                {!sharePayload.canScanOnOtherDevices ? (
                  <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                    当前为临时或本地链接，其它设备扫码可能无法打开。若服务端提供了公开
                    CDN 地址，请设置 <code className="font-mono">shareUrl</code> 或{" "}
                    <code className="font-mono">result.shareUrl</code>。
                  </p>
                ) : (
                  <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
                    <QRCode value={sharePayload.qrValue} size={208} level="M" />
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <div className="min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
                    {sharePayload.text}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="shrink-0"
                    onClick={() => void handleCopyShareLink()}
                    aria-label="复制链接"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  )
}
