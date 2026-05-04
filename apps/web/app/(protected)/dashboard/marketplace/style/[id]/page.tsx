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
  Wand2,
  Download,
  Copy,
  Check
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Textarea } from "@workspace/ui/components/textarea"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Slider } from "@workspace/ui/components/slider"
import { Switch } from "@workspace/ui/components/switch"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import { StyleTemplate, styleTemplates } from "@/lib/types/marketplace-data"
import { cn } from "@workspace/ui/lib/utils"
import { ResultPreviewModal, GenerationResultData } from "@/components/marketplace/result-preview-modal"

export default function StyleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const template = styleTemplates.find((t) => t.id === id) || styleTemplates[0] as StyleTemplate
  
  const [prompt, setPrompt] = useState("")
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationResult, setGenerationResult] = useState<GenerationResultData | null>(null)
  const [generatedResults, setGeneratedResults] = useState<GenerationResultData[]>([])
  const [currentResultIndex, setCurrentResultIndex] = useState(0)
  
  // Advanced parameters
  const [steps, setSteps] = useState(template.parameters.steps)
  const [cfgScale, setCfgScale] = useState(template.parameters.cfgScale)
  const [sampler, setSampler] = useState(template.parameters.sampler)
  const [width, setWidth] = useState(template.parameters.width)
  const [height, setHeight] = useState(template.parameters.height)

  const handleCopyPrompt = () => {
    if (template.defaultPrompt) {
      navigator.clipboard.writeText(template.defaultPrompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleGenerate = () => {
    setIsGenerating(true)
    setShowResultModal(true)
    setGenerationProgress(0)
    setGenerationResult(null)

    // Simulate progress
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + Math.random() * 20
      })
    }, 400)

    // Simulate generation complete with multiple results
    setTimeout(() => {
      clearInterval(progressInterval)
      setGenerationProgress(100)
      setIsGenerating(false)
      
      // Generate 4 mock results
      const newResults: GenerationResultData[] = Array.from({ length: 4 }, (_, i) => ({
        id: `style-${Date.now()}-${i}`,
        type: "image" as const,
        url: exampleImages[i] || template.thumbnail,
        thumbnailUrl: exampleImages[i] || template.thumbnail,
        prompt: prompt || template.defaultPrompt || template.name,
        width: width,
        height: height,
        model: template.baseModel,
        createdAt: new Date(),
        parameters: {
          "迭代步数": steps.toString(),
          "提示词强度": cfgScale.toString(),
          "采样器": sampler,
          "尺寸": `${width}x${height}`,
        }
      }))
      
      setGeneratedResults(newResults)
      setGenerationResult(newResults[0] ?? null)
      setCurrentResultIndex(0)
    }, 3000)
  }

  const handleRegenerate = () => {
    setGenerationResult(null)
    setGeneratedResults([])
    handleGenerate()
  }

  const handleNavigateResult = (index: number) => {
    setCurrentResultIndex(index)
    setGenerationResult(generatedResults[index] ?? null)
  }

  // Example generated images (mock)
  const exampleImages = [
    template.thumbnail,
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&h=400&fit=crop",
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Back Button */}
        <Link href="/create/marketplace/styles">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回风格列表
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Template Info */}
          <div>
            {/* Main Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-square rounded-2xl overflow-hidden border border-border"
            >
              <Image
                src={template.thumbnail}
                alt={template.name}
                fill
                className="object-cover"
              />
            </motion.div>

            {/* Example Gallery */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              {exampleImages.map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Image
                    src={img}
                    alt={`示例 ${i + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>

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
              </div>

              {/* Default Prompt */}
              {template.defaultPrompt && (
                <div className="p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">默认提示词</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1"
                      onClick={handleCopyPrompt}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          复制
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.defaultPrompt}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Generation Panel */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="text-lg font-semibold mb-4">使用此风格生成</h2>

              {/* Prompt Input */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="prompt">描述你想要的画面</Label>
                  <Textarea
                    id="prompt"
                    placeholder="例如：一只可爱的猫咪坐在窗台上，阳光洒落..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="mt-2 min-h-[120px] resize-none"
                  />
                </div>

                {/* Model Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">使用模型：</span>
                  <Badge variant="outline">{template.baseModel}</Badge>
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
                      {/* Steps */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>迭代步数</Label>
                          <span className="text-muted-foreground">{steps}</span>
                        </div>
                        <Slider
                          value={[steps]}
                          onValueChange={([v]) => setSteps(v ?? 0)}
                          min={10}
                          max={50}
                          step={1}
                        />
                      </div>

                      {/* CFG Scale */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <Label>提示词强度</Label>
                          <span className="text-muted-foreground">{cfgScale}</span>
                        </div>
                        <Slider
                          value={[cfgScale]}
                          onValueChange={([v]) => setCfgScale(v ?? 0)}
                          min={1}
                          max={20}
                          step={0.5}
                        />
                      </div>

                      {/* Sampler */}
                      <div className="space-y-2">
                        <Label>采样器</Label>
                        <Select value={sampler} onValueChange={setSampler}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DPM++ 2M Karras">DPM++ 2M Karras</SelectItem>
                            <SelectItem value="DPM++ SDE Karras">DPM++ SDE Karras</SelectItem>
                            <SelectItem value="Euler a">Euler a</SelectItem>
                            <SelectItem value="Euler">Euler</SelectItem>
                            <SelectItem value="DDIM">DDIM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Dimensions */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>宽度</Label>
                          <Input
                            type="number"
                            value={width}
                            onChange={(e) => setWidth(Number(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>高度</Label>
                          <Input
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Generate Button */}
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      立即生成
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Tips */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <h3 className="font-medium text-sm mb-2">使用技巧</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>直接输入你想要的内容描述即可</li>
                <li>风格参数已为你预设好，无需调整</li>
                <li>开启高级模式可微调参数获得更好效果</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Result Preview Modal */}
      <ResultPreviewModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        result={generationResult}
        isGenerating={isGenerating}
        progress={generationProgress}
        onRegenerate={handleRegenerate}
        onDownload={() => console.log("Download")}
        onShare={() => console.log("Share")}
        results={generatedResults}
        currentIndex={currentResultIndex}
        onNavigate={handleNavigateResult}
      />
    </div>
  )
}
