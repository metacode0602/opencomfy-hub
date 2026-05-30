import { z } from 'zod'

export const internalTestHoldCardLineSchema = z.object({
  gpuCardTypeId: z.string().min(1, '请选择卡型'),
  unitCount: z.number().int().positive('台数须为正整数'),
})

export const internalTestHoldCreateSchema = z.object({
  supplierId: z.string().min(1),
  dataCenterId: z.string().min(1),
  workOrderNo: z.string().trim().min(1, '请填写飞书审批工单号'),
  userName: z.string().trim().min(1, '请填写使用者'),
  department: z.enum(['product', 'rd', 'test']),
  settlementMode: z.enum(['whole_rent', 'idle_time']),
  holdFrom: z.string().min(1),
  holdUntil: z.string().optional().nullable(),
  remark: z.string().optional().nullable(),
  cardLines: z.array(internalTestHoldCardLineSchema).min(1, '请至少添加一行卡型与台数'),
})

export const internalTestHoldListSchema = z.object({
  search: z.string().optional(),
  activeOnly: z.enum(['all', 'yes', 'no']).optional(),
  supplierId: z.string().optional(),
  dataCenterId: z.string().optional(),
})

export const internalTestHoldLinkDevicesSchema = z.object({
  holdId: z.string().min(1),
  devices: z
    .array(
      z.object({
        internalIp: z.string().optional(),
        externalIp: z.string().optional(),
        port: z.string().optional(),
        rootAccount: z.string().trim().min(1),
        rootPassword: z.string().trim().min(1),
      }),
    )
    .min(1),
})

export const internalTestHoldEndSchema = z.object({
  holdId: z.string().min(1),
})

export const internalTestHoldUnlinkDeviceSchema = z.object({
  holdId: z.string().min(1),
  linkId: z.string().min(1),
})
