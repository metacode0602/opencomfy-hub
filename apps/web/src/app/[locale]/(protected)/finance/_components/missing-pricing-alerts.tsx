export type MissingPricingIssue = {
  regionCode: string
  gpuModel: string
  failureReason?: string
  matchedGpuCardTypeId?: string
  matchedDataCenterId?: string
  billingUnit?: string
  windowStart?: string
  windowEnd?: string
  orderId?: string
  orderedAt?: string
}

const PRICING_FAILURE_LABEL: Record<string, string> = {
  card_type_not_found: "卡型匹配失败",
  region_not_found: "机房匹配失败",
  pricing_pair_not_found: "机房×卡型成本未配置",
  platform_list_price_not_found: "平台刊例价未配置",
}

const BILLING_UNIT_LABEL: Record<string, string> = {
  hour: "小时",
  day: "天",
  week: "周",
  month: "月",
}

function formatWindowRange(windowStart?: string, windowEnd?: string): string {
  if (!windowStart || !windowEnd) return ""
  return `（${windowStart} ~ ${windowEnd}）`
}

function pricingFailureDetail(p: {
  regionCode: string
  gpuModel: string
  failureReason?: string
}): string {
  const label = PRICING_FAILURE_LABEL[p.failureReason ?? ""] ?? "成本配置缺失"
  return `${p.regionCode} × ${p.gpuModel}（${label}）`
}

function pricingPairFailureDetail(p: {
  regionCode: string
  gpuModel: string
  matchedGpuCardTypeId?: string
  matchedDataCenterId?: string
}): string {
  const cardTypeId = p.matchedGpuCardTypeId ?? "—"
  const dataCenterId = p.matchedDataCenterId ?? "—"
  return `${p.regionCode} × ${p.gpuModel} — 卡型 ID：${cardTypeId}，机房 ID：${dataCenterId}`
}

function baremetalPlatformIssueDetail(p: {
  regionCode: string
  gpuModel: string
  billingUnit?: string
  orderId?: string
  orderedAt?: string
}): string {
  const unitLabel = p.billingUnit ? BILLING_UNIT_LABEL[p.billingUnit] ?? p.billingUnit : "—"
  const pair = `${p.regionCode} × ${p.gpuModel} · ${unitLabel}租期`
  if (p.orderId) {
    return `订单 ${p.orderId} · ${pair} · 下单日 ${p.orderedAt ?? "—"}`
  }
  return pair
}

type MissingPricingAlertsProps = {
  message?: string | null
  missingPricing?: MissingPricingIssue[]
}

export function MissingPricingAlerts({
  message,
  missingPricing = [],
}: MissingPricingAlertsProps) {
  if (!message && missingPricing.length === 0) return null

  const cardTypeIssues = missingPricing.filter(
    (p) => p.failureReason === "card_type_not_found",
  )
  const regionIssues = missingPricing.filter(
    (p) => p.failureReason === "region_not_found",
  )
  const pairIssues = missingPricing.filter(
    (p) => p.failureReason === "pricing_pair_not_found" || !p.failureReason,
  )
  const platformIssues = missingPricing.filter(
    (p) => p.failureReason === "platform_list_price_not_found",
  )

  return (
    <div className="space-y-3" role="alert">
      {message ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive whitespace-pre-wrap">
          {message}
        </div>
      ) : null}
      {missingPricing.length > 0 ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-medium">以下账单区域×GPU 无法解析成本，计算已阻断：</p>
          {cardTypeIssues.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium">
                卡型匹配问题（请维护 gpu_card_type.code 或修正 Excel 设备型号）：
              </p>
              <ul className="mt-1 list-inside list-disc">
                {cardTypeIssues.map((p) => (
                  <li key={`card-${p.regionCode}-${p.gpuModel}`}>
                    {pricingFailureDetail(p)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {regionIssues.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium">
                机房匹配问题（请维护机房名称或修正 Excel 机房名称）：
              </p>
              <ul className="mt-1 list-inside list-disc">
                {regionIssues.map((p) => (
                  <li key={`region-${p.regionCode}-${p.gpuModel}`}>
                    {pricingFailureDetail(p)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {pairIssues.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium">机房×卡型成本未配置（请在供应商「卡型成本」维护）：</p>
              <ul className="mt-1 list-inside list-disc">
                {pairIssues.map((p) => (
                  <li key={`pair-${p.regionCode}-${p.gpuModel}`}>
                    {pricingPairFailureDetail(p)}
                    {formatWindowRange(p.windowStart, p.windowEnd)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {platformIssues.length > 0 ? (
            <div className="mt-2">
              <p className="font-medium">平台刊例价未配置（请在「平台定价」维护）：</p>
              <ul className="mt-1 list-inside list-disc">
                {platformIssues.map((p, idx) => (
                  <li key={`platform-${idx}-${p.gpuModel}-${p.orderId ?? ""}-${p.billingUnit ?? ""}`}>
                    {baremetalPlatformIssueDetail(p)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
