"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Search, Filter, TrendingUp, Clock, Star, ChevronRight, Palette, Film, GitBranch } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TemplateCard } from "@/components/marketplace/template-card"
import { styleTemplates, effectTemplates, workflowTemplates } from "@/lib/types/marketplace-data"

const featuredItems = [
  { ...styleTemplates[0], type: "style" as const },
  { ...effectTemplates[1], type: "effect" as const },
  { ...workflowTemplates[0], type: "workflow" as const },
]

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<"trending" | "latest" | "popular">("trending")

  const sections = [
    {
      title: "热门图片风格",
      icon: Palette,
      href: "/marketplace/styles",
      items: styleTemplates.slice(0, 4),
      type: "style" as const,
      color: "from-purple-500 to-pink-500",
    },
    {
      title: "精选视频特效",
      icon: Film,
      href: "/marketplace/effects",
      items: effectTemplates.slice(0, 4),
      type: "effect" as const,
      color: "from-orange-500 to-red-500",
    },
    {
      title: "实用工作流",
      icon: GitBranch,
      href: "/marketplace/workflows",
      items: workflowTemplates.slice(0, 4),
      type: "workflow" as const,
      color: "from-green-500 to-teal-500",
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">模板市场</h1>
              <p className="text-sm text-muted-foreground mt-1">
                浏览社区分享的图片风格、视频特效和工作流模板
              </p>
            </div>
            
            {/* Search and Filter */}
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索模板..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Sort Tabs */}
          <div className="mt-4 flex items-center gap-4">
            <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="trending" className="gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  热门
                </TabsTrigger>
                <TabsTrigger value="latest" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  最新
                </TabsTrigger>
                <TabsTrigger value="popular" className="gap-1.5">
                  <Star className="h-3.5 w-3.5" />
                  最多使用
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Featured Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 border border-primary/20 p-8 mb-12"
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <Badge className="mb-3 bg-primary/20 text-primary border-primary/30">
                本周精选
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                发现创作灵感
              </h2>
              <p className="text-muted-foreground mb-4">
                浏览数千个由社区创作者分享的模板，一键即可生成专业级作品，无需了解任何技术参数。
              </p>
              <div className="flex gap-3">
                <Button>
                  开始探索
                </Button>
                <Button variant="outline">
                  上传你的模板
                </Button>
              </div>
            </div>
            
            {/* Featured Items Preview */}
            <div className="flex gap-3">
              {featuredItems.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="w-28 h-28 rounded-xl overflow-hidden border border-border shadow-lg"
                  style={{
                    transform: `rotate(${(i - 1) * 5}deg)`,
                  }}
                >
                  <img
                    src={item.thumbnail}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Category Sections */}
        {sections.map((section, sectionIndex) => (
          <motion.section
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * sectionIndex }}
            className="mb-12"
          >
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center`}>
                  <section.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-semibold">{section.title}</h2>
              </div>
              <Link href={section.href}>
                <Button variant="ghost" className="gap-1">
                  查看全部
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {section.items.map((item, index) => (
                <TemplateCard
                  key={item.id}
                  template={item}
                  type={section.type}
                  index={index}
                />
              ))}
            </div>
          </motion.section>
        ))}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 p-6 rounded-2xl bg-card border border-border"
        >
          {[
            { label: "模板总数", value: "1,234+" },
            { label: "创作者", value: "567" },
            { label: "累计使用", value: "2.5M+" },
            { label: "本周新增", value: "89" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold gradient-text">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
