import { crmLog } from '@/lib/server/dataaccess/crm/logger'

/** 相邻两次 OpenAPI 请求的最小间隔（毫秒） */
const MIN_INTERVAL_MS = Math.max(
  0,
  Number(process.env.SUANLI_BILLING_API_MIN_INTERVAL_MS ?? 400),
)

/** 分页翻页时的额外等待（毫秒） */
export const BILLING_API_PAGE_DELAY_MS = Math.max(
  0,
  Number(process.env.SUANLI_BILLING_API_PAGE_DELAY_MS ?? 300),
)

/** 账单明细逐账期请求时的额外等待（毫秒） */
export const BILLING_API_DETAIL_DELAY_MS = Math.max(
  0,
  Number(process.env.SUANLI_BILLING_API_DETAIL_DELAY_MS ?? 500),
)

/** 预览拉取各数据段之间的等待（毫秒） */
export const BILLING_IMPORT_SECTION_DELAY_MS = Math.max(
  0,
  Number(process.env.SUANLI_BILLING_IMPORT_SECTION_DELAY_MS ?? 600),
)

let lastRequestAt = 0

function sleep(ms: number) {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** 在发起下一次 OpenAPI 请求前调用，保证全局最小间隔 */
export async function throttleBillingApiRequest(label: string) {
  const now = Date.now()
  const waitMs = lastRequestAt + MIN_INTERVAL_MS - now
  if (waitMs > 0) {
    crmLog('suanli-billing-api', 'throttle', { label, waitMs })
    await sleep(waitMs)
  }
  lastRequestAt = Date.now()
}

export async function delayBillingApi(ms: number, label: string) {
  if (ms <= 0) return
  crmLog('suanli-billing-api', 'delay', { label, waitMs: ms })
  await sleep(ms)
}
