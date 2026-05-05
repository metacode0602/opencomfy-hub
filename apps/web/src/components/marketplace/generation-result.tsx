"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { 
  Download, 
  Share2, 
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  X
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Slider } from "@workspace/ui/components/slider"

interface GenerationResultProps {
  type: "image" | "video"
  isGenerating: boolean
  result?: string
  prompt?: string
  progress?: number
  parameters?: Record<string, string | number>
  model?: string
}

export function GenerationResult({
  type,
  isGenerating,
  result,
  progress = 0,
}: GenerationResultProps) {
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [isFullscreenMode, setIsFullscreenMode] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fullscreenVideoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const activeVideoRef = showFullscreen ? fullscreenVideoRef : videoRef
    if (activeVideoRef.current) {
      if (isPlaying) {
        activeVideoRef.current.play()
      } else {
        activeVideoRef.current.pause()
      }
    }
  }, [isPlaying, showFullscreen])

  useEffect(() => {
    if (!showFullscreen) {
      setIsPlaying(false)
    }
  }, [showFullscreen])

  const handleTimeUpdate = (ref: React.RefObject<HTMLVideoElement | null>) => {
    if (ref.current) {
      setCurrentTime(ref.current.currentTime)
    }
  }

  const handleLoadedMetadata = (ref: React.RefObject<HTMLVideoElement | null>) => {
    if (ref.current) {
      setVideoDuration(ref.current.duration)
    }
  }

  const handleSeek = (value: number[]) => {
    const activeVideoRef = showFullscreen ? fullscreenVideoRef : videoRef
    if (activeVideoRef.current) {
      activeVideoRef.current.currentTime = value[0] ?? 0
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
      setIsFullscreenMode(true)
    } else {
      document.exitFullscreen()
      setIsFullscreenMode(false)
    }
  }

  const handleDownload = () => {
    const url = type === "video" 
      ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
      : "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1920&h=1080&fit=crop"
    const link = document.createElement("a")
    link.href = url
    link.download = `comfyhub-result.${type === "video" ? "mp4" : "png"}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
        <div className="w-48 space-y-2">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
              className="h-full bg-primary rounded-full"
            />
          </div>
          {progress > 0 && (
            <p className="text-xs text-muted-foreground text-center">{Math.round(progress)}%</p>
          )}
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
    <>
      <div 
        className="relative aspect-video rounded-xl overflow-hidden border border-border bg-black group cursor-pointer"
        onClick={() => setShowFullscreen(true)}
      >
        {type === "video" ? (
          <>
            <video
              ref={videoRef}
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
              className="w-full h-full object-contain"
              muted
              playsInline
              onTimeUpdate={() => handleTimeUpdate(videoRef)}
              onLoadedMetadata={() => handleLoadedMetadata(videoRef)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Button
                variant="secondary"
                size="icon"
                className="w-16 h-16 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowFullscreen(true)
                }}
              >
                <Play className="h-8 w-8 ml-1" />
              </Button>
            </div>
          </>
        ) : (
          <Image
            src="https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1920&h=1080&fit=crop"
            alt="生成结果"
            fill
            className="object-contain"
          />
        )}

        {/* Quick Actions */}
        <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="secondary" 
            size="icon" 
            className="h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
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
            className="h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
            onClick={(e) => {
              e.stopPropagation()
              // Share action
            }}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Fullscreen Modal */}
      <AnimatePresence>
        {showFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black"
            onClick={() => setShowFullscreen(false)}
          >
            <motion.div
              ref={containerRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full h-full flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Actions */}
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
                >
                  <Share2 className="w-5 h-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                  onClick={() => setShowFullscreen(false)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 flex items-center justify-center">
                {type === "video" ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      ref={fullscreenVideoRef}
                      src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                      className="max-w-full max-h-full object-contain"
                      muted={isMuted}
                      onTimeUpdate={() => handleTimeUpdate(fullscreenVideoRef)}
                      onLoadedMetadata={() => handleLoadedMetadata(fullscreenVideoRef)}
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
                          {isFullscreenMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center p-4">
                    <Image
                      src="https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=1920&h=1080&fit=crop"
                      alt="生成结果"
                      fill
                      className="object-contain"
                      sizes="100vw"
                    />
                    
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute bottom-6 right-6 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                      onClick={toggleFullscreen}
                    >
                      {isFullscreenMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
