// 图片风格模板数据
export interface StyleTemplate {
  id: string
  name: string
  description: string
  category: "portrait" | "landscape" | "anime" | "realistic" | "abstract" | "illustration"
  thumbnail: string
  author: string
  likes: number
  uses: number
  tags: string[]
  baseModel: string
  defaultPrompt?: string
  parameters: {
    steps: number
    cfgScale: number
    sampler: string
    width: number
    height: number
  }
  isAdvanced?: boolean
}

export const styleTemplates: StyleTemplate[] = [
  {
    id: "style-1",
    name: "赛博朋克霓虹",
    description: "充满未来感的霓虹城市风格，适合生成科幻场景、城市夜景和未来世界",
    category: "illustration",
    thumbnail: "https://images.unsplash.com/photo-1563089145-599997674d42?w=400&h=400&fit=crop",
    author: "Genesis官方",
    likes: 2847,
    uses: 15234,
    tags: ["赛博朋克", "霓虹", "未来", "城市"],
    baseModel: "FLUX Pro",
    defaultPrompt: "cyberpunk city, neon lights, rain, futuristic, detailed",
    parameters: {
      steps: 30,
      cfgScale: 7.5,
      sampler: "DPM++ 2M Karras",
      width: 1024,
      height: 1024,
    },
  },
  {
    id: "style-2",
    name: "水墨山水",
    description: "传统中国水墨画风格，山水意境，适合生成古典风景和东方美学作品",
    category: "landscape",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=400&fit=crop",
    author: "艺术工坊",
    likes: 1923,
    uses: 8721,
    tags: ["水墨", "山水", "中国风", "传统"],
    baseModel: "SDXL",
    defaultPrompt: "chinese ink painting, mountains, river, traditional, elegant",
    parameters: {
      steps: 25,
      cfgScale: 8,
      sampler: "Euler a",
      width: 1024,
      height: 768,
    },
  },
  {
    id: "style-3",
    name: "二次元动漫",
    description: "日式动漫插画风格，角色精致，色彩鲜艳，适合生成动漫角色和场景",
    category: "anime",
    thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=400&fit=crop",
    author: "动漫社区",
    likes: 4521,
    uses: 28934,
    tags: ["动漫", "二次元", "插画", "角色"],
    baseModel: "Animagine XL",
    defaultPrompt: "anime style, detailed, vibrant colors, high quality",
    parameters: {
      steps: 28,
      cfgScale: 7,
      sampler: "DPM++ SDE Karras",
      width: 832,
      height: 1216,
    },
  },
  {
    id: "style-4",
    name: "电影级写实",
    description: "好莱坞电影质感的超写实风格，光影细腻，适合生成逼真的人物和场景",
    category: "realistic",
    thumbnail: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=400&h=400&fit=crop",
    author: "Genesis官方",
    likes: 3156,
    uses: 19823,
    tags: ["写实", "电影", "人像", "质感"],
    baseModel: "FLUX Pro",
    defaultPrompt: "cinematic, photorealistic, 8k, detailed lighting, professional",
    parameters: {
      steps: 35,
      cfgScale: 6.5,
      sampler: "DPM++ 2M Karras",
      width: 1344,
      height: 768,
    },
  },
  {
    id: "style-5",
    name: "梦幻油画",
    description: "印象派油画风格，笔触可见，色彩朦胧，适合生成艺术感强的风景和人物",
    category: "abstract",
    thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=400&fit=crop",
    author: "艺术工坊",
    likes: 1678,
    uses: 7234,
    tags: ["油画", "印象派", "艺术", "梦幻"],
    baseModel: "SDXL",
    defaultPrompt: "oil painting style, impressionist, visible brushstrokes, dreamy",
    parameters: {
      steps: 30,
      cfgScale: 7.5,
      sampler: "Euler",
      width: 1024,
      height: 1024,
    },
  },
  {
    id: "style-6",
    name: "极简线条",
    description: "简约的线条艺术风格，适合生成 logo、图标和简约插画",
    category: "illustration",
    thumbnail: "https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400&h=400&fit=crop",
    author: "设计师联盟",
    likes: 892,
    uses: 4521,
    tags: ["极简", "线条", "设计", "简约"],
    baseModel: "FLUX Schnell",
    defaultPrompt: "minimalist line art, simple, clean, elegant design",
    parameters: {
      steps: 20,
      cfgScale: 8,
      sampler: "DPM++ 2M",
      width: 1024,
      height: 1024,
    },
  },
]

// 视频特效模板数据
export interface EffectTemplate {
  id: string
  name: string
  description: string
  category: "transition" | "motion" | "style" | "text" | "particle" | "dancing"
  thumbnail: string
  previewUrl?: string
  videoUrl?: string  // 视频地址
  author: string
  likes: number
  uses: number
  tags: string[]
  duration: number // 秒
  baseModel: string
  parameters: {
    fps: number
    motionStrength: number
    styleStrength: number
  }
  isAdvanced?: boolean
}


