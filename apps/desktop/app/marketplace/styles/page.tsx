"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Search, Filter, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TemplateCard } from "@/components/marketplace/template-card"
import { styleTemplates, categories } from "@/lib/types/marketplace-data"
import { cn } from "@/lib/utils"

export default function StylesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")

  const filteredStyles = styleTemplates.filter((style) => {
    const matchesSearch = style.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      style.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      style.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = selectedCategory === "all" || style.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">图片风格</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  选择喜欢的风格，一键生成专属作品
                </p>
              </div>
              
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索风格..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="icon">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Categories */}
            <div className="flex gap-2 flex-wrap">
              {categories.styles.map((cat) => (
                <Badge
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedCategory === cat.id 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted"
                  )}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            共 {filteredStyles.length} 个风格
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredStyles.map((style, index) => (
            <TemplateCard
              key={style.id}
              template={style}
              type="style"
              index={index}
            />
          ))}
        </div>

        {filteredStyles.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-muted-foreground">没有找到匹配的风格</p>
            <Button 
              variant="link" 
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("all")
              }}
            >
              清除筛选条件
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
