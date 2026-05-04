"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { 
  ArrowRight, 
  Palette, 
  Film, 
  GitBranch,
  Sparkles,
  Heart,
  Users
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"

const categories = [
  {
    icon: Palette,
    title: "图片风格",
    description: "赛博朋克、水墨山水、动漫插画等数百种风格模板",
    count: "200+",
    color: "from-purple-500 to-pink-500",
    href: "/dashboard/marketplace/styles",
    preview: [
      "https://images.unsplash.com/photo-1563089145-599997674d42?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&h=200&fit=crop",
    ],
  },
  {
    icon: Film,
    title: "视频特效",
    description: "电影转场、粒子特效、运镜追踪等专业级视频效果",
    count: "150+",
    color: "from-orange-500 to-red-500",
    href: "/dashboard/marketplace/effects",
    preview: [
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=200&h=200&fit=crop",
    ],
  },
  {
    icon: GitBranch,
    title: "工作流模板",
    description: "人像精修、超分放大、智能抠图等一键运行的 ComfyUI 工作流",
    count: "80+",
    color: "from-green-500 to-teal-500",
    href: "/dashboard/marketplace/workflows",
    preview: [
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=200&h=200&fit=crop",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&h=200&fit=crop",
    ],
  },
]

const stats = [
  { icon: Sparkles, value: "1,000+", label: "模板总数" },
  { icon: Users, value: "50,000+", label: "创作者" },
  { icon: Heart, value: "2.5M+", label: "累计使用" },
]

export function MarketplaceSection() {
  return (
    <section id="marketplace" className="py-24 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-accent/20 text-accent-foreground border-accent/30">
            全新上线
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-balance">
            模板市场
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            浏览社区创作者分享的风格、特效和工作流模板，无需了解任何参数，一键生成专业作品
          </p>
        </motion.div>

        {/* Category Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {categories.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link href={category.href}>
                <div className="group relative p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 h-full">
                  {/* Gradient Background on Hover */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                  
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center`}>
                      <category.icon className="h-6 w-6 text-white" />
                    </div>
                    <Badge variant="secondary" className="text-lg font-semibold">
                      {category.count}
                    </Badge>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                    {category.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {category.description}
                  </p>

                  {/* Preview Images */}
                  <div className="flex -space-x-3 mb-4">
                    {category.preview.map((img, i) => (
                      <div
                        key={i}
                        className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-background"
                        style={{ zIndex: 3 - i }}
                      >
                        <Image
                          src={img}
                          alt=""
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground border-2 border-background">
                      +{parseInt(category.count) - 3}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex items-center text-sm text-primary group-hover:translate-x-1 transition-transform">
                    探索{category.title}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 p-8 rounded-2xl bg-card/50 border border-border"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <stat.icon className="w-5 h-5 text-primary" />
                <span className="text-2xl sm:text-3xl font-bold gradient-text">
                  {stat.value}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link href="/dashboard/marketplace/index">
            <Button size="lg" className="gap-2">
              进入模板市场
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
