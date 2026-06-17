export type FeishuWorkOrderBackend = 'bitable' | 'approval'

export type FeishuWorkOrderInboundChannel =
  | 'event_subscription'
  | 'bitable_automation'
  | 'dual'

/** CRM 侧字段键 → Bitable field_id */
export type FeishuWorkOrderFieldMapping = Partial<Record<FeishuWorkOrderFieldKey, string>>

export type FeishuWorkOrderFieldKey =
  | 'ticket_no'
  | 'module'
  | 'work_order_content'
  | 'work_order_status'
  | 'priority'
  | 'category'
  | 'assignees'
  | 'submitter'
  | 'remark'
  | 'handler_feedback'
  | 'completed_at'
  | 'attachments'

export type FeishuWorkOrderDefaults = {
  module?: string
  priority?: string
  category?: string
  initial_status?: string
  assignee_open_ids?: string[]
}

export type FeishuWorkOrderStatusSemantic =
  | 'pending_review'
  | 'pending_assign'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type FeishuWorkOrderStatusMapping = Record<string, FeishuWorkOrderStatusSemantic>

export type FeishuWorkOrderInboundPolicy = {
  timeline_on_every_sync?: boolean
  timeline_on_terminal_only?: boolean
  auto_sync_in_progress_status?: boolean
  dedupe_window_seconds?: number
}

export const DEFAULT_FEISHU_WORK_ORDER_INBOUND_POLICY: Required<FeishuWorkOrderInboundPolicy> = {
  timeline_on_every_sync: true,
  timeline_on_terminal_only: false,
  auto_sync_in_progress_status: true,
  dedupe_window_seconds: 60,
}

export type FeishuWorkOrderBitableConfigDto = {
  id: string
  appToken: string
  tableId: string
  viewId: string | null
  workOrderBackend: FeishuWorkOrderBackend
  fieldMappingJson: FeishuWorkOrderFieldMapping
  defaultsJson: FeishuWorkOrderDefaults
  statusMappingJson: FeishuWorkOrderStatusMapping
  inboundChannel: FeishuWorkOrderInboundChannel
  automationWebhookSecret: string | null
  automationToken: string | null
  inboundPolicyJson: FeishuWorkOrderInboundPolicy
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export const FEISHU_WORK_ORDER_FIELD_KEY_LABELS: Record<FeishuWorkOrderFieldKey, string> = {
  ticket_no: '工单ID编号（只读，建单后回填）',
  module: '所属模块',
  work_order_content: '工单内容',
  work_order_status: '当前状态',
  priority: '优先级',
  category: '工单分类',
  assignees: '经办人',
  submitter: '提交人',
  remark: '备注',
  handler_feedback: '工单处理反馈',
  completed_at: '工单完成时间',
  attachments: '截图或附件',
}

export const FEISHU_WORK_ORDER_BITABLE_COLUMN_SUGGESTIONS: Record<string, FeishuWorkOrderFieldKey> = {
  工单ID编号: 'ticket_no',
  所属模块: 'module',
  工单内容: 'work_order_content',
  当前状态: 'work_order_status',
  优先级: 'priority',
  工单分类: 'category',
  经办人: 'assignees',
  提交人: 'submitter',
  备注: 'remark',
  工单处理反馈: 'handler_feedback',
  工单完成时间: 'completed_at',
  截图或附件: 'attachments',
}

export const FEISHU_WORK_ORDER_INBOUND_CHANNEL_LABELS: Record<FeishuWorkOrderInboundChannel, string> = {
  bitable_automation: '多维表格自动化 HTTP（默认）',
  event_subscription: '开放平台事件订阅',
  dual: '双通道（迁移期）',
}

export const DEFAULT_FEISHU_WORK_ORDER_DEFAULTS: FeishuWorkOrderDefaults = {
  module: '资源接入',
  priority: '紧急-P0',
  category: '集群机器上下架',
  initial_status: '待审核',
  assignee_open_ids: [],
}

export const DEFAULT_FEISHU_WORK_ORDER_STATUS_MAPPING: FeishuWorkOrderStatusMapping = {
  待审核: 'pending_review',
  待分配: 'pending_assign',
  处理中: 'in_progress',
  已结束: 'completed',
  已终止: 'cancelled',
}

export type FeishuBitableAutomationInboundPayload = {
  source?: 'feishu_bitable_automation'
  record_id: string
  ticket_no?: string
  trigger?: string
  work_order_status: string
  previous_status?: string
  occurred_at?: string
  idempotency_key?: string
  fields: Record<string, unknown>
}
