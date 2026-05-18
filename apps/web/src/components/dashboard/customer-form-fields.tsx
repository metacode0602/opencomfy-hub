'use client'

import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { emptyExpectedScale, type CustomerExpectedScale } from '@/lib/data/types'
import { mockSalesManagers } from '@/lib/data/mock-data'
import { CustomerExpectedScaleFields } from './customer-expected-scale-fields'

export type CustomerFormValues = {
  type: 'B' | 'C'
  name: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  industry: string
  address: string
  certCode: string
  salesManagerId: string
  expectedScale: CustomerExpectedScale
}

export const emptyCustomerFormValues: CustomerFormValues = {
  type: 'B',
  name: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  industry: '',
  address: '',
  certCode: '',
  salesManagerId: '',
  expectedScale: emptyExpectedScale,
}

const INDUSTRY_OPTIONS = [
  { value: 'ai', label: '人工智能' },
  { value: 'cloud', label: '云计算' },
  { value: 'bigdata', label: '大数据' },
  { value: 'design', label: '视觉设计' },
  { value: 'other', label: '其他' },
] as const

type CustomerFormFieldsProps = {
  values: CustomerFormValues
  onChange: (patch: Partial<CustomerFormValues>) => void
  idPrefix?: string
}

export function CustomerFormFields({
  values,
  onChange,
  idPrefix = 'customer',
}: CustomerFormFieldsProps) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid grid-cols-2 gap-4">

        <div className="grid gap-2">
          <Label>客户类型</Label>
          <Select
            value={values.type}
            onValueChange={(v) => onChange({ type: v as 'B' | 'C' })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B">B 端（企业）</SelectItem>
              <SelectItem value="C">C 端（个人）</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>所属行业</Label>
          <Select
            value={values.industry || undefined}
            onValueChange={(v) => onChange({ industry: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择行业" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.label}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>客户名称</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="请输入客户名称"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-cert-code`}>统一社会信用代码</Label>
        <Input
          id={`${idPrefix}-cert-code`}
          value={values.certCode}
          onChange={(e) => onChange({ certCode: e.target.value })}
          placeholder="请输入统一社会信用代码"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-contact-person`}>联系人</Label>
          <Input
            id={`${idPrefix}-contact-person`}
            value={values.contactPerson}
            onChange={(e) => onChange({ contactPerson: e.target.value })}
            placeholder="请输入联系人姓名"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-contact-phone`}>联系电话</Label>
          <Input
            id={`${idPrefix}-contact-phone`}
            value={values.contactPhone}
            onChange={(e) => onChange({ contactPhone: e.target.value })}
            placeholder="请输入联系电话"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-contact-email`}>联系邮箱</Label>
        <Input
          id={`${idPrefix}-contact-email`}
          type="email"
          value={values.contactEmail}
          onChange={(e) => onChange({ contactEmail: e.target.value })}
          placeholder="请输入联系邮箱"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-address`}>地址</Label>
        <Input
          id={`${idPrefix}-address`}
          value={values.address}
          onChange={(e) => onChange({ address: e.target.value })}
          placeholder="请输入地址"
        />
      </div>

      <div className="grid gap-2">
        <Label>销售经理</Label>
        <Select
          value={values.salesManagerId || undefined}
          onValueChange={(v) => onChange({ salesManagerId: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="请选择销售经理" />
          </SelectTrigger>
          <SelectContent>
            {mockSalesManagers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CustomerExpectedScaleFields
        value={values.expectedScale}
        onChange={(expectedScale) => onChange({ expectedScale })}
        idPrefix={`${idPrefix}-scale`}
      />


    </div>
  )
}
