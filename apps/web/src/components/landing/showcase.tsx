"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, ImageIcon, Sparkles } from "lucide-react"

const categories = ["全部", "文生图", "图生图", "文生视频", "图生视频"]

const showcaseItems = [
  {
    id: 1,
    type: "文生图",
    title: "赛博朋克城市",
    prompt: "未来主义赛博朋克城市，霓虹灯光，雨夜，高楼大厦",
    gradient: "from-violet-600/35 to-indigo-600/25",
    isVideo: false,
  },
  {
    id: 2,
    type: "文生视频",
    title: "星际穿越",
    prompt: "宇宙飞船穿越虫洞，绚丽光效，科幻风格",
    gradient: "from-purple-600/35 to-fuchsia-600/25",
    isVideo: true,
  },
  {
    id: 3,
    type: "图生图",
    title: "水彩风景",
    prompt: "将照片转换为水彩画风格",
    gradient: "from-indigo-600/30 to-violet-500/25",
    isVideo: false,
  },
  {
    id: 4,
    type: "图生视频",
    title: "花朵绽放",
    prompt: "将静态花朵图片转为绽放动画",
    gradient: "from-fuchsia-600/30 to-pink-600/25",
    isVideo: true,
  },
  {
    id: 5,
    type: "文生图",
    title: "奇幻森林",
    prompt: "神秘的魔法森林，发光的蘑菇，精灵栖息地",
    gradient: "from-purple-500/35 to-violet-600/25",
    isVideo: false,
  },
  {
    id: 6,
    type: "文生视频",
    title: "海底世界",
    prompt: "绚丽的珊瑚礁，热带鱼群，阳光透过海面",
    gradient: "from-violet-500/30 to-purple-600/30",
    isVideo: true,
  },
]

export function Showcase() {
  const [activeCategory, setActiveCategory] = useState("全部")

  const filteredItems = activeCategory === "全部"
    ? showcaseItems
    : showcaseItems.filter(item => item.type === activeCategory)

  return (
    <section id="showcase" className="py-24 relative">
      {/* Background — 与 Hero 的 primary / accent 光晕同系 */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-accent/[0.04]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.55_0.15_280/0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.65_0.14_300/0.12),transparent)]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="text-sm text-primary font-medium">创作案例</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-balance text-foreground">
            探索<span className="gradient-text">无限可能</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            来自社区创作者的精选作品，展示 AI 创作的惊人能力
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                activeCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* Showcase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer ring-1 ring-border/40 shadow-sm transition-shadow hover:ring-primary/25 hover:shadow-md"
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient}`} />

                {/* Overlay — 底部略压暗，保证文案可读且与主题紫系协调 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/15 group-hover:from-black/55 group-hover:via-black/20 transition-colors" />

                {/* Type Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-full glass text-xs text-foreground">
                  {item.isVideo ? (
                    <Play className="h-3 w-3 text-primary" />
                  ) : (
                    <ImageIcon className="h-3 w-3 text-primary" />
                  )}
                  <span>{item.type}</span>
                </div>

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  <h3 className="text-lg font-semibold mb-1 text-white drop-shadow-sm">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/75 line-clamp-2">{item.prompt}</p>
                </div>

                {/* Hover Effect */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center text-primary-foreground shadow-lg glow-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
