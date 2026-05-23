/** 外网/内网地址规范化：支持 IPv4:端口、[IPv6]:端口、纯 IP */

function trimLower(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

/** 提取用于匹配的主机部分（IP 或域名），忽略端口 */
export function parseEndpointHost(value: string | null | undefined): string {
  const v = trimLower(value)
  if (!v) return ''

  if (v.startsWith('[')) {
    const end = v.indexOf(']')
    if (end > 0) return v.slice(1, end)
  }

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.exec(v)
  if (ipv4WithPort) return ipv4WithPort[1]!

  const lastColon = v.lastIndexOf(':')
  if (lastColon > 0 && v.includes('.') && !v.slice(lastColon + 1).includes('.')) {
    const maybePort = v.slice(lastColon + 1)
    if (/^\d{1,5}$/.test(maybePort)) {
      return v.slice(0, lastColon)
    }
  }

  return v
}

/** 两个外网/内网地址是否指向同一端点（完整相等或主机部分相等） */
export function endpointMatches(
  stored: string | null | undefined,
  incoming: string | null | undefined,
): boolean {
  const a = trimLower(stored)
  const b = trimLower(incoming)
  if (!a || !b) return false
  if (a === b) return true
  const hostA = parseEndpointHost(a)
  const hostB = parseEndpointHost(b)
  return hostA === hostB || hostA === b || a === hostB
}

export function hasAnyEndpoint(
  external: string | null | undefined,
  internal: string | null | undefined,
): boolean {
  return Boolean(trimLower(external) || trimLower(internal))
}
