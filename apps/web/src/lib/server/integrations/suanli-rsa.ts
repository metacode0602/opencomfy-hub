import "server-only"

import crypto from "node:crypto"

/** JSEncrypt sha256 DigestInfo 前缀（十六进制 ASCII 字符串） */
const SHA256_DIGEST_HEADER = "3031300d060960864801650304020105000420"

/** encryptlong 长文本分段加密块大小 */
const ENCRYPT_LONG_CHUNK_SIZE = 117

function stripKeyBase64(key: string): string {
  return key.replace(/^["']|["']$/g, "").replace(/\s/g, "")
}

function toPublicKeyPem(base64Key: string): string {
  const base64 = stripKeyBase64(base64Key)
  if (base64.includes("BEGIN")) {
    return base64
  }
  const wrapped = base64.match(/.{1,64}/g)?.join("\n") ?? base64
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`
}

function toPrivateKeyPem(base64Key: string): string {
  const base64 = stripKeyBase64(base64Key)
  if (base64.includes("BEGIN")) {
    return base64
  }
  const wrapped = base64.match(/.{1,64}/g)?.join("\n") ?? base64
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`
}

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex")
}

/** 复刻 JSEncrypt pkcs1pad1 + SHA256 DigestInfo 拼接规则 */
function pkcs1Pad1Digest(digestHexStr: string, keySizeBits: number): Buffer {
  const n = keySizeBits / 4
  const s = digestHexStr
  if (n < s.length + 22) {
    throw new Error("Message too long for RSA")
  }
  const len = n - s.length - 6
  let filler = ""
  for (let f = 0; f < len; f += 2) {
    filler += "ff"
  }
  const m = `0001${filler}00${s}`
  return Buffer.from(m, "hex")
}

function encryptChunkToHex(publicKeyPem: string, text: string): string {
  const encrypted = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(text, "utf8"),
  )
  let hex = encrypted.toString("hex")
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`
  }
  return hex
}

function hexToBase64(hex: string): string {
  return Buffer.from(hex, "hex").toString("base64")
}

/** RSA 公钥长文本加密（兼容 encryptlong.encryptLong 输出格式） */
export function rsaPubkEncrypt(publicKey: string, word: string): string {
  const publicKeyPem = toPublicKeyPem(publicKey)
  const modulusLength = crypto.createPublicKey(publicKeyPem).asymmetricKeyDetails?.modulusLength ?? 2048
  const maxLength = Math.floor((modulusLength + 7) / 8) - 11

  if (word.length > maxLength) {
    const chunks = word.match(new RegExp(`.{1,${ENCRYPT_LONG_CHUNK_SIZE}}`, "g")) ?? []
    const hex = chunks.map(chunk => encryptChunkToHex(publicKeyPem, chunk)).join("")
    return hexToBase64(hex)
  }

  return hexToBase64(encryptChunkToHex(publicKeyPem, word))
}

/** RSA 私钥签名（兼容 JSEncrypt.sign + CryptoJS.SHA256） */
export function rsaSign(privateKey: string, content: string): string {
  const privateKeyPem = toPrivateKeyPem(privateKey)
  const modulusLength = crypto.createPrivateKey(privateKeyPem).asymmetricKeyDetails?.modulusLength ?? 2048
  const digest = `${SHA256_DIGEST_HEADER}${sha256Hex(content)}`
  const padded = pkcs1Pad1Digest(digest, modulusLength)
  const signature = crypto.privateEncrypt(
    { key: privateKeyPem, padding: crypto.constants.RSA_NO_PADDING },
    padded,
  )
  return signature.toString("base64")
}
