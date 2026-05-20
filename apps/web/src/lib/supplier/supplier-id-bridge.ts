/** Mock 经营层 supplier id → 接入域 supplier id（演示用，接 tRPC 后由 API 统一） */
const MOCK_TO_DOMAIN: Record<string, string> = {
  sup1: "sup-huabei-01",
  sup2: "sup-huanan-01",
}

export function resolveDomainSupplierId(mockOrDomainId: string): string {
  return MOCK_TO_DOMAIN[mockOrDomainId] ?? mockOrDomainId
}

export function isDomainSupplierId(id: string): boolean {
  return id.startsWith("sup-") && id.includes("-")
}