export const dancingTemplates: EffectTemplate[] = [
  {
    id: "zk-video",
    name: "璇非摇手势舞",
    description: "璇非摇手势舞，秋日心动指南，璇非摇",
    category: "dancing",
    thumbnail: "/assets/pics/yaofeiyao.png",
    videoUrl: "/assets/videos/xuanfeiyao.mp4",
    author: "Genesis官方",
    likes: 1823,
    uses: 12456,
    tags: ["转场", "璇非摇", "专业", "秋日心动"],
    duration: 3,
    baseModel: "Sora",
    parameters: {
      fps: 24,
      motionStrength: 0.7,
      styleStrength: 0.5,
    },
  },
]

export const effectTemplates: EffectTemplate[] = [
  {
    id: "effect-1",
    name: "电影转场",
    description: "专业的电影级转场效果，包含淡入淡出、滑动和缩放等多种变化",
    category: "transition",
    thumbnail: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=400&fit=crop",
    author: "Genesis官方",
    likes: 1823,
    uses: 12456,
    tags: ["转场", "电影", "专业", "过渡"],
    duration: 3,
    baseModel: "Sora",
    parameters: {
      fps: 24,
      motionStrength: 0.7,
      styleStrength: 0.5,
    },
  },
  {
    id: "effect-2",
    name: "粒子飘散",
    description: "物体化为粒子飘散的魔法效果，适合创造奇幻和科技感的视频",
    category: "particle",
    thumbnail: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400&h=400&fit=crop",
    author: "特效工作室",
    likes: 2341,
    uses: 8923,
    tags: ["粒子", "魔法", "特效", "炫酷"],
    duration: 4,
    baseModel: "Runway Gen-3",
    parameters: {
      fps: 30,
      motionStrength: 0.9,
      styleStrength: 0.6,
    },
  },
  {
    id: "effect-3",
    name: "动态追踪",
    description: "智能运镜追踪效果，让相机跟随主体移动，创造电影感",
    category: "motion",
    thumbnail: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&h=400&fit=crop",
    author: "Genesis官方",
    likes: 1567,
    uses: 7823,
    tags: ["运镜", "追踪", "动态", "电影"],
    duration: 5,
    baseModel: "Sora",
    parameters: {
      fps: 24,
      motionStrength: 0.6,
      styleStrength: 0.4,
    },
  },
  {
    id: "effect-4",
    name: "复古胶片",
    description: "80年代胶片电影的颗粒感和色彩，打造怀旧氛围",
    category: "style",
    thumbnail: "https://images.unsplash.com/photo-1518676590629-3dcbd9c5a5c9?w=400&h=400&fit=crop",
    author: "复古社区",
    likes: 1234,
    uses: 5623,
    tags: ["复古", "胶片", "怀旧", "80年代"],
    duration: 6,
    baseModel: "Runway Gen-3",
    parameters: {
      fps: 24,
      motionStrength: 0.3,
      styleStrength: 0.85,
    },
  },
  {
    id: "effect-5",
    name: "文字动效",
    description: "创意文字出场动画，支持多种字体和动画风格",
    category: "text",
    thumbnail: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=400&h=400&fit=crop",
    author: "设计师联盟",
    likes: 987,
    uses: 4521,
    tags: ["文字", "动画", "标题", "字幕"],
    duration: 2,
    baseModel: "Pika Labs",
    parameters: {
      fps: 30,
      motionStrength: 0.8,
      styleStrength: 0.5,
    },
  },
  {
    id: "effect-6",
    name: "时间凝固",
    description: "子弹时间效果，物体在空中静止，相机环绕拍摄",
    category: "motion",
    thumbnail: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&h=400&fit=crop",
    author: "特效工作室",
    likes: 2156,
    uses: 6234,
    tags: ["子弹时间", "慢动作", "360度", "特效"],
    duration: 4,
    baseModel: "Sora",
    parameters: {
      fps: 60,
      motionStrength: 1.0,
      styleStrength: 0.3,
    },
  },
]

