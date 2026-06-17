import 'server-only'

export type FeishuUserIdType = 'open_id' | 'union_id' | 'user_id'

/** 根据飞书用户 ID 前缀推断 ID 类型（Bitable 人员字段需与 user_id_type 一致） */
export function inferFeishuUserIdType(id: string): FeishuUserIdType {
  const trimmed = id.trim()
  if (trimmed.startsWith('ou_')) return 'open_id'
  if (trimmed.startsWith('on_')) return 'union_id'
  return 'user_id'
}

export function resolveFeishuUserIdTypeForIds(ids: string[]): FeishuUserIdType {
  const normalized = ids.map((id) => id.trim()).filter(Boolean)
  if (!normalized.length) return 'open_id'

  const types = [...new Set(normalized.map(inferFeishuUserIdType))]
  if (types.length > 1) {
    throw new Error(
      `人员 ID 类型不一致（${types.join('、')}），请统一使用 open_id（ou_ 开头）或 user_id（u- 开头等）`,
    )
  }
  return types[0]!
}

/** 从 Bitable create record 的 fields 中提取人员字段 id */
export function collectPersonFieldIds(fields: Record<string, unknown>): string[] {
  const ids: string[] = []
  for (const value of Object.values(fields)) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (item && typeof item === 'object' && 'id' in item) {
        const id = (item as { id?: unknown }).id
        if (typeof id === 'string' && id.trim()) ids.push(id.trim())
      }
    }
  }
  return ids
}

export function formatUserFieldConvFailHint(ids: string[]): string {
  const type = resolveFeishuUserIdTypeForIds(ids)
  const typeLabel =
    type === 'open_id' ? 'open_id（ou_ 开头）' : type === 'union_id' ? 'union_id（on_ 开头）' : 'user_id'
  return `人员字段写入失败（UserFieldConvFail）：请确认经办人/提交人使用的是当前飞书应用的 ${typeLabel}，且该用户存在于租户通讯录中。`
}
