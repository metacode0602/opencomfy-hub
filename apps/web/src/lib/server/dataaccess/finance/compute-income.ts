export {
  appendRefGapIssues,
  buildTenantAggMap,
  parseIncomeNum,
  validateCustomerTypeConsistency,
  type ComputeIncomeResult,
  type TenantAggBase,
} from './compute-income-shared'

export { runPeriodIncomePipeline } from './compute-billing-period-income'

/** @deprecated 请使用 runPeriodIncomePipeline / computeBillingPeriodIncome */
export { runPeriodIncomePipeline as computePeriodIncome } from './compute-billing-period-income'
