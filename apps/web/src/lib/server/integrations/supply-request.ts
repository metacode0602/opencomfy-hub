import "server-only"

import { objectToQueryString } from "./common"
import { rsaPubkEncrypt as rsaEncrypt, rsaSign } from "./suanli-rsa"

interface HttpHeaders {
  version: string
  timestamp: number
  "Content-Type"?: string
  token?: string
  sign_str?: string
}

interface UserTokenStore {
  token?: string
  rsa_pubk?: string
  rsa_prik?: string
}

interface RequestConfig {
  params?: Record<string, unknown>
  data?: Record<string, unknown> | object
}

interface ApiResponse<T = unknown> {
  code: string
  message: string
  data: T
}

const ENCRYPT_PATHS = [
  "/user/login/password_login",
  "/user/login/login_and_register",
  "/user/send_verify_code_encrypt",
  "/harbor/encrypt/create_user",
  "/harbor/encrypt/reset_password",
]

function getSupplyOpenApiConfig() {
  const baseUrl = (process.env.SUANLI_SUPPLY_OPENAPI_BASE_URL ?? "https://openapi.suanli.cn").replace(
    /\/$/,
    "",
  )
  const token =
    process.env.SUANLI_SUPPLY_OPENAPI_TOKEN ?? process.env.SUANLI_SUPPLY_OPENAPI_COOKIE ?? ""
  const rsaPublicKey = process.env.SUANLI_SUPPLY_OPENAPI_RSA_PUBLIC_KEY ?? ""
  const rsaPrivateKey = process.env.SUANLI_SUPPLY_OPENAPI_RSA_PRIVATE_KEY ?? ""

  return { baseUrl, token, rsaPublicKey, rsaPrivateKey }
}

function getUserToken(): UserTokenStore {
  const { token, rsaPublicKey, rsaPrivateKey } = getSupplyOpenApiConfig()
  return {
    token,
    rsa_pubk: rsaPublicKey,
    rsa_prik: rsaPrivateKey,
  }
}

function rsaPubkEncrypt(userToken: UserTokenStore, word: string, defaultPublicKey: string) {
  let usePubKey = defaultPublicKey
  if (userToken.token && userToken.rsa_pubk) {
    usePubKey = userToken.rsa_pubk
  }
  return rsaEncrypt(usePubKey, word)
}

function generateSignStr(rsa_prik: string, headers: HttpHeaders, dataStr: string, url: string | undefined): string {
  return rsaSign(
    rsa_prik,
    `/api${url}\n${headers.version}\n${headers.timestamp}\n${headers.token}\n${dataStr}`,
  )
}

function getStringByteSize(base64: string) {
  return Buffer.from(base64, "base64").length
}

function getSignAndTimestamp(
  rsa_prik: string,
  headers: HttpHeaders,
  dataStr: string,
  requestUrl: string,
  params?: Record<string, unknown>,
) {
  let configUrl = requestUrl
  if (params && Object.keys(params).length > 0) {
    configUrl = `${configUrl}?${objectToQueryString(params as Record<string, string | number | boolean>)}`
  }
  headers.sign_str = generateSignStr(rsa_prik, headers, dataStr, configUrl)
  if (getStringByteSize(headers.sign_str) !== 256) {
    headers.timestamp = Date.now()
    return getSignAndTimestamp(rsa_prik, headers, dataStr, requestUrl, params)
  }
  return headers
}

function buildRequestPayload(
  method: "GET" | "POST",
  url: string,
  config: RequestConfig,
  userToken: UserTokenStore,
  defaultPublicKey: string,
) {
  let headers: HttpHeaders = {
    version: "1.0.0",
    timestamp: Date.now(),
    "Content-Type": "application/json",
  }

  let dataStr = ""
  let requestBody: string | undefined
  let queryParams = config.params ? { ...config.params } : undefined
  let requestData = config.data ? { ...config.data } : undefined

  if (method === "POST" && requestData) {
    dataStr = JSON.stringify(requestData)
    let postPayload: string | Record<string, unknown> = requestData
    if (ENCRYPT_PATHS.includes(url)) {
      const encrypted = rsaPubkEncrypt(userToken, dataStr, defaultPublicKey) as string
      delete headers["Content-Type"]
      dataStr = encrypted
      postPayload = encrypted
    }
    requestBody = typeof postPayload === "string" ? postPayload : JSON.stringify(postPayload)
  }

  if (userToken.token && userToken.rsa_prik) {
    headers.token = userToken.token
    headers = getSignAndTimestamp(userToken.rsa_prik, headers, dataStr, url, queryParams)
  }

  return { headers, requestBody, queryParams }
}

async function suanliSupplyRequest<T = unknown>(
  method: "GET" | "POST",
  url: string,
  config: RequestConfig = {},
): Promise<T> {
  const { baseUrl, rsaPublicKey } = getSupplyOpenApiConfig()
  const userToken = getUserToken()
  const { headers, requestBody, queryParams } = buildRequestPayload(method, url, config, userToken, rsaPublicKey)

  let requestUrl = `${baseUrl}/api${url}`
  if (queryParams && Object.keys(queryParams).length > 0) {
    requestUrl = `${requestUrl}?${objectToQueryString(queryParams as Record<string, string | number | boolean>)}`
  }

  const fetchHeaders = new Headers()
  fetchHeaders.set("version", headers.version)
  fetchHeaders.set("timestamp", String(headers.timestamp))
  if (headers.token) {
    fetchHeaders.set("token", headers.token)
  }
  if (headers.sign_str) {
    fetchHeaders.set("sign_str", headers.sign_str)
  }
  if (headers["Content-Type"]) {
    fetchHeaders.set("Content-Type", headers["Content-Type"])
  }

  const response = await fetch(requestUrl, {
    method,
    headers: fetchHeaders,
    body: method === "POST" ? requestBody : undefined,
    cache: "no-store",
  })
  console.log("suanliSupplyRequest requestUrl", requestUrl, "fetchHeaders", fetchHeaders, "response", response)
  let result: ApiResponse<T>
  try {
    result = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error("系统异常")
  }

  if (result.code === "0000") {
    return result.data
  }

  if (result.code === "A003" || result.code === "C003") {
    throw new Error(result.message || "登录已失效，请更新 SUANLI_SUPPLY_OPENAPI_TOKEN")
  }

  throw Object.assign(new Error(result.message || "请求失败"), {
    code: result.code,
    message: result.message,
  })
}

const supplyInstance = {
  get<T = unknown>(url: string, config?: { params?: Record<string, unknown> }): Promise<T> {
    return suanliSupplyRequest<T>("GET", url, config ?? {})
  },
  post<T = unknown>(url: string, data?: Record<string, unknown> | object): Promise<T> {
    return suanliSupplyRequest<T>("POST", url, { data })
  },
}

export default supplyInstance
