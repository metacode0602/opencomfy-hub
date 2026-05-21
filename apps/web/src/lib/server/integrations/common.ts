export function objectToQueryString(params: Record<string, string | number | boolean>): string {
  return Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${params[key]}`)
    .join("&")
}
