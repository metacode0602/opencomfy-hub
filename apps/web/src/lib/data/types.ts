// 模拟数据类型定义

export interface Tenant {
  id: string
  name: string
  type: 'B' | 'C'
  status: 'active' | 'inactive' | 'suspended'
  contactPerson: string
  contactPhone: string
  contactEmail: string
  industry: string
  address: string
  createdAt: string
  projectCount: number
  totalRecharge: number
  totalConsumption: number
  balance: number
}

export interface Project {
  id: string
  name: string
  tenantId: string
  tenantName: string
  tenantType: 'B' | 'C'
  stage: 'lead' | 'testing' | 'converted'
  status: 'active' | 'paused' | 'completed'
  preSalesManager: string
  accountManager: string
  description: string
  createdAt: string
  startDate: string
  endDate?: string
  monthlyBudget: number
  totalConsumption: number
  balance: number
}

export interface Contract {
  id: string
  contractNo: string
  projectId: string
  projectName: string
  tenantId: string
  tenantName: string
  type: 'standard' | 'enterprise' | 'custom'
  status: 'draft' | 'pending' | 'active' | 'expired' | 'terminated'
  startDate: string
  endDate: string
  totalAmount: number
  paidAmount: number
  signedAt?: string
  signerName?: string
  terms: string
  createdAt: string
}

export interface Recharge {
  id: string
  tenantId: string
  projectId?: string
  amount: number
  paymentMethod: 'bank_transfer' | 'alipay' | 'wechat' | 'invoice'
  status: 'pending' | 'completed' | 'failed'
  transactionId: string
  createdAt: string
  completedAt?: string
}

export interface Consumption {
  id: string
  tenantId: string
  projectId: string
  productLine: 'serverless' | 'cloud_vm' | 'job' | 'bare_metal' | 'offline_order' | 'image_registry' | 'shared_storage' | 'object_storage'
  resourceName: string
  amount: number
  duration: number
  unit: 'hour' | 'day' | 'month' | 'count'
  createdAt: string
}

export interface Coupon {
  id: string
  tenantId: string
  projectId?: string
  code: string
  name: string
  type: 'discount' | 'cash'
  value: number
  minAmount: number
  status: 'active' | 'used' | 'expired'
  issuedAt: string
  expiredAt: string
  usedAt?: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  resourceType: 'serverless' | 'cloud_vm' | 'job' | 'bare_metal'
  gpuCount?: number
  cpuCount?: number
  memoryGB?: number
  startTime: string
  endTime?: string
  cost: number
}

export interface Order {
  id: string
  orderNo: string
  tenantId: string
  projectId: string
  productLine: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  amount: number
  items: OrderItem[]
  createdAt: string
  completedAt?: string
}

export interface OrderItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Activity {
  id: string
  projectId: string
  type: 'comment' | 'file' | 'task' | 'meeting' | 'stage_change' | 'recharge' | 'consumption'
  title: string
  description: string
  author: string
  authorRole: 'sales' | 'account_manager' | 'pre_sales' | 'system'
  attachments?: Attachment[]
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface Attachment {
  id: string
  name: string
  size: number
  type: string
  url: string
}

export interface Bill {
  id: string
  tenantId: string
  projectId: string
  projectName: string
  month: string
  totalAmount: number
  status: 'pending' | 'paid' | 'overdue'
  details: BillDetail[]
  dueDate: string
  paidAt?: string
}

export interface BillDetail {
  productLine: string
  resourceName: string
  usage: number
  unit: string
  unitPrice: number
  amount: number
}

// 产品线中文名称映射
export const productLineNames: Record<string, string> = {
  serverless: 'Serverless',
  cloud_vm: '云主机',
  job: 'Job 计算',
  bare_metal: '裸金属短租',
  offline_order: '线下订单',
  image_registry: '镜像仓库',
  shared_storage: '共享存储卷',
  object_storage: '对象存储加速',
}

// 阶段中文名称映射
export const stageNames: Record<string, string> = {
  lead: '线索孵化',
  testing: '测试中',
  converted: '已转正',
}

// 阶段颜色映射
export const stageColors: Record<string, string> = {
  lead: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  testing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
}

// 状态颜色映射
export const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  terminated: 'bg-red-500/20 text-red-400 border-red-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  used: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  negotiating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cooperating: 'bg-green-500/20 text-green-400 border-green-500/30',
}

// 供应商相关类型
export type CooperationMode = 'card_time' | 'revenue_share'

export interface Supplier {
  id: string
  name: string
  shortName: string
  status: 'negotiating' | 'cooperating' | 'suspended' | 'terminated'
  cooperationMode: CooperationMode
  revenueShareRatio?: number // 分成比例，仅分成模式使用
  businessManager: string // 商务经理
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  bankAccount?: string
  bankName?: string
  createdAt: string
  dataCenterCount: number
  totalDeviceCount: number
  monthlySettlement: number // 月结算金额
}

export interface SupplierContract {
  id: string
  contractNo: string
  supplierId: string
  supplierName: string
  type: 'cooperation' | 'supplement' | 'renewal'
  status: 'draft' | 'pending' | 'active' | 'expired' | 'terminated'
  cooperationMode: CooperationMode
  revenueShareRatio?: number
  startDate: string
  endDate: string
  terms: string
  signedAt?: string
  signerName?: string
  createdAt: string
}

export interface DataCenter {
  id: string
  supplierId: string
  supplierName: string
  name: string
  code: string
  location: string
  address: string
  status: 'online' | 'offline' | 'maintenance'
  networkFee: number // 网络费用 (月)
  managementNodeFee: number // 管控节点费用 (月)
  totalDeviceCount: number
  onlineDeviceCount: number
  createdAt: string
}

export interface GPUCardType {
  id: string
  name: string
  manufacturer: 'NVIDIA' | 'AMD' | 'Intel' | 'Huawei' | 'Other'
  memoryGB: number
  tdpWatts: number
  computeCapability?: string
}

export interface DataCenterDevice {
  id: string
  dataCenterId: string
  dataCenterName: string
  supplierId: string
  cardTypeId: string
  cardTypeName: string
  quantity: number
  onlineQuantity: number
  // 卡时模式成本
  cardTimeCostPerHour?: number
  // 分成模式成本
  revenueShareCostPerHour?: number
  status: 'online' | 'offline' | 'maintenance'
}

export interface SupplierBill {
  id: string
  supplierId: string
  supplierName: string
  month: string
  cooperationMode: CooperationMode
  status: 'pending' | 'confirmed' | 'paid'
  totalUsageHours: number
  totalAmount: number
  networkFee: number
  managementFee: number
  finalAmount: number
  details: SupplierBillDetail[]
  dueDate: string
  paidAt?: string
  createdAt: string
}

export interface SupplierBillDetail {
  dataCenterId: string
  dataCenterName: string
  cardTypeName: string
  usageHours: number
  unitCost: number
  amount: number
  tenantConsumption?: number // 租户实际消费（分成模式使用）
}

// 合作模式中文名称映射
export const cooperationModeNames: Record<CooperationMode, string> = {
  card_time: '卡时模式',
  revenue_share: '分成模式',
}

// 卡型制造商名称映射
export const manufacturerNames: Record<string, string> = {
  NVIDIA: 'NVIDIA',
  AMD: 'AMD',
  Intel: 'Intel',
  Huawei: '华为',
  Other: '其他',
}
