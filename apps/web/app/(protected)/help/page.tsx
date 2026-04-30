"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  HelpCircle, 
  Book, 
  MessageCircle, 
  Video, 
  ChevronDown,
  ExternalLink,
  Search
} from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

const faqs = [
  {
    question: "如何开始使用文生图功能？",
    answer: "在文生图页面，选择一个模型，然后在提示词输入框中描述你想要生成的图片。你可以参考灵感提示来获取创意，也可以调整高级参数来优化生成效果。"
  },
  {
    question: "支持哪些图片和视频格式？",
    answer: "图片支持 JPG、PNG、WebP 格式，最大 10MB。视频支持 MP4、WebM 格式，最大 100MB。生成的内容可以导出为高清格式。"
  },
  {
    question: "如何获得更好的生成效果？",
    answer: "1. 使用详细、具体的描述词 2. 指定风格、光线、构图等细节 3. 适当调整引导系数和生成步数 4. 使用负面提示词排除不想要的元素"
  },
  {
    question: "ComfyUI 工作流如何使用？",
    answer: "你可以导入 ComfyUI 导出的 JSON 工作流文件，或使用我们预设的工作流模板。导入后可以直接运行，无需配置复杂的节点。"
  },
  {
    question: "生成的内容可以商用吗？",
    answer: "专业版和企业版用户生成的内容可用于商业用途。免费版仅供个人非商业使用。请查看服务条款了解详细的使用许可。"
  },
  {
    question: "如何提升生成速度？",
    answer: "升级到专业版或企业版可享受优先队列和更快的生成速度。你也可以适当降低分辨率和生成步数来加快速度。"
  },
]

const resources = [
  {
    icon: Book,
    title: "使用文档",
    description: "详细的功能说明和使用教程",
    href: "#",
  },
  {
    icon: Video,
    title: "视频教程",
    description: "观看视频学习如何使用",
    href: "#",
  },
  {
    icon: MessageCircle,
    title: "社区论坛",
    description: "与其他创作者交流经验",
    href: "#",
  },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">帮助中心</h1>
          <p className="text-muted-foreground">
            查找答案、浏览教程、获取支持
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索问题..."
            className="pl-10"
          />
        </div>

        {/* Resources */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resources.map((resource) => (
            <a
              key={resource.title}
              href={resource.href}
              className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <resource.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{resource.title}</h3>
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-muted-foreground">{resource.description}</p>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* FAQs */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">常见问题</h2>
          <div className="space-y-2">
            {filteredFaqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={false}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/50 transition-colors"
                >
                  <span className="font-medium pr-4">{faq.question}</span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform",
                      expandedFaq === index && "rotate-180"
                    )}
                  />
                </button>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pb-4"
                  >
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="p-6 rounded-xl border border-border bg-card text-center">
          <h3 className="font-semibold mb-2">还有其他问题？</h3>
          <p className="text-sm text-muted-foreground mb-4">
            我们的支持团队随时准备帮助你
          </p>
          <Button>联系客服</Button>
        </div>
      </div>
    </div>
  )
}
