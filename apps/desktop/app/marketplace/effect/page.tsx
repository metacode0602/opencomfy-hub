"use client"

import { useState, use } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { 
  ArrowLeft, 
  Heart, 
  Share2, 
  Sparkles, 
  User, 
  Settings2,
  ChevronDown,
  ChevronUp,
  Play,
  Upload,
  Clock,
  Film
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { effectTemplates } from "@/lib/types/marketplace-data"
import { cn } from "@/lib/utils"
import { useRouter, useSearchParams } from "next/navigation"

export default function EffectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const sp = useSearchParams()
  const router = useRouter()
  const id = sp.get("id") ?? ""

  const template = effectTemplates.find((t) => t.id === id) || effectTemplates[0]
  
  const [description, setDescription] = useState("")
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  
  // Advanced parameters
  const [fps, setFps] = useState(template.parameters.fps)
  const [motionStrength, setMotionStrength] = useState(template.parameters.motionStrength)
  const [styleStrength, setStyleStrength] = useState(template.parameters.styleStrength)
  const [duration, setDuration] = useState(template.duration)

  const handleGenerate = () => {
    setIsGenerating(true)
    setTimeout(() => setIsGenerating(false), 4000)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Back Button */}
        <Link href="/marketplace/effects">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回特效列表
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Template Info */}
          <div>
            {/* Video Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-video rounded-2xl overflow-hidden border border-border bg-muted"
            >
              <Image
                src={template.thumbnail}
                alt={template.name}
                fill
                className="object-cover"
              />
              {/* Play Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                <Button size="lg" className="gap-2 rounded-full">
                  <Play className="w-5 h-5" />
                  预览特效
                </Button>
              </div>
              {/* Duration Badge */}
              <Badge className="absolute bottom-4 right-4 bg-background/80 backdrop-blur-sm">
                <Clock className="w-3 h-3 mr-1" />
                {template.duration}秒
              </Badge>
            </motion.div>

            {/* Template Info */}
            <div className="mt-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{template.name}</h1>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>{template.author}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsLiked(!isLiked)}
                  >
                    <Heart className={cn("w-4 h-4", isLiked && "fill-red-500 text-red-500")} />
                  </Button>
                  <Button variant="outline" size="icon">
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <p className="text-muted-foreground">{template.description}</p>

              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-6 text-sm">
                <span className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-muted-foreground" />
                  {template.likes.toLocaleString()} 喜欢
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                  {template.uses.toLocaleString()} 次使用
                </span>
                <span className="flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-muted-foreground" />
                  {template.baseModel}
                </span>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="text-center">
                  <div className="text-lg font-semibold">{template.parameters.fps}</div>
                  <div className="text-xs text-muted-foreground">帧率 (FPS)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{template.duration}s</div>
                  <div className="text-xs text-muted-foreground">时长</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{Math.round(template.parameters.motionStrength * 100)}%</div>
                  <div className="text-xs text-muted-foreground">运动强度</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Generation Panel */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="text-lg font-semibold mb-4">应用此特效</h2>

              <div className="space-y-4">
                {/* Upload Area */}
                <div>
                  <Label>上传素材图片/视频</Label>
                  <div 
                    className="mt-2 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    {uploadedImage ? (
                      <div className="relative aspect-video max-w-xs mx-auto rounded-lg overflow-hidden">
                        <Image
                          src={uploadedImage}
                          alt="上传的素材"
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          点击或拖拽上传图片/视频
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          支持 JPG, PNG, MP4, MOV
                        </p>
                      </>
                    )}
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setUploadedImage(URL.createObjectURL(file))
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description">效果描述（可选）</Label>
                  <Textarea
                    id="description"
                    placeholder="描述你想要的效果细节..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-2 min-h-[80px] resize-none"
                  />
                </div>

                {/* Advanced Mode Toggle */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">高级模式</span>
                  </div>
                  <Switch
                    checked={showAdvanced}
                    onCheckedChange={setShowAdvanced}
                  />
                </div>

                {/* Advanced Parameters */}
                {showAdvanced && (
                  <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        参数调整
                        {isAdvancedOpen ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-4">
                      {/* Duration */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>时长 (秒)</Label>
                          <span className="text-muted-foreground">{duration}s</span>
                        </div>
                        <Slider
                          value={[duration]}
                          onValueChange={([v]) => setDuration(v)}
                          min={1}
                          max={10}
                          step={1}
                        />
                      </div>

                      {/* FPS */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>帧率 (FPS)</Label>
                          <span className="text-muted-foreground">{fps}</span>
                        </div>
                        <Slider
                          value={[fps]}
                          onValueChange={([v]) => setFps(v)}
                          min={12}
                          max={60}
                          step={6}
                        />
                      </div>

                      {/* Motion Strength */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>运动强度</Label>
                          <span className="text-muted-foreground">{Math.round(motionStrength * 100)}%</span>
                        </div>
                        <Slider
                          value={[motionStrength * 100]}
                          onValueChange={([v]) => setMotionStrength(v / 100)}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>

                      {/* Style Strength */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>风格强度</Label>
                          <span className="text-muted-foreground">{Math.round(styleStrength * 100)}%</span>
                        </div>
                        <Slider
                          value={[styleStrength * 100]}
                          onValueChange={([v]) => setStyleStrength(v / 100)}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Generate Button */}
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={handleGenerate}
                  disabled={isGenerating || !uploadedImage}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      应用特效
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Tips */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <h3 className="font-medium text-sm mb-2">使用技巧</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>上传清晰的图片或视频效果更好</li>
                <li>特效参数已为你优化，可直接使用</li>
                <li>高级模式可调整时长、帧率等参数</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
