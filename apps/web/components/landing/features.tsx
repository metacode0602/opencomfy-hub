"use client"

import { motion } from "framer-motion"
import { 
  Wand2, 
  ImageIcon, 
  Video, 
  Play, 
  Layers, 
  Sparkles,
  Zap,
  Settings2,
  RefreshCw
} from "lucide-react"

const features = [
  {
    icon: Wand2,
    title: "文生图",
    description: "用自然语言描述你想要的画面，AI 将精准生成符合你想象的高质量图片。",
    color: "from-blue-500 to-purple-500",
  },
  {
    icon: ImageIcon,
    title: "图生图",
    description: "上传参考图片，AI 将基于图片风格和内容生成全新的创意作品。",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Video,
    title: "文生视频",
    description: "输入剧本描述，AI 自动生成流畅的视频内容，让创意动起来。",
    color: "from-pink-500 to-orange-500",
  },
  {
    icon: Play,
    title: "图生视频",
    description: "将静态图片转化为动态视频，赋予画面生命力。",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: RefreshCw,
    title: "参考生视频",
    description: "上传参考视频，AI 学习其风格和运动轨迹，生成相似效果的新视频。",
    color: "from-amber-500 to-green-500",
  },
  {
    icon: Layers,
    title: "ComfyUI 工作流",
    description: "支持导入和使用 ComfyUI 工作流，实现更复杂的创作流程。",
    color: "from-green-500 to-teal-500",
  },
]

const highlights = [
  {
    icon: Zap,
    title: "极速生成",
    description: "优化的 GPU 集群，秒级响应",
  },
  {
    icon: Settings2,
    title: "多模型切换",
    description: "支持 SD、FLUX、Sora 等主流模型",
  },
  {
    icon: Sparkles,
    title: "专业品质",
    description: "4K 高清输出，商业级质量",
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm text-primary font-medium">核心功能</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-balance">
            一站式 AI 创作平台
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            无论是静态图片还是动态视频，Genesis AI 都能帮你快速实现创意
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300"
            >
              {/* Gradient Background on Hover */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
              
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                <feature.icon className="h-6 w-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {highlights.map((item, index) => (
            <div key={item.title} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
