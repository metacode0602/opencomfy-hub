import { createHmac } from 'node:crypto'

export type ProjectActivityStorageDriver = 'local' | 'oss'

const OSS_URI_PREFIX = 'oss://'

export function getProjectActivityStorageDriver(): ProjectActivityStorageDriver {
  const driver = process.env.PROJECT_ACTIVITY_STORAGE_DRIVER?.trim().toLowerCase()
  return driver === 'oss' ? 'oss' : 'local'
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_').slice(0, 200)
}

function getOssConfig() {
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim()
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim()
  const bucket = process.env.OSS_BUCKET?.trim()
  const region = process.env.OSS_REGION?.trim() || 'oss-cn-hangzhou'

  if (!accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS 存储未配置：请设置 OSS_ACCESS_KEY_ID、OSS_ACCESS_KEY_SECRET、OSS_BUCKET')
  }

  const endpoint =
    process.env.OSS_ENDPOINT?.trim() || `${bucket}.${region}.aliyuncs.com`
  const publicBaseUrl =
    process.env.OSS_PUBLIC_BASE_URL?.trim()?.replace(/\/+$/, '') ||
    `https://${endpoint}`

  return { accessKeyId, accessKeySecret, bucket, endpoint, publicBaseUrl }
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

async function saveToOss(input: {
  projectId: string
  activityId: string
  fileName: string
  buffer: Buffer
  mimeType?: string
}): Promise<string> {
  const { accessKeyId, accessKeySecret, bucket, endpoint } = getOssConfig()
  const objectKey = [
    'project-activities',
    input.projectId,
    input.activityId,
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

export async function saveProjectActivityFile(input: {
  projectId: string
  activityId: string
  fileName: string
  buffer: Buffer
  mimeType?: string
}): Promise<string> {
  if (getProjectActivityStorageDriver() === 'oss') {
    return saveToOss(input)
  }
  const { saveLocalProjectActivityFile } = await import('./project-activity-local-storage')
  return saveLocalProjectActivityFile(input)
}

export async function readProjectActivityFile(storageUri: string): Promise<Buffer> {
  if (storageUri.startsWith('local://')) {
    const { readLocalProjectActivityFile } = await import('./project-activity-local-storage')
    return readLocalProjectActivityFile(storageUri)
  }

  if (storageUri.startsWith(OSS_URI_PREFIX)) {
    const rest = storageUri.slice(OSS_URI_PREFIX.length)
    const slash = rest.indexOf('/')
    if (slash <= 0) throw new Error('无效的 OSS 存储 URI')
    const bucket = rest.slice(0, slash)
    const objectKey = rest.slice(slash + 1)
    const { accessKeyId, accessKeySecret, bucket: configuredBucket, endpoint } = getOssConfig()
    if (bucket !== configuredBucket) {
      throw new Error('OSS bucket 不匹配')
    }

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
      headers: {
        Authorization: authorization,
        Date: date,
      },
    })

    if (!res.ok) {
      throw new Error(`从 OSS 读取文件失败 (${res.status})`)
    }

    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  throw new Error('不支持的存储 URI')
}

export function resolveProjectActivityDownloadUrl(attachmentId: string): string {
  return `/api/crm/project-activities/attachments/${attachmentId}`
}
