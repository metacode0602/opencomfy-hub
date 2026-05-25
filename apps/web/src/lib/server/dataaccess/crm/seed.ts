import { db } from '@/lib/db'
import {
  crmMockActivities,
  crmMockActivityTypes,
  crmMockAssignments,
  crmMockUserStaff,
} from '@/lib/data/crm-mock'
import {
  mockActivities,
  mockBills,
  mockBusinessLines,
  mockConsumptions,
  mockContracts,
  mockCoupons,
  mockCustomers,
  mockOrders,
  mockPlatformTenants,
  mockProjects,
  mockRecharges,
  mockSalesManagers,
  mockTasks,
} from '@/lib/data/mock-data'
import {
  accountActivity,
  accountManagerAssignment,
  activityTypeDefinition,
  billingTenant,
  businessLine,
  commerceOrder,
  commerceOrderItem,
  computeTask,
  consumptionRecord,
  contract,
  coupon,
  crmProject,
  customer,
  projectActivity,
  projectStaffAssignment,
  recharge,
  tenantBill,
  tenantBillDetail,
  userStaff,
} from '@workspace/db/schema'

function staffIdByDisplayName(name: string): string | undefined {
  const sm = mockSalesManagers.find((m) => m.name === name)
  if (sm) return sm.id
  const crm = crmMockUserStaff.find((s) => s.display_name === name)
  return crm?.id
}

function mapAuthorRole(role: string): string {
  if (role === 'sales') return 'pre_sales'
  if (role === 'account_manager') return 'account_manager'
  return role
}

/** 将 crm-mock 中 t-00x 客户 id 映射到主 mock 客户 */
function mapLegacyCustomerId(id: string): string {
  if (id === 't-001') return 't1'
  if (id === 't-002') return 't2'
  if (id === 't-003') return 't3'
  return id
}

