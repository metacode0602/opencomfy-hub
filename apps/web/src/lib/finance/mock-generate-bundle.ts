import type {
  BillingPeriod,
  PlatformCostMonthly,
  PlatformIncomeMonthly,
} from "@/lib/types/finance"

export type UploadFileMeta = {
  name: string
  size: number
}

function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 0.0001 + i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function toMoney(n: number): string {
  return n.toFixed(5)
}

function isoNow(): string {
  return new Date().toISOString()
}

/**
 * 根据账期与上传文件元信息生成一条账期及关联的收入/成本 mock 明细（不解析真实 Excel）。
 */
export function generateMockFinanceBundle(input: {
  period_code: string
  period_start: string
  period_end: string
  customer: UploadFileMeta
  baremetal: UploadFileMeta
  tenantBill: UploadFileMeta
}): {
  period: BillingPeriod
  income: PlatformIncomeMonthly[]
  cost: PlatformCostMonthly[]
} {
  const seed =
    input.period_code.split("").reduce((a, c) => a + c.charCodeAt(0), 0) +
    (input.customer.size % 9973) +
    (input.baremetal.size % 9973) +
    (input.tenantBill.size % 9973)

  const scale = 1 + rnd(seed, 1) * 0.4
  const baseFromFiles =
    280_000 +
    (input.customer.size + input.baremetal.size + input.tenantBill.size) /
      1024 /
      8

  const totalIncome = baseFromFiles * scale * (1.1 + rnd(seed, 2))
  const baremetalShare = 0.12 + rnd(seed, 3) * 0.1
  const supplementaryShare = 0.015 + rnd(seed, 4) * 0.02
  const baremetal_income = totalIncome * baremetalShare
  const supplementary = totalIncome * supplementaryShare
  const balance_income = totalIncome - baremetal_income - supplementary
  const total_cost = totalIncome * (0.58 + rnd(seed, 5) * 0.12)

  const id = `bp-custom-${Date.now()}`

  const period: BillingPeriod = {
    id,
    period_code: input.period_code.trim(),
    period_start: input.period_start,
    period_end: input.period_end,
    total_income: toMoney(totalIncome),
    total_cost: toMoney(total_cost),
    supplementary: toMoney(supplementary),
    balance_income: toMoney(balance_income),
    baremetal_income: toMoney(baremetal_income),
  }

  const tenants = [
    { name: "华东弹性算力客户 A", id: "984" },
    { name: "华北裸金属客户 B", id: "4583" },
    { name: "华南云主机客户 C", id: "338" },
    { name: "西南混合消费客户 D", id: "3018" },
  ]

  const income: PlatformIncomeMonthly[] = tenants.map((t, idx) => {
    const slice = balance_income / tenants.length * (0.85 + rnd(seed, 10 + idx) * 0.35)
    const bm =
      idx === 1 ? baremetal_income * (0.4 + rnd(seed, 20 + idx) * 0.2) : baremetal_income * 0.08
    const sup = idx === 3 ? supplementary * 0.6 : supplementary * 0.1
    const total = slice + bm + sup
    return {
      id: `inc-${id}-${idx}`,
      billing_period_id: id,
      project_name: idx % 2 === 0 ? `导入解析·${input.period_code}` : null,
      tenant_name: t.name,
      tenant_id: t.id,
      supplementary_consumption: toMoney(sup),
      balance_consumption: toMoney(slice),
      bare_metal_consumption: toMoney(bm),
      total_consumption: toMoney(total),
      created_at: isoNow(),
      updated_at: null,
    }
  })

  const idcRows: Omit<PlatformCostMonthly, "id" | "billing_period_id" | "created_at" | "updated_at">[] = [
    {
      supplier_unit_cost_id: "suc-mock-1",
      account_manager: "导入核算",
      staff_id: "staff-mock",
      idc_name: "广东韶关",
      idc_code: "gd-sg",
      card_type: "4090",
      type: "record",
      balance_consumption: toMoney(total_cost * 0.35),
      balance_card_hours: toMoney(1200 + rnd(seed, 30) * 800),
      voucher_card_hours: toMoney(40 + rnd(seed, 31) * 20),
      confirmed_revenue_excl_tax: toMoney(totalIncome * 0.32),
      sold_duration_cost_excl_tax: toMoney(total_cost * 0.28),
      gifted_duration_cost_excl_tax: toMoney(total_cost * 0.03),
      gross_profit: toMoney(totalIncome * 0.32 - total_cost * 0.31),
    },
    {
      supplier_unit_cost_id: "suc-mock-2",
      account_manager: "导入核算",
      staff_id: "staff-mock",
      idc_name: "许昌机房",
      idc_code: "hn-xc",
      card_type: "H800",
      type: "record",
      balance_consumption: toMoney(total_cost * 0.28),
      balance_card_hours: toMoney(600 + rnd(seed, 32) * 400),
      voucher_card_hours: toMoney(25 + rnd(seed, 33) * 15),
      confirmed_revenue_excl_tax: toMoney(totalIncome * 0.25),
      sold_duration_cost_excl_tax: toMoney(total_cost * 0.22),
      gifted_duration_cost_excl_tax: toMoney(total_cost * 0.02),
      gross_profit: toMoney(totalIncome * 0.25 - total_cost * 0.24),
    },
  ]

  const cost: PlatformCostMonthly[] = idcRows.map((row, idx) => ({
    ...row,
    id: `cost-${id}-${idx}`,
    billing_period_id: id,
    created_at: isoNow(),
    updated_at: null,
  }))

  const sumBalance = cost.reduce((a, r) => a + Number(r.balance_consumption ?? 0), 0)
  const sumSold = cost.reduce((a, r) => a + Number(r.sold_duration_cost_excl_tax ?? 0), 0)
  const sumGift = cost.reduce((a, r) => a + Number(r.gifted_duration_cost_excl_tax ?? 0), 0)
  const sumGross = cost.reduce((a, r) => a + Number(r.gross_profit ?? 0), 0)
  const sumRev = cost.reduce((a, r) => a + Number(r.confirmed_revenue_excl_tax ?? 0), 0)

  cost.push({
    id: `cost-${id}-sum`,
    billing_period_id: id,
    supplier_unit_cost_id: null,
    account_manager: "导入核算",
    staff_id: "staff-mock",
    idc_name: null,
    idc_code: null,
    card_type: null,
    type: "sum",
    balance_consumption: toMoney(sumBalance),
    balance_card_hours: toMoney(
      cost.reduce((a, r) => a + Number(r.balance_card_hours ?? 0), 0),
    ),
    voucher_card_hours: toMoney(
      cost.reduce((a, r) => a + Number(r.voucher_card_hours ?? 0), 0),
    ),
    confirmed_revenue_excl_tax: toMoney(sumRev),
    sold_duration_cost_excl_tax: toMoney(sumSold),
    gifted_duration_cost_excl_tax: toMoney(sumGift),
    gross_profit: toMoney(sumGross),
    created_at: isoNow(),
    updated_at: null,
  })

  return { period, income, cost }
}
