import { createHmac } from 'node:crypto'

const OSS_URI_PREFIX = 'oss://'

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_').slice(0, 200)
}

function getOssConfig() {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim()
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim()
  const bucket = process.env.OSS_BUCKET?.trim()
  const region = process.env.OSS_REGION?.trim() || 'oss-cn-hangzhou'

  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS 存储未配置')
  }

  const endpoint = process.env.OSS_ENDPOINT?.trim() || `${bucket}.${region}.aliyuncs.com`
  return { accessKeyId, accessKeySecret, bucket, endpoint }
}

function buildOssAuthorization(
  method: string,
  contentType: string,
  date: string,
  resource: string,
  accessKeyId: string,
  accessKeySecret: string,
): string {
  const stringToSign = [method, '', contentType, date, resource].join('\n')
  const signature = createHmac('sha1', accessKeySecret).update(stringToSign).digest('base64')
  return `OSS ${accessKeyId}:${signature}`
}

export async function saveMerchantAttachmentToOss(input: {
  subdirKey: 'activity' | 'recharge'
  merchantId: string
  parentId: string
  fileName: string
  buffer: Buffer
  mimeType?: string
}): Promise<string> {
  const { accessKeyId, accessKeySecret, bucket, endpoint } = getOssConfig()
  const prefix = input.subdirKey === 'activity' ? 'merchant-activities' : 'merchant-recharge'
  const objectKey = [
    prefix,
    input.merchantId,
    input.parentId,
    `${crypto.randomUUID()}_${sanitizeFileName(input.fileName)}`,
  ].join('/')
  const resource = `/${bucket}/${objectKey}`
  const date = new Date().toUTCString()
  const contentType = input.mimeType || 'application/octet-stream'
  const authorization = buildOssAuthorization(
    'PUT',
    contentType,
    date,
    resource,
    accessKeyId,
    accessKeySecret,
  )

  const url = `https://${endpoint}/${objectKey}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      Date: date,
      'Content-Type': contentType,
      'Content-Length': String(input.buffer.length),
    },
    body: new Uint8Array(input.buffer),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`上传到 OSS 失败 (${res.status}): ${detail.slice(0, 200)}`)
  }

  return `${OSS_URI_PREFIX}${bucket}/${objectKey}`
}

export async function readMerchantAttachmentFromOss(storageUri: string): Promise<Buffer> {
  if (!storageUri.startsWith(OSS_URI_PREFIX)) {
    throw new Error('无效的 OSS URI')
  }
  const rest = storageUri.slice(OSS_URI_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) throw new Error('无效的 OSS URI')
  const bucket = rest.slice(0, slash)
  const objectKey = rest.slice(slash + 1)
  const { accessKeyId, accessKeySecret, bucket: configuredBucket, endpoint } = getOssConfig()
  if (bucket !== configuredBucket) throw new Error('OSS bucket 不匹配')

  const resource = `/${bucket}/${objectKey}`
  const date = new Date().toUTCString()
  const authorization = buildOssAuthorization(
    'GET',
    '',
    date,
    resource,
    accessKeyId,
    accessKeySecret,
  )
  const url = `https://${endpoint}/${objectKey}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: authorization, Date: date },
  })
  if (!res.ok) throw new Error(`读取 OSS 文件失败 (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}
