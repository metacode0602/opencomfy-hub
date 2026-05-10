"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { Heart, Play, User, Sparkles, Clock, Layers } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import type { StyleTemplate, EffectTemplate, WorkflowTemplate } from "@/lib/types/marketplace-data"

interface TemplateCardProps {
  template: StyleTemplate | EffectTemplate | WorkflowTemplate
  type: "style" | "effect" | "workflow" | "dancing"
  index?: number
}

export function TemplateCard({ template, type, index = 0 }: TemplateCardProps) {
  const href = type === "dancing" ? `/dashboard/dancing/${template.id}` : `/dashboard/marketplace/${type}/${template.id}`
  
  const isWorkflow = type === "workflow"
  const workflow = isWorkflow ? (template as WorkflowTemplate) : null
  const isEffect = type === "effect"
  const effect = isEffect ? (template as EffectTemplate) : null

  const complexityColors = {
    beginner: "bg-green-500/20 text-green-400 border-green-500/30",
    intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    advanced: "bg-red-500/20 text-red-400 border-red-500/30",
  }

  const complexityLabels = {
    beginner: "入门",
    intermediate: "进阶",
    advanced: "高级",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={href}>
        <div className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300">
          {/* Thumbnail */}
          <div className="relative aspect-square overflow-hidden">
            <Image
              src={template.thumbnail}
              alt={template.name}
              fill
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Play Button for Effects */}
            {isEffect && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center">
                  <Play className="w-6 h-6 text-primary-foreground ml-1" />
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm">
                <Heart className="w-4 h-4" />
              </Button>
            </div>

            {/* Duration Badge for Effects */}
            {effect && (
              <div className="absolute bottom-3 right-3">
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                  <Clock className="w-3 h-3 mr-1" />
                  {effect.duration}秒
                </Badge>
              </div>
            )}

            {/* Complexity Badge for Workflows */}
            {workflow && (
              <div className="absolute top-3 left-3">
                <Badge className={cn("border", complexityColors[workflow.complexity])}>
                  {complexityLabels[workflow.complexity]}
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {template.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {template.description}
            </p>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {template.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs px-2 py-0">
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Meta Info */}
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                <span>{template.author}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" />
                  {template.likes.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  {template.uses.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Workflow specific info */}
            {workflow && (
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  {workflow.nodes} 节点
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {workflow.estimatedTime}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
