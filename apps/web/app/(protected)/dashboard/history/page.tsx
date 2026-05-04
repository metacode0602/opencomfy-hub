"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  History, 
  ImageIcon, 
  Video, 
  Download, 
  Trash2, 
  RotateCcw,
  Search,
  Filter,
  Calendar
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

interface HistoryItem {
  id: string
  type: "image" | "video"
  prompt: string
  model: string
  createdAt: string
  gradient: string
}

const mockHistory: HistoryItem[] = [
  {
    id: "1",
    type: "image",
    prompt: "赛博朋克城市，霓虹灯光，雨夜",
    model: "FLUX.1 Pro",
    createdAt: "2026-04-19 14:30",
    gradient: "from-cyan-500/30 to-blue-500/30",
  },
  {
    id: "2",
    type: "video",
    prompt: "宇宙飞船穿越虫洞",
    model: "Sora",
    createdAt: "2026-04-19 13:15",
    gradient: "from-purple-500/30 to-pink-500/30",
  },
  {
    id: "3",
    type: "image",
    prompt: "魔法森林，发光的蘑菇",
    model: "Stable Diffusion XL",
    createdAt: "2026-04-19 12:00",
    gradient: "from-green-500/30 to-emerald-500/30",
  },
  {
    id: "4",
    type: "video",
    prompt: "樱花花瓣随风飘落",
    model: "Runway Gen-3",
    createdAt: "2026-04-18 18:45",
    gradient: "from-pink-500/30 to-rose-500/30",
  },
  {
    id: "5",
    type: "image",
    prompt: "未来主义建筑，极简设计",
    model: "FLUX.1 Pro",
    createdAt: "2026-04-18 16:20",
    gradient: "from-gray-500/30 to-slate-500/30",
  },
  {
    id: "6",
    type: "image",
    prompt: "水彩风格的山水画",
    model: "Midjourney Style",
    createdAt: "2026-04-18 14:10",
    gradient: "from-blue-500/30 to-indigo-500/30",
  },
]

const filterOptions = [
  { id: "all", label: "全部" },
  { id: "image", label: "图片" },
  { id: "video", label: "视频" },
]

export default function HistoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const filteredHistory = mockHistory.filter((item) => {
    const matchesSearch = item.prompt.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = activeFilter === "all" || item.type === activeFilter
    return matchesSearch && matchesFilter
  })

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <History className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">历史记录</h1>
              <p className="text-sm text-muted-foreground">查看和管理你的创作历史</p>
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                已选择 {selectedItems.length} 项
              </span>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                下载
              </Button>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </Button>
            </div>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索提示词..."
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.id}
                variant={activeFilter === option.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* History Grid */}
        {filteredHistory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHistory.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "group relative rounded-xl overflow-hidden border transition-all cursor-pointer",
                  selectedItems.includes(item.id)
                    ? "border-primary ring-2 ring-primary/50"
                    : "border-border hover:border-primary/50"
                )}
                onClick={() => toggleSelect(item.id)}
              >
                {/* Preview */}
                <div className={cn(
                  "aspect-video bg-gradient-to-br",
                  item.gradient
                )}>
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm text-xs">
                      {item.type === "video" ? (
                        <Video className="h-3 w-3" />
                      ) : (
                        <ImageIcon className="h-3 w-3" />
                      )}
                      {item.type === "video" ? "视频" : "图片"}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 bg-card">
                  <p className="text-sm font-medium line-clamp-1 mb-1">{item.prompt}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.model}</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{item.createdAt}</span>
                    </div>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="secondary" size="icon" className="h-8 w-8">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="icon" className="h-8 w-8">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Selection Indicator */}
                {selectedItems.includes(item.id) && (
                  <div className="absolute top-3 left-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-muted-foreground">暂无历史记录</p>
            <p className="text-sm text-muted-foreground mt-1">
              你的创作历史将显示在这里
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
