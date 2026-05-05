"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Play, Sparkles, Wand2, Video, ImageIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `linear-gradient(oklch(0.25 0.02 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.25 0.02 260) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">AI 创作新时代已来临</span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-balance"
        >
          <span className="block">用想象力创作</span>
          <span className="block gradient-text mt-2">图片与视频</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty"
        >
          无需编程，无需设计基础。只需描述你的想法，AI 将为你生成专业级的图片和视频内容。
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/dashboard/text-to-image">
            <Button size="lg" className="glow-primary text-lg px-8 h-12">
              免费开始创作
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="text-lg px-8 h-12">
            <Play className="mr-2 h-5 w-5" />
            观看演示
          </Button>
        </motion.div>

        {/* Feature Pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-3"
        >
          {[
            { icon: Wand2, label: "文生图", href: "/dashboard/text-to-image" },
            { icon: ImageIcon, label: "图生图", href: "/dashboard/image-to-image" },
            { icon: Video, label: "文生视频", href: "/dashboard/text-to-video" },
            { icon: Play, label: "图生视频", href: "/dashboard/image-to-video" },
          ].map((item, index) => (
            <Link href={item.href} key={item.label}>
            <div
              key={item.label}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-border"
            >
                <item.icon className="h-4 w-4 text-primary" />
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          ))}
        </motion.div>

        {/* Preview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 relative"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { gradient: "from-blue-500/20 to-purple-500/20", label: "赛博城市" },
              { gradient: "from-pink-500/20 to-orange-500/20", label: "梦幻森林" },
              { gradient: "from-green-500/20 to-teal-500/20", label: "未来科技" },
              { gradient: "from-amber-500/20 to-red-500/20", label: "奇幻世界" },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                className={`aspect-square rounded-2xl bg-gradient-to-br ${item.gradient} border border-border/50 flex items-center justify-center group cursor-pointer overflow-hidden relative`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors relative z-10">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
