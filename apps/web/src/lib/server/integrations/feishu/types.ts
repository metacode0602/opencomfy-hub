import 'server-only'

export type FeishuWebhookPolicy = {
  auto_complete_on_approval?: boolean
  auto_create_enabled?: boolean
  auto_complete_batch_kinds?: string[]
}

export type FeishuBatchMetadata = {
  feishu?: {
    instance_id?: string
    instance_code?: string
    approval_code?: string
    create_status?: 'pending' | 'created' | 'failed'
    last_webhook_at?: string
    last_feishu_status?: string
    completion_source?: 'feishu_webhook' | 'refresh_batch_progress' | 'manual_ui'
    last_task_name?: string
  }
}

export type FeishuApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'DELETED'

export type FeishuCreateInstanceResult = {
  instance_id: string
  instance_code?: string
}

export type FeishuApprovalInstanceDetail = {
  instance_id: string
  instance_code?: string
  status?: FeishuApprovalStatus
  approval_name?: string
  form?: string
  task_list?: Array<{ id?: string; node_name?: string; status?: string; user_id?: string }>
}

export type FeishuWebhookEnvelope = {
  schema?: string
  type?: string
  challenge?: string
  token?: string
  encrypt?: string
  header?: {
    event_id?: string
    event_type?: string
    create_time?: string
    token?: string
  }
  event?: Record<string, unknown>
}

export type FeishuApprovalWebhookEvent = {
  instance_id?: string
  instance_code?: string
  status?: FeishuApprovalStatus | string
  approval_code?: string
  operate_time?: string
  task_id?: string
  task_name?: string
}

export const FEISHU_TERMINAL_BATCH_STATUSES = new Set(['已完成', '已取消'])

export const FEISHU_BATCH_KIND_LABELS: Record<string, string> = {
  online: '设备上架',
  order_access: '订单接入',
  device_retire: '设备下架',
  internal_occupancy: '内部占用',
}

export const FEISHU_APPROVAL_CODE_KEYS: Record<string, string> = {
  online: 'online',
  order_access: 'order_access',
  device_retire: 'device_retire',
  internal_occupancy: 'internal_occupancy',
}
