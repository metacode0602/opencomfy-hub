// 模拟数据类型定义（v3.0：Customer / Project / PlatformTenant）

/** 期望规模 — 单条卡型及数量 */
export type ExpectedScaleCardEntry = {
  cardTypeId: string
  cardCount: number
}

/** 期望规模 — 存储配置 */
export type ExpectedScaleStorage = {
  enabled: boolean
  storageType: 'shared_storage' | 'object_storage'
  sizeGB: number
}

/** 期望规模 — 业务线数量 */
export type ExpectedScaleProductLines = {
  /** 裸金属 */
  bareMetal: number
  /** 弹性服务 */
  elasticService: number
  /** Job */
  job: number
}

/** 客户期望规模（对应库表 expected_scale jsonb） */
export type CustomerExpectedScale = {
  cards: ExpectedScaleCardEntry[]
  storage: ExpectedScaleStorage
  productLines: ExpectedScaleProductLines
}

export const emptyExpectedScale: CustomerExpectedScale = {
  cards: [],
  storage: { enabled: false, storageType: 'shared_storage', sizeGB: 0 },
  productLines: { bareMetal: 0, elasticService: 0, job: 0 },
}

export function isExpectedScaleEmpty(scale: CustomerExpectedScale): boolean {
  const hasCards = scale.cards.some((c) => c.cardTypeId && c.cardCount > 0)
  const hasStorage = scale.storage.enabled && scale.storage.sizeGB > 0
  const pl = scale.productLines
  const hasProductLines =
    pl.bareMetal > 0 || pl.elasticService > 0 || pl.job > 0
  return !hasCards && !hasStorage && !hasProductLines
}

/** CRM 客户主体 */
export interface Customer {
  id: string
  name: string
  type: 'B' | 'C'
  status: 'active' | 'inactive' | 'suspended'
  contactPerson: string
  contactPhone: string
  contactEmail: string
  industry: string
  address: string
  /** 统一社会信用代码 */
  certCode?: string
  /** 销售经理 ID */
  salesManagerId?: string
  /** 销售经理姓名（展示用） */
  salesManagerName?: string
  /** 期望规模：卡型多选 */
  expectedScale?: CustomerExpectedScale | null
  createdAt: string
  projectCount: number
  totalRecharge: number
  totalConsumption: number
  /** 下属计费账户余额合计（派生，非持久化） */
  balance: number
}

/** 平台计费租户 */
export interface PlatformTenant {
  id: string
  customerId: string
  name: string
  platformTenantId?: string
  isDefault: boolean
  status: 'active' | 'inactive' | 'suspended'
  balance: number
}

/** 项目–计费账户关联 */
export interface ProjectTenant {
  id: string
  projectId: string
  tenantId: string
  role?: string
  bindingLabel?: string
  sortOrder: number
}

export interface Project {
  id: string
  name: string
  customerId: string
  customerName: string
  customerType: 'B' | 'C'
  primaryTenantId: string
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
  customerId: string
  customerName: string
  tenantId: string
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
  tenantId: string
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

/** 合同约定计价方式 */
export type ContractPricingMode =
  | 'card_time'
  | 'revenue_share'
  | 'tiered_card_time'
  | 'tiered_revenue_share'

export interface ContractPricingTier {
  tierOrder: number
  /** 阶梯起始累计卡时（含） */
  thresholdFromHours: number
  /** 阶梯结束累计卡时（不含），空表示无上限 */
  thresholdToHours?: number | null
  /** 卡时 / 阶梯卡时：元/小时 */
  unitPricePerHour?: number
  /** 分成 / 阶梯分成：供应商分成 % */
  revenueSharePercent?: number
}

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
  /** @deprecated 请优先使用 pricingMode；保留以兼容旧展示 */
  cooperationMode: CooperationMode
  pricingMode: ContractPricingMode
  /** 固定卡时价（元/小时） */
  unitPricePerHour?: number
  /** 固定分成比例 % */
  revenueShareRatio?: number
  /** 阶梯卡时 / 阶梯分成档位 */
  pricingTiers?: ContractPricingTier[]
  minCommitHours?: number
  settlementCycle?: 'monthly' | 'quarterly'
  startDate: string
  endDate: string
  terms: string
  signedAt?: string
  signerName?: string
  contractFileUrl?: string
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

export type GPUCardTypeManufacturer = 'NVIDIA' | 'AMD' | 'Intel' | 'Huawei' | 'Other'

export type GPUCardTypeStatus = 'active' | 'disabled'

export interface GPUCardType {
  id: string
  name: string
  manufacturer: GPUCardTypeManufacturer
  memoryGB: number
  tdpWatts: number
  computeCapability?: string
  status: GPUCardTypeStatus
  createdAt?: string
  updatedAt?: string
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
  /** 是否划入内部测试池 */
  isInternalTest?: boolean
  /** 内部测试占用范围，如 GPU0-GPU3 */
  internalTestScope?: string
  /** 内部测试计划结束时间 */
  internalTestUntil?: string | null
  updatedAt?: string
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
  tenantConsumption?: number // 客户实际消费（分成模式使用）
}

/** 供应商 × 机房 × 卡型 当前生效单价/分成配置 */
export interface SupplierPricingRecord {
  id: string
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  cardTypeId: string
  cardTypeName: string
  cooperationMode: CooperationMode
  /** 固定卡时 / 阶梯卡时 / 固定分成 / 阶梯分成 */
  pricingMode?: ContractPricingMode
  /** 卡时模式：元/卡时（固定卡时） */
  unitPricePerHour?: number
  /** 分成模式：供应商分成比例 %（固定分成） */
  revenueSharePercent?: number
  /** 阶梯卡时 / 阶梯分成档位 */
  pricingTiers?: ContractPricingTier[]
  effectiveFrom: string
  updatedAt: string
  updatedBy?: string
}

/** 单价/分成变更历史，用于追溯 */
export interface SupplierPricingHistory {
  id: string
  pricingRecordId: string
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  cardTypeId: string
  cardTypeName: string
  cooperationMode: CooperationMode
  previousUnitPricePerHour?: number
  newUnitPricePerHour?: number
  previousRevenueSharePercent?: number
  newRevenueSharePercent?: number
  changedAt: string
  changedBy: string
  reason?: string
}

// 合作模式中文名称映射
export const contractPricingModeNames: Record<ContractPricingMode, string> = {
  card_time: '固定卡时价',
  revenue_share: '固定分成',
  tiered_card_time: '阶梯卡时价',
  tiered_revenue_share: '阶梯分成',
}

export function isSharePricingMode(mode: ContractPricingMode): boolean {
  return mode === 'revenue_share' || mode === 'tiered_revenue_share'
}

// 卡型制造商名称映射
export const manufacturerNames: Record<string, string> = {
  NVIDIA: 'NVIDIA',
  AMD: 'AMD',
  Intel: 'Intel',
  Huawei: '华为',
  Other: '其他',
}
