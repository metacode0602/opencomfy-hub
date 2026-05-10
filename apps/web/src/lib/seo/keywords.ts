/**
 * SEO Keywords Configuration
 * 核心关键词、长尾关键词和地域性关键词配置
 */

export const coreKeywords = {
  zh: [
    'GEO生成式搜索引擎优化',
    'AI搜索营销',
    '生成式AI搜索优化',
    'AI搜索入口',
    '数字营销服务',
    '品牌增长',
  ],
  en: [
    'GEO generative engine optimization',
    'AI search marketing',
    'generative AI search optimization',
    'AI search entry',
    'digital marketing services',
    'brand growth',
  ],
}

export const longTailKeywords = {
  zh: [
    'GEO生成式搜索引擎优化服务',
    '如何抢占AI搜索入口',
    'AI搜索时代品牌营销策略',
    '生成式搜索引擎优化公司',
    'AI搜索优化解决方案',
    'GEO营销服务提供商',
    '企业AI搜索优化',
    '品牌在AI搜索中的曝光',
  ],
  en: [
    'GEO generative engine optimization services',
    'how to capture AI search entry',
    'brand marketing strategy in AI search era',
    'generative engine optimization company',
    'AI search optimization solutions',
    'GEO marketing service provider',
    'enterprise AI search optimization',
    'brand exposure in AI search',
  ],
}

export const geoKeywords = {
  zh: [
    '北京GEO优化服务',
    '上海AI搜索营销',
    '广州生成式搜索引擎优化',
    '北京数字营销公司',
    '上海品牌增长服务',
  ],
  en: [
    'Beijing GEO optimization services',
    'Shanghai AI search marketing',
    'Guangzhou generative engine optimization',
    'Beijing digital marketing company',
    'Shanghai brand growth services',
  ],
}

/**
 * 获取所有 SEO 关键词
 */
export function getAllSEOKeywords(locale: 'zh' | 'en' = 'zh'): string[] {
  return [
    ...coreKeywords[locale],
    ...longTailKeywords[locale],
    ...geoKeywords[locale],
  ]
}

/**
 * 获取核心关键词（用于 meta keywords）
 */
export function getCoreKeywords(locale: 'zh' | 'en' = 'zh'): string[] {
  return coreKeywords[locale]
}

/**
 * 获取长尾关键词（用于内容优化）
 */
export function getLongTailKeywords(locale: 'zh' | 'en' = 'zh'): string[] {
  return longTailKeywords[locale]
}

/**
 * 获取地域性关键词（用于地域 SEO）
 */
export function getGeoKeywords(locale: 'zh' | 'en' = 'zh'): string[] {
  return geoKeywords[locale]
}