// 工作流模板数据
export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: "image" | "video" | "upscale" | "inpaint" | "controlnet" | "custom"
  thumbnail: string
  author: string
  likes: number
  uses: number
  tags: string[]
  complexity: "beginner" | "intermediate" | "advanced"
  nodes: number
  estimatedTime: string
  inputs: {
    name: string
    type: "text" | "image" | "video" | "number" | "select"
    required: boolean
    description: string
    options?: string[]
  }[]
  isAdvanced?: boolean
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "workflow-1",
    name: "一键人像精修",
    description: "自动进行人像美化，包括磨皮、美白、瘦脸等功能，输出高质量人像",
    category: "image",
    thumbnail: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop",
    author: "Genesis官方",
    likes: 3421,
    uses: 23456,
    tags: ["人像", "精修", "美化", "一键"],
    complexity: "beginner",
    nodes: 8,
    estimatedTime: "10-15秒",
    inputs: [
      { name: "原始图片", type: "image", required: true, description: "上传需要精修的人像图片" },
      { name: "美化程度", type: "select", required: false, description: "选择美化强度", options: ["自然", "轻度", "中度", "重度"] },
    ],
  },
  {
    id: "workflow-2",
    name: "图片4K超分",
    description: "将低分辨率图片放大到4K，保持细节清晰，适合老照片修复和图片增强",
    category: "upscale",
    thumbnail: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&h=400&fit=crop",
    author: "Genesis官方",
    likes: 2876,
    uses: 18923,
    tags: ["超分", "4K", "放大", "增强"],
    complexity: "beginner",
    nodes: 5,
    estimatedTime: "20-30秒",
    inputs: [
      { name: "原始图片", type: "image", required: true, description: "上传需要放大的图片" },
      { name: "放大倍数", type: "select", required: false, description: "选择放大倍数", options: ["2x", "4x", "8x"] },
    ],
  },
  {
    id: "workflow-3",
    name: "智能抠图换背景",
    description: "自动识别主体并抠出，支持更换任意背景或生成新背景",
    category: "inpaint",
    thumbnail: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop",
    author: "Genesis官方",
    likes: 2543,
    uses: 15678,
    tags: ["抠图", "换背景", "智能", "合成"],
    complexity: "beginner",
    nodes: 12,
    estimatedTime: "15-25秒",
    inputs: [
      { name: "原始图片", type: "image", required: true, description: "上传需要抠图的图片" },
      { name: "新背景", type: "image", required: false, description: "上传新背景图片（可选）" },
      { name: "背景描述", type: "text", required: false, description: "或用文字描述想要的背景" },
    ],
  },
  {
    id: "workflow-4",
    name: "姿态控制生图",
    description: "使用ControlNet进行姿态控制，精确控制人物姿势生成图片",
    category: "controlnet",
    thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=400&fit=crop",
    author: "AI研究院",
    likes: 1987,
    uses: 9823,
    tags: ["姿态", "ControlNet", "精确控制", "人物"],
    complexity: "intermediate",
    nodes: 15,
    estimatedTime: "25-35秒",
    inputs: [
      { name: "参考姿态图", type: "image", required: true, description: "上传姿态参考图" },
      { name: "风格描述", type: "text", required: true, description: "描述想要的画面风格" },
      { name: "控制强度", type: "number", required: false, description: "姿态控制强度 (0.5-1.0)" },
    ],
  },
  {
    id: "workflow-5",
    name: "视频风格迁移",
    description: "将视频转换为指定的艺术风格，如油画、动漫、水彩等",
    category: "video",
    thumbnail: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&h=400&fit=crop",
    author: "视频工作室",
    likes: 1654,
    uses: 7234,
    tags: ["视频", "风格迁移", "艺术", "转换"],
    complexity: "intermediate",
    nodes: 22,
    estimatedTime: "1-3分钟",
    inputs: [
      { name: "原始视频", type: "video", required: true, description: "上传需要转换的视频" },
      { name: "目标风格", type: "select", required: true, description: "选择目标风格", options: ["油画", "动漫", "水彩", "素描", "赛博朋克"] },
    ],
  },
  {
    id: "workflow-6",
    name: "多角色场景生成",
    description: "高级工作流，支持在同一场景中生成多个不同角色，并保持风格一致",
    category: "custom",
    thumbnail: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=400&h=400&fit=crop",
    author: "AI研究院",
    likes: 1234,
    uses: 4567,
    tags: ["多角色", "场景", "高级", "一致性"],
    complexity: "advanced",
    nodes: 35,
    estimatedTime: "2-5分钟",
    inputs: [
      { name: "场景描述", type: "text", required: true, description: "描述整体场景" },
      { name: "角色1描述", type: "text", required: true, description: "第一个角色的描述" },
      { name: "角色2描述", type: "text", required: false, description: "第二个角色的描述" },
      { name: "角色3描述", type: "text", required: false, description: "第三个角色的描述" },
    ],
    isAdvanced: true,
  },
]

export const categories = {
  styles: [
    { id: "all", name: "全部" },
    { id: "portrait", name: "人像" },
    { id: "landscape", name: "风景" },
    { id: "anime", name: "动漫" },
    { id: "realistic", name: "写实" },
    { id: "abstract", name: "抽象" },
    { id: "illustration", name: "插画" },
  ],
  effects: [
    { id: "all", name: "全部" },
    { id: "transition", name: "转场" },
    { id: "motion", name: "运镜" },
    { id: "style", name: "风格" },
    { id: "text", name: "文字" },
    { id: "particle", name: "粒子" },
  ],
  workflows: [
    { id: "all", name: "全部" },
    { id: "image", name: "图片处理" },
    { id: "video", name: "视频处理" },
    { id: "upscale", name: "超分放大" },
    { id: "inpaint", name: "修复重绘" },
    { id: "controlnet", name: "精确控制" },
    { id: "custom", name: "自定义" },
  ],
}
