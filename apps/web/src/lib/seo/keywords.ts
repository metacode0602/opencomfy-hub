/**
 * SEO Keywords Configuration
 * 核心关键词、长尾关键词和地域性关键词配置
 */

export const coreKeywords = {
  zh: [
    
  ],
  en: [
   
  ],
}

export const longTailKeywords = {
  zh: [
   
  ],
  en: [
   
  ],
}

export const geoKeywords = {
  zh: [
    
  ],
  en: [
  
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