export async function seedCrmFromMock(): Promise<void> {
  await db.transaction(async (tx) => {
    // 业务线
    for (const bl of mockBusinessLines) {
      await tx.insert(businessLine).values({
        id: bl.id,
        code: bl.code,
        name: bl.name,
        description: bl.description ?? null,
        sortOrder: bl.sortOrder,
        status: bl.status,
      })
    }

    // 员工：销售经理 + CRM mock 员工
    for (const sm of mockSalesManagers) {
      await tx.insert(userStaff).values({
        id: sm.id,
        employeeNo: null,
        displayName: sm.name,
        mobile: `1380000${sm.id.replace(/\D/g, '').padStart(4, '0').slice(-4)}`,
        email: null,
        status: 'active',
        department: '销售',
      })
    }
    for (const s of crmMockUserStaff) {
      const exists = mockSalesManagers.some((m) => m.id === s.id)
      if (exists) continue
      await tx.insert(userStaff).values({
        id: s.id,
        employeeNo: s.employee_no,
        displayName: s.display_name,
        mobile: s.mobile,
        email: s.email,
        status: s.status,
        department: '中台',
      })
    }

    // 客户
    for (const c of mockCustomers) {
      await tx.insert(customer).values({
        id: c.id,
        name: c.name,
        customerCode: null,
        shortName: c.name,
        certCode: c.certCode ?? null,
        type: c.type,
        status: c.status,
        contactPerson: c.contactPerson,
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
        industry: c.industry,
        address: c.address,
        salesManagerId: c.salesManagerId ?? null,
        lifecyclePhase: null,
        expectedScale: c.expectedScale ?? null,
        observedScaleSummary: null,
        testStartedOn: null,
        testCompletedOn: null,
        conversionDate: null,
        conversionTrigger: null,
        createdAt: new Date(c.createdAt),
      })
    }

    // 计费租户
    for (const t of mockPlatformTenants) {
      await tx.insert(billingTenant).values({
        id: t.id,
        customerId: t.customerId,
        name: t.name,
        platformTenantId: t.platformTenantId ?? null,
        isDefault: t.isDefault,
        status: t.status,
        balance: String(t.balance),
      })
    }

    // 项目 + 四人组
    for (const p of mockProjects) {
      await tx.insert(crmProject).values({
        id: p.id,
        customerId: p.customerId,
        primaryTenantId: p.primaryTenantId ?? null,
        businessLineId: p.businessLineId,
        name: p.name,
        description: p.description,
        stage: p.stage,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate ?? null,
        monthlyBudget: p.monthlyBudget ? String(p.monthlyBudget) : null,
        lastMonthRecharge: String(p.lastMonthRecharge ?? 0),
        thisMonthRecharge: String(p.thisMonthRecharge ?? 0),
        lastMonthConsumption: String(p.lastMonthConsumption ?? 0),
        thisMonthConsumption: String(p.thisMonthConsumption ?? 0),
        balance: p.balance ? String(p.balance) : null,
        createdAt: new Date(p.createdAt),
      })

      const roles: { name: string; role: string }[] = [
        { name: p.preSalesManager, role: 'pre_sales' },
        { name: p.accountManager, role: 'account_manager' },
        { name: p.deliveryManager, role: 'delivery_manager' },
        { name: p.projectManager, role: 'project_manager' },
      ]
      for (const r of roles) {
        const staffId = staffIdByDisplayName(r.name)
        if (!staffId) continue
        await tx.insert(projectStaffAssignment).values({
          id: `${p.id}-${r.role}`,
          projectId: p.id,
          userStaffId: staffId,
          roleType: r.role,
          effectiveFrom: new Date(p.createdAt),
          effectiveTo: null,
        })
      }
    }

    // 合同
    for (const c of mockContracts) {
      await tx.insert(contract).values({
        id: c.id,
        contractNo: c.contractNo,
        customerId: c.customerId,
        tenantId: c.tenantId,
        projectId: c.projectId,
        type: c.type,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        totalAmount: String(c.totalAmount),
        paidAmount: String(c.paidAmount),
        signedAt: c.signedAt ? new Date(c.signedAt) : null,
        signerName: c.signerName ?? null,
        terms: c.terms,
        createdAt: new Date(c.createdAt),
      })
    }

    // 充值 / 消费 / 券 / 任务
    for (const r of mockRecharges) {
      await tx.insert(recharge).values({
        id: r.id,
        tenantId: r.tenantId,
        projectId: r.projectId ?? null,
        amount: String(r.amount),
        paymentMethod: r.paymentMethod,
        status: r.status,
        transactionId: r.transactionId,
        createdAt: new Date(r.createdAt),
        completedAt: r.completedAt ? new Date(r.completedAt) : null,
      })
    }

    for (const c of mockConsumptions) {
      await tx.insert(consumptionRecord).values({
        id: c.id,
        customerId: null,
        tenantId: c.tenantId,
        projectId: c.projectId,
        productLine: c.productLine,
        resourceName: c.resourceName,
        amount: String(c.amount),
        duration: String(c.duration),
        unit: c.unit,
        occurredAt: new Date(c.createdAt),
      })
    }

    for (const c of mockCoupons) {
      await tx.insert(coupon).values({
        id: c.id,
        tenantId: c.tenantId,
        projectId: c.projectId ?? null,
        code: c.code,
        name: c.name,
        type: c.type,
        value: String(c.value),
        minAmount: String(c.minAmount),
        status: c.status,
        issuedAt: new Date(c.issuedAt),
        expiredAt: new Date(c.expiredAt),
        usedAt: c.usedAt ? new Date(c.usedAt) : null,
      })
    }

    for (const t of mockTasks) {
      await tx.insert(computeTask).values({
        id: t.id,
        tenantId: t.tenantId,
        projectId: t.projectId,
        title: t.title,
        description: t.description,
        status: t.status,
        resourceType: t.resourceType,
        gpuCount: t.gpuCount ?? null,
        cpuCount: t.cpuCount ?? null,
        memoryGb: t.memoryGB ?? null,
        startTime: new Date(t.startTime),
        endTime: t.endTime ? new Date(t.endTime) : null,
        cost: String(t.cost),
      })
    }

    // 订单 + 行
    for (const o of mockOrders) {
      await tx.insert(commerceOrder).values({
        id: o.id,
        orderNo: o.orderNo,
        customerId: null,
        tenantId: o.tenantId,
        projectId: o.projectId,
        productLine: o.productLine,
        status: o.status,
        amount: String(o.amount),
        createdAt: new Date(o.createdAt),
        completedAt: o.completedAt ? new Date(o.completedAt) : null,
      })
      for (let i = 0; i < o.items.length; i++) {
        const item = o.items[i]!
        await tx.insert(commerceOrderItem).values({
          id: `${o.id}-item-${i}`,
          orderId: o.id,
          name: item.name,
          quantity: String(item.quantity),
          unitPrice: String(item.unitPrice),
          total: String(item.total),
          sortOrder: i,
        })
      }
    }

    // 账单 + 明细
    for (const b of mockBills) {
      await tx.insert(tenantBill).values({
        id: b.id,
        customerId: null,
        tenantId: b.tenantId,
        projectId: b.projectId,
        billMonth: b.month,
        totalAmount: String(b.totalAmount),
        status: b.status,
        dueDate: b.dueDate,
        paidAt: b.paidAt ? new Date(b.paidAt) : null,
      })
      for (let i = 0; i < b.details.length; i++) {
        const d = b.details[i]!
        await tx.insert(tenantBillDetail).values({
          id: `${b.id}-d-${i}`,
          billId: b.id,
          productLine: d.productLine,
          resourceName: d.resourceName,
          usage: String(d.usage),
          unit: d.unit,
          unitPrice: String(d.unitPrice),
          amount: String(d.amount),
        })
      }
    }

    // 项目时间线
    for (const a of mockActivities) {
      await tx.insert(projectActivity).values({
        id: a.id,
        projectId: a.projectId,
        type: a.type,
        title: a.title,
        description: a.description,
        authorName: a.author,
        authorStaffId: null,
        authorRole: mapAuthorRole(a.authorRole),
        metadata: a.metadata ?? null,
        createdAt: new Date(a.createdAt),
      })
    }

    // 日历：类型 + 动态（映射客户 id）
    for (const at of crmMockActivityTypes) {
      await tx.insert(activityTypeDefinition).values({
        id: at.id,
        typeCode: at.type_code,
        displayName: at.display_name,
        category: at.category,
        isPlatformProjection: at.is_platform_projection,
        sortOrder: at.sort_order,
      })
    }

    for (const a of crmMockActivities) {
      const customerId = mapLegacyCustomerId(a.customer_id)
      const exists = mockCustomers.some((c) => c.id === customerId)
      if (!exists) continue
      await tx.insert(accountActivity).values({
        id: a.id,
        customerId,
        tenantId: a.tenant_id,
        activityTypeId: a.activity_type_id,
        occurredAt: new Date(a.occurred_at),
        refDomain: a.ref_domain,
        refId: a.ref_id,
        idempotencyKey: a.idempotency_key,
        actorUserId: a.actor_user_id,
        titleSnapshot: a.title_snapshot,
        summarySnapshot: a.summary_snapshot,
        payload: a.payload,
        visibility: a.visibility,
      })
    }

    for (const am of crmMockAssignments) {
      const customerId = mapLegacyCustomerId(am.customer_id)
      if (!mockCustomers.some((c) => c.id === customerId)) continue
      await tx.insert(accountManagerAssignment).values({
        id: am.id,
        customerId,
        userStaffId: am.user_staff_id,
        roleType: 'account_manager',
        effectiveFrom: new Date(am.effective_from),
        effectiveTo: am.effective_to ? new Date(am.effective_to) : null,
      })
    }
  })
}
