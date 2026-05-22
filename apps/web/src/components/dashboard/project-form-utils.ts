import { getBusinessLineById } from '@/lib/data/mock-data'
import { resolveDefaultStaffId } from '@/lib/crm/staff-constants'
import type { UserStaff } from '@/lib/types/crm'
import type { BusinessLine, Project } from '@/lib/data/types'
import type { ProjectFormValues } from './project-form-fields'

export function getStaffIdByName(name: string, staff: UserStaff[]): string | undefined {
  return staff.find((m) => m.display_name === name)?.id
}

export function emptyProjectFormValues(staff: UserStaff[] = []): ProjectFormValues {
  return {
    customerId: '',
    primaryTenantId: '',
    name: '',
    description: '',
    stage: 'lead',
    businessLineId: '',
    preSalesStaffId: resolveDefaultStaffId(staff, 'pre_sales') ?? '',
    accountManagerStaffId: resolveDefaultStaffId(staff, 'account_manager') ?? '',
    deliveryManagerStaffId: resolveDefaultStaffId(staff, 'delivery_manager') ?? '',
    projectManagerStaffId: resolveDefaultStaffId(staff, 'project_manager') ?? '',
    monthlyBudget: '',
    startDate: '',
  }
}

export function projectToFormValues(project: Project, staff: UserStaff[] = []): ProjectFormValues {
  return {
    customerId: project.customerId,
    primaryTenantId: project.primaryTenantId ?? '',
    name: project.name,
    description: project.description,
    stage: project.stage,
    businessLineId: project.businessLineId,
    preSalesStaffId: getStaffIdByName(project.preSalesManager, staff) ?? '',
    accountManagerStaffId: getStaffIdByName(project.accountManager, staff) ?? '',
    deliveryManagerStaffId: getStaffIdByName(project.deliveryManager, staff) ?? '',
    projectManagerStaffId: getStaffIdByName(project.projectManager, staff) ?? '',
    monthlyBudget: project.monthlyBudget > 0 ? String(project.monthlyBudget) : '',
    startDate: project.startDate,
  }
}

export function formValuesToProject(
  values: ProjectFormValues,
  base: Pick<Project, 'id'> & Partial<Project>,
  businessLines: BusinessLine[],
): Project {
  const line =
    businessLines.find((b) => b.id === values.businessLineId) ??
    getBusinessLineById(values.businessLineId)

  return {
    id: base.id,
    name: values.name.trim(),
    customerId: values.customerId,
    customerName: base.customerName ?? '',
    customerType: base.customerType ?? 'B',
    primaryTenantId: values.primaryTenantId || undefined,
    businessLineId: values.businessLineId,
    businessLineName: line?.name ?? base.businessLineName ?? '',
    stage: values.stage,
    status: base.status ?? 'active',
    preSalesManager: base.preSalesManager ?? '',
    accountManager: base.accountManager ?? '',
    deliveryManager: base.deliveryManager ?? '',
    projectManager: base.projectManager ?? '',
    description: values.description.trim(),
    createdAt: base.createdAt ?? new Date().toISOString().slice(0, 10),
    startDate: values.startDate,
    endDate: base.endDate,
    monthlyBudget: values.monthlyBudget ? Number(values.monthlyBudget) : 0,
    lastMonthRecharge: base.lastMonthRecharge ?? 0,
    thisMonthRecharge: base.thisMonthRecharge ?? 0,
    lastMonthConsumption: base.lastMonthConsumption ?? 0,
    thisMonthConsumption: base.thisMonthConsumption ?? 0,
    totalConsumption: base.totalConsumption ?? 0,
    balance: base.balance ?? 0,
  }
}

export function formValuesToProjectInput(values: ProjectFormValues) {
  return {
    customerId: values.customerId,
    primaryTenantId: values.primaryTenantId || undefined,
    name: values.name.trim(),
    description: values.description.trim(),
    stage: values.stage,
    businessLineId: values.businessLineId,
    monthlyBudget: values.monthlyBudget ? Number(values.monthlyBudget) : undefined,
    startDate: values.startDate,
    staff: {
      preSalesStaffId: values.preSalesStaffId,
      accountManagerStaffId: values.accountManagerStaffId,
      deliveryManagerStaffId: values.deliveryManagerStaffId,
      projectManagerStaffId: values.projectManagerStaffId,
    },
  }
}

export function validateProjectForm(values: ProjectFormValues): string | null {
  if (!values.customerId) return '请选择客户'
  if (!values.name.trim()) return '请填写项目名称'
  if (!values.businessLineId) return '请选择业务线'
  if (!values.stage) return '请选择项目阶段'
  if (!values.preSalesStaffId) return '请选择售前经理'
  if (!values.accountManagerStaffId) return '请选择客户经理'
  if (!values.deliveryManagerStaffId) return '请选择交付经理'
  if (!values.projectManagerStaffId) return '请选择项目经理'
  return null
}

/** 将 CRM Store 中的业务线转为表单使用的 DTO */
export function mapStoreBusinessLines(
  rows: {
    id: string
    code: string
    name: string
    sort_order: number
    status: 'active' | 'inactive'
  }[],
): BusinessLine[] {
  return rows
    .filter((r) => r.status === 'active')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      sortOrder: r.sort_order,
      status: r.status,
    }))
}
