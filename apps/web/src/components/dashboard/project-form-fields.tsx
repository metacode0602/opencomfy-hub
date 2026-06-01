'use client'

import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import type { BusinessLine, PlatformTenant } from '@/lib/data/types'
import { STAFF_DEPARTMENTS, type StaffDepartment } from '@/lib/crm/staff-constants'
import { trpc } from '@/lib/trpc/client'
import { STAGE_OPTIONS, type ProjectStage } from '@/lib/types/crm'

export type ProjectFormValues = {
  customerId: string
  /** 空字符串表示不指定，使用客户默认计费账户 */
  primaryTenantId: string
  name: string
  description: string
  stage: ProjectStage
  businessLineId: string
  preSalesStaffId: string
  accountManagerStaffId: string
  deliveryManagerStaffId: string
  projectManagerStaffId: string
  revenueDepartment: StaffDepartment
  monthlyBudget: string
  startDate: string
}

const NONE_TENANT = '__none__'
const NONE_STAFF = '__none_staff__'

type ProjectFormFieldsProps = {
  values: ProjectFormValues
  onChange: (patch: Partial<ProjectFormValues>) => void
  businessLines: BusinessLine[]
  idPrefix?: string
  /** 编辑模式下禁止修改客户与租户 */
  disableCustomerAndTenant?: boolean
  /** 编辑模式：客户经理改由列表菜单单独维护 */
  hideAccountManager?: boolean
  /** 编辑模式：收入归属部门改由列表菜单单独维护 */
  hideRevenueDepartment?: boolean
}

function tenantLabel(t: PlatformTenant) {
  const suffix = t.isDefault ? '（默认）' : ''
  const platform = t.platformTenantId ? ` · ${t.platformTenantId}` : ''
  return `${t.name}${suffix}${platform}`
}

export function ProjectFormFields({
  values,
  onChange,
  businessLines,
  idPrefix = 'project',
  disableCustomerAndTenant = false,
  hideAccountManager = false,
  hideRevenueDepartment = false,
}: ProjectFormFieldsProps) {
  const { data: customers = [] } = trpc.crm.customers.list.useQuery({})
  const { data: customerTenants = [] } = trpc.crm.customers.listTenants.useQuery(
    { customerId: values.customerId },
    { enabled: Boolean(values.customerId) },
  )
  const { data: staff = [] } = trpc.crm.staff.listActive.useQuery()

  const handleCustomerChange = (customerId: string) => {
    onChange({
      customerId,
      primaryTenantId: '',
    })
  }

  const tenantSelectValue = values.primaryTenantId || NONE_TENANT

  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-customer`}>选择客户</Label>
        <Select
          value={values.customerId || undefined}
          onValueChange={handleCustomerChange}
          disabled={disableCustomerAndTenant}
        >
          <SelectTrigger id={`${idPrefix}-customer`} className="w-full">
            <SelectValue placeholder="请选择客户" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                <span className="text-muted-foreground ml-2">
                  ({c.type === 'B' ? '企业' : '个人'})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-tenant`}>租户 ID（计费账户）</Label>
        <Select
          value={tenantSelectValue}
          onValueChange={(v) =>
            onChange({ primaryTenantId: v === NONE_TENANT ? '' : v })
          }
          disabled={disableCustomerAndTenant || !values.customerId}
        >
          <SelectTrigger id={`${idPrefix}-tenant`} className="w-full">
            <SelectValue
              placeholder={
                values.customerId ? '不选择则使用客户默认账户' : '请先选择客户'
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_TENANT}>不指定（使用客户默认账户）</SelectItem>
            {customerTenants.map((t: PlatformTenant) => (
              <SelectItem key={t.id} value={t.id}>
                {tenantLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>项目名称</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="请输入项目名称"
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>项目描述</Label>
        <Textarea
          id={`${idPrefix}-description`}
          placeholder="请输入项目描述"
          rows={3}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-stage`}>当前阶段</Label>
          <Select
            value={values.stage}
            onValueChange={(v) =>
              onChange({ stage: v as ProjectFormValues['stage'] })
            }
          >
            <SelectTrigger id={`${idPrefix}-stage`} className="w-full">
              <SelectValue placeholder="请选择阶段" />
            </SelectTrigger>
            <SelectContent>
              {STAGE_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-business-line`}>业务线</Label>
          <Select
            value={values.businessLineId || undefined}
            onValueChange={(v) => onChange({ businessLineId: v })}
          >
            <SelectTrigger id={`${idPrefix}-business-line`} className="w-full">
              <SelectValue placeholder="请选择业务线" />
            </SelectTrigger>
            <SelectContent>
              {businessLines.map((bl) => (
                <SelectItem key={bl.id} value={bl.id}>
                  {bl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!hideRevenueDepartment ? (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-revenue-dept`}>收入归属部门</Label>
          <Select
            value={values.revenueDepartment}
            onValueChange={(v) => onChange({ revenueDepartment: v as StaffDepartment })}
          >
            <SelectTrigger id={`${idPrefix}-revenue-dept`} className="w-full">
              <SelectValue placeholder="请选择部门" />
            </SelectTrigger>
            <SelectContent>
              {STAFF_DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-pre-sales`}>售前经理</Label>
          <Select
            value={values.preSalesStaffId || NONE_STAFF}
            onValueChange={(v) => onChange({ preSalesStaffId: v === NONE_STAFF ? '' : v })}
          >
            <SelectTrigger id={`${idPrefix}-pre-sales`} className="w-full">
              <SelectValue placeholder="不指定" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_STAFF}>不指定</SelectItem>
              {staff.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!hideAccountManager ? (
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-account-manager`}>客户经理</Label>
            <Select
              value={values.accountManagerStaffId || undefined}
              onValueChange={(v) => onChange({ accountManagerStaffId: v })}
            >
              <SelectTrigger id={`${idPrefix}-account-manager`} className="w-full">
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-delivery-manager`}>交付经理</Label>
          <Select
            value={values.deliveryManagerStaffId || undefined}
            onValueChange={(v) => onChange({ deliveryManagerStaffId: v })}
          >
            <SelectTrigger id={`${idPrefix}-delivery-manager`} className="w-full">
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-project-manager`}>项目经理</Label>
          <Select
            value={values.projectManagerStaffId || NONE_STAFF}
            onValueChange={(v) => onChange({ projectManagerStaffId: v === NONE_STAFF ? '' : v })}
          >
            <SelectTrigger id={`${idPrefix}-project-manager`} className="w-full">
              <SelectValue placeholder="不指定" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_STAFF}>不指定</SelectItem>
              {staff.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-budget`}>月度预算</Label>
          <Input
            id={`${idPrefix}-budget`}
            type="number"
            placeholder="¥"
            value={values.monthlyBudget}
            onChange={(e) => onChange({ monthlyBudget: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-start-date`}>开始日期</Label>
          <Input
            id={`${idPrefix}-start-date`}
            type="date"
            value={values.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
