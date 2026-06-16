import 'server-only'

import { feishuApiRequest } from './feishu-http'
import type { FeishuCreateInstanceResult, FeishuApprovalInstanceDetail } from './types'
import type { FeishuRuntimeConfig } from './config'

async function feishuRequest<T>(
  config: FeishuRuntimeConfig,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  return feishuApiRequest<T>(config, method, path, { body })
}

export async function createFeishuApprovalInstance(
  config: FeishuRuntimeConfig,
  input: {
    approvalCode: string
    userOpenId: string
    form: string
  },
): Promise<FeishuCreateInstanceResult> {
  const data = await feishuRequest<{ instance_code?: string; instance_id?: string }>(
    config,
    'POST',
    '/approval/v4/instances',
    {
      approval_code: input.approvalCode,
      user_id: input.userOpenId,
      form: input.form,
    },
  )
  if (!data.instance_id) {
    throw new Error('飞书创建审批实例未返回 instance_id')
  }
  return {
    instance_id: data.instance_id,
    instance_code: data.instance_code,
  }
}

export async function getFeishuApprovalInstance(
  config: FeishuRuntimeConfig,
  instanceId: string,
): Promise<FeishuApprovalInstanceDetail> {
  const data = await feishuRequest<FeishuApprovalInstanceDetail>(
    config,
    'GET',
    `/approval/v4/instances/${encodeURIComponent(instanceId)}`,
  )
  return data
}

export function buildFeishuApprovalFormJson(
  config: FeishuRuntimeConfig,
  summaryText: string,
): string {
  if (config.approvalFormFieldId) {
    return JSON.stringify([
      {
        id: config.approvalFormFieldId,
        type: 'textarea',
        value: summaryText,
      },
    ])
  }
  return JSON.stringify([{ type: 'textarea', value: summaryText }])
}
