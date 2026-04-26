import type { TemplateDefinition } from "@/lib/mvp/types"

export const MVP_TEMPLATES: TemplateDefinition[] = [
  {
    id: "anime-portrait",
    name: "二次元头像",
    description: "上传一张照片，生成二次元风格头像（Mock）。",
    outputType: "image",
    previewEmoji: "🧑‍🎨",
    fields: [
      {
        key: "prompt",
        label: "正向提示词",
        type: "string",
        required: true,
        placeholder: "例如：清新、柔光、细节丰富",
      },
      {
        key: "style",
        label: "风格",
        type: "enum",
        required: true,
        options: [
          { label: "日系清新", value: "japan-fresh" },
          { label: "赛博朋克", value: "cyberpunk" },
          { label: "水彩", value: "watercolor" },
        ],
      },
      {
        key: "seed",
        label: "随机种子",
        type: "number",
        min: 0,
        max: 999999,
        step: 1,
      },
    ],
    defaults: { prompt: "二次元头像，柔光，高质量", style: "japan-fresh", seed: 42 },
  },
  {
    id: "product-poster",
    name: "商品海报",
    description: "生成电商风格海报（Mock）。",
    outputType: "image",
    previewEmoji: "🛍️",
    fields: [
      { key: "title", label: "主标题", type: "string", required: true },
      { key: "subtitle", label: "副标题", type: "string" },
      {
        key: "aspectRatio",
        label: "画幅比例",
        type: "enum",
        required: true,
        options: [
          { label: "1:1", value: "1:1" },
          { label: "3:4", value: "3:4" },
          { label: "9:16", value: "9:16" },
        ],
      },
    ],
    defaults: { title: "春日上新", subtitle: "限时优惠", aspectRatio: "3:4" },
  },
  {
    id: "logo-idea",
    name: "Logo 灵感",
    description: "根据品牌名生成 logo 草图（Mock）。",
    outputType: "image",
    previewEmoji: "🔷",
    fields: [
      { key: "brand", label: "品牌名", type: "string", required: true },
      { key: "slogan", label: "标语", type: "string" },
      {
        key: "tone",
        label: "气质",
        type: "enum",
        required: true,
        options: [
          { label: "极简", value: "minimal" },
          { label: "科技", value: "tech" },
          { label: "复古", value: "retro" },
        ],
      },
    ],
    defaults: { brand: "OpenComfy", slogan: "Make it comfy", tone: "minimal" },
  },
  {
    id: "short-ad-video",
    name: "15 秒口播广告",
    description: "上传图片并生成 15 秒短视频（Mock）。",
    outputType: "video",
    previewEmoji: "🎬",
    fields: [
      { key: "script", label: "口播文案", type: "string", required: true },
      {
        key: "duration",
        label: "时长（秒）",
        type: "number",
        required: true,
        min: 5,
        max: 30,
        step: 1,
      },
      {
        key: "resolution",
        label: "分辨率",
        type: "enum",
        required: true,
        options: [
          { label: "720p", value: "1280x720" },
          { label: "1080p", value: "1920x1080" },
        ],
      },
    ],
    defaults: { script: "今天给大家推荐一款超好用的产品……", duration: 15, resolution: "1280x720" },
  },
  {
    id: "style-transfer",
    name: "风格迁移",
    description: "上传图像并应用风格（Mock）。",
    outputType: "image",
    previewEmoji: "🖼️",
    fields: [
      {
        key: "style",
        label: "风格",
        type: "enum",
        required: true,
        options: [
          { label: "油画", value: "oil" },
          { label: "素描", value: "sketch" },
          { label: "像素", value: "pixel" },
        ],
      },
      {
        key: "strength",
        label: "强度",
        type: "number",
        required: true,
        min: 0,
        max: 100,
        step: 1,
      },
    ],
    defaults: { style: "oil", strength: 60 },
  },
  {
    id: "cover-video",
    name: "封面动效",
    description: "生成带轻微动效的封面短视频（Mock）。",
    outputType: "video",
    previewEmoji: "✨",
    fields: [
      { key: "prompt", label: "主题描述", type: "string", required: true },
      {
        key: "motion",
        label: "动效强度",
        type: "number",
        required: true,
        min: 0,
        max: 100,
        step: 1,
      },
      {
        key: "duration",
        label: "时长（秒）",
        type: "number",
        required: true,
        min: 3,
        max: 12,
        step: 1,
      },
    ],
    defaults: { prompt: "霓虹光影背景", motion: 35, duration: 6 },
  },
]

export function getTemplateById(templateId: string) {
  return MVP_TEMPLATES.find((t) => t.id === templateId)
}
