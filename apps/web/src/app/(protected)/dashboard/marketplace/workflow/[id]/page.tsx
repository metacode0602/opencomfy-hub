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
  Layers,
  AlertCircle,
  X
} from "lucide-react"
  import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Textarea } from "@workspace/ui/components/textarea"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
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
import {
  Alert,
  AlertDescription,
} from "@workspace/ui/components/alert"
import { WorkflowTemplate, workflowTemplates } from "@/lib/types/marketplace-data"
import { cn } from "@/lib/utils"
import { ResultPreviewModal, GenerationResultData } from "@/components/marketplace/result-preview-modal"

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const template = workflowTemplates.find((t) => t.id === id) || workflowTemplates[0] as WorkflowTemplate
  
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationResult, setGenerationResult] = useState<GenerationResultData | null>(null)
  
  // Form state for inputs
  const [inputValues, setInputValues] = useState<Record<string, string | File | null>>({})
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({})

  const complexityColors = {
    beginner: "bg-green-500/20 text-green-400 border-green-500/30",
    intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    advanced: "bg-red-500/20 text-red-400 border-red-500/30",
  }

  const complexityLabels = {
    beginner: "入门级",
    intermediate: "进阶级",
    advanced: "高级",
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
        return prev + Math.random() * 12
      })
    }, 600)

    // Simulate generation complete
    setTimeout(() => {
      clearInterval(progressInterval)
      setGenerationProgress(100)
      setIsGenerating(false)
      
      // Determine result type based on workflow
      const isVideoWorkflow = template.tags.some(tag => 
        tag.includes("视频") || tag.includes("动画") || tag.includes("motion")
      )
      
      // Mock result data
      setGenerationResult({
        id: `workflow-${Date.now()}`,
        type: isVideoWorkflow ? "video" : "image",
        url: isVideoWorkflow 
          ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
          : template.thumbnail,
        thumbnailUrl: template.thumbnail,
        prompt: Object.entries(inputValues)
          .filter(([_, v]) => typeof v === "string" && v)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ") || template.name,
        duration: isVideoWorkflow ? 5 : undefined,
        width: 1920,
        height: 1080,
        model: "ComfyUI",
        createdAt: new Date(),
        parameters: {
          "工作流": template.name,
          "节点数": template.nodes.toString(),
          "复杂度": complexityLabels[template.complexity],
        }
      })
    }, 5000)
  }

  const handleRegenerate = () => {
    setGenerationResult(null)
    handleGenerate()
  }

  const handleFileUpload = (inputName: string, file: File) => {
    setInputValues((prev) => ({ ...prev, [inputName]: file }))
    setUploadedFiles((prev) => ({ ...prev, [inputName]: URL.createObjectURL(file) }))
  }

  const removeFile = (inputName: string) => {
    setInputValues((prev) => ({ ...prev, [inputName]: null }))
    setUploadedFiles((prev) => {
      const newFiles = { ...prev }
      delete newFiles[inputName]
      return newFiles
    })
  }

  const requiredInputsFilled = template.inputs
    .filter((i) => i.required)
    .every((i) => inputValues[i.name])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Back Button */}
        <Link href="/dashboard/marketplace/workflows">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="w-4 h-4" />
            返回工作流列表
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Template Info */}
          <div>
            {/* Main Image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative aspect-video rounded-2xl overflow-hidden border border-border"
            >
              <Image
                src={template.thumbnail}
                alt={template.name}
                fill
                className="object-cover"
              />
              {/* Complexity Badge */}
              <Badge className={cn("absolute top-4 left-4 border", complexityColors[template.complexity])}>
                {complexityLabels[template.complexity]}
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
              </div>

              {/* Specs */}
              <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="text-center">
                  <div className="text-lg font-semibold">{template.nodes}</div>
                  <div className="text-xs text-muted-foreground">工作流节点</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{template.estimatedTime}</div>
                  <div className="text-xs text-muted-foreground">预计时间</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold">{template.inputs.filter(i => i.required).length}</div>
                  <div className="text-xs text-muted-foreground">必填项</div>
                </div>
              </div>

              {/* Advanced Warning */}
              {template.isAdvanced && (
                <Alert className="border-yellow-500/30 bg-yellow-500/10">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="text-yellow-200">
                    这是一个高级工作流，需要一定的创作经验。建议先尝试入门级工作流。
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>

          {/* Right: Generation Panel */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h2 className="text-lg font-semibold mb-4">运行工作流</h2>

              <div className="space-y-5">
                {/* Dynamic Inputs */}
                {template.inputs.map((input) => (
                  <div key={input.name}>
                    <Label className="flex items-center gap-1">
                      {input.name}
                      {input.required && <span className="text-red-500">*</span>}
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">{input.description}</p>

                    {input.type === "text" && (
                      <Textarea
                        placeholder={`请输入${input.name}...`}
                        value={(inputValues[input.name] as string) || ""}
                        onChange={(e) => setInputValues((prev) => ({ ...prev, [input.name]: e.target.value }))}
                        className="min-h-[80px] resize-none"
                      />
                    )}

                    {input.type === "number" && (
                      <Input
                        type="number"
                        placeholder={`请输入${input.name}...`}
                        value={(inputValues[input.name] as string) || ""}
                        onChange={(e) => setInputValues((prev) => ({ ...prev, [input.name]: e.target.value }))}
                      />
                    )}

                    {input.type === "select" && input.options && (
                      <Select
                        value={(inputValues[input.name] as string) || ""}
                        onValueChange={(v) => setInputValues((prev) => ({ ...prev, [input.name]: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`选择${input.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {input.options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {(input.type === "image" || input.type === "video") && (
                      <div 
                        className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => document.getElementById(`upload-${input.name}`)?.click()}
                      >
                        {uploadedFiles[input.name] ? (
                          <div className="relative">
                            <div className="relative aspect-video max-w-[200px] mx-auto rounded-lg overflow-hidden">
                              {input.type === "image" ? (
                                <Image
                                  src={uploadedFiles[input.name] ?? ""}
                                  alt={input.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <video
                                  src={uploadedFiles[input.name]}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeFile(input.name)
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              点击上传{input.type === "image" ? "图片" : "视频"}
                            </p>
                          </>
                        )}
                        <input
                          id={`upload-${input.name}`}
                          type="file"
                          accept={input.type === "image" ? "image/*" : "video/*"}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleFileUpload(input.name, file)
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Advanced Mode Toggle */}
                {template.isAdvanced && (
                  <>
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">高级参数</span>
                      </div>
                      <Switch
                        checked={showAdvanced}
                        onCheckedChange={setShowAdvanced}
                      />
                    </div>

                    {showAdvanced && (
                      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between">
                            工作流节点参数
                            {isAdvancedOpen ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <p className="text-sm text-muted-foreground">
                            高级参数需要了解 ComfyUI 工作流原理。
                            <Link href="/dashboard/help" className="text-primary hover:underline ml-1">
                              查看文档
                            </Link>
                          </p>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </>
                )}

                {/* Generate Button */}
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={handleGenerate}
                  disabled={isGenerating || !requiredInputsFilled}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      运行中...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      运行工作流
                    </>
                  )}
                </Button>

                {!requiredInputsFilled && (
                  <p className="text-xs text-muted-foreground text-center">
                    请填写所有必填项后运行
                  </p>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <h3 className="font-medium text-sm mb-2">使用技巧</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>按照提示填写必要的输入项</li>
                <li>工作流会自动处理复杂的参数设置</li>
                <li>预计处理时间：{template.estimatedTime}</li>
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
      />
    </div>
  )
}
