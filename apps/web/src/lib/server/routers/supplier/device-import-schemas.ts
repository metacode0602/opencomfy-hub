import { z } from 'zod'

const parseStatusSchema = z.enum(['ok', 'warning', 'error'])

export const deviceInventoryRowSchema = z.object({
  row_no: z.number(),
  external_device_id: z.string().optional(),
  internal_ip: z.string().optional(),
  asset_no: z.string().optional(),
  sn: z.string().optional(),
  gpu_card_type_code: z.string().optional(),
  gpu_count: z.number().optional(),
  ops_status: z.string(),
  in_maintenance: z.boolean().optional(),
  bandwidth_group: z.string().optional(),
  rate_limit: z.string().optional(),
  cooperation_type: z.enum(['idle_time', 'whole_rent']).optional(),
  device_spec: z.string().optional(),
  received_at: z.string().optional(),
  remark: z.string().optional(),
  login_username: z.string().optional(),
  login_password: z.string().optional(),
  cluster_name: z.string().optional(),
  node_name: z.string().optional(),
  node_role: z.string().optional(),
  expected_service: z.string().optional(),
  parse_status: parseStatusSchema,
  parse_message: z.string().nullable().optional(),
  supplier_device_id: z.string().optional(),
})

export const deviceChangelogRowSchema = z.object({
  row_no: z.number(),
  external_device_id: z.string().optional(),
  internal_ip: z.string().optional(),
  occurred_at: z.string(),
  change_action: z.string(),
  change_content: z.string().optional(),
  description: z.string().optional(),
  ticket_no: z.string().optional(),
  parse_status: parseStatusSchema,
  parse_message: z.string().nullable().optional(),
})

export const faultRecordsRowSchema = z.object({
  row_no: z.number(),
  opened_at: z.string(),
  closed_at: z.string().optional(),
  fault_type: z.string(),
  impact_minutes: z.number().optional(),
  impact_scope: z.string().optional(),
  affected_device_count: z.number().optional(),
  postmortem: z.string().optional(),
  parse_status: parseStatusSchema,
  parse_message: z.string().nullable().optional(),
  fault_incident_id: z.string().optional(),
})

export const deviceImportCommitBaseSchema = z.object({
  supplierId: z.string().min(1),
  fileName: z.string().min(1),
  dataCenterId: z.string().min(1).optional(),
})
