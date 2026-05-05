"use client"

import { motion } from "framer-motion"
import { Check, Sparkles } from "lucide-react"

const imageModels = [
  {
    name: "FLUX.1 Pro",
    badge: "推荐",
    description: "最新一代文生图模型，出图质量极高",
    features: ["4K 输出", "极致细节", "风格多样"],
  },
  {
    name: "Stable Diffusion XL",
    badge: "经典",
    description: "稳定可靠的开源模型，社区资源丰富",
    features: ["兼容性强", "LoRA 支持", "快速生成"],
  },
  {
    name: "Midjourney Style",
    badge: "艺术",
    description: "艺术风格突出，适合创意设计",
    features: ["艺术感强", "独特风格", "创意输出"],
  },
]

const videoModels = [
  {
    name: "Sora",
    badge: "顶级",
    description: "OpenAI 最强视频生成模型",
    features: ["长视频", "物理真实", "复杂场景"],
  },
  {
    name: "Runway Gen-3",
    badge: "专业",
    description: "专业级视频生成，运动自然流畅",
    features: ["运动控制", "风格迁移", "高清输出"],
  },
  {
    name: "Kling AI",
    badge: "高效",
    description: "快速高效的视频生成方案",
    features: ["快速生成", "性价比高", "效果稳定"],
  },
]

export function Models() {
  return (
    <section id="models" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm text-primary font-medium">模型矩阵</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-balance">
            汇聚顶级 AI 模型
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            集成业界最强大的图像和视频生成模型，一键切换，满足不同创作需求
          </p>
        </motion.div>

        {/* Image Models */}
        <div className="mb-16">
          <motion.h3
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-xl font-semibold mb-6 flex items-center gap-2"
          >
            <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-blue-400" />
            </span>
            图像生成模型
          </motion.h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {imageModels.map((model, index) => (
              <motion.div
                key={model.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-card border border-border hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">{model.name}</h4>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
                    {model.badge}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{model.description}</p>
                <ul className="space-y-2">
                  {model.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-blue-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Video Models */}
        <div>
          <motion.h3
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="text-xl font-semibold mb-6 flex items-center gap-2"
          >
            <span className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-pink-400" />
            </span>
            视频生成模型
          </motion.h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {videoModels.map((model, index) => (
              <motion.div
                key={model.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-6 rounded-2xl bg-card border border-border hover:border-pink-500/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">{model.name}</h4>
                  <span className="text-xs px-2 py-1 rounded-full bg-pink-500/20 text-pink-400">
                    {model.badge}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{model.description}</p>
                <ul className="space-y-2">
                  {model.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-pink-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
