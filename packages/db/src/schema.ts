import * as authSchema from "./auth-schema"
import * as crmSchema from "./crm-schema"
import * as dashboardSchema from "./dashboard-schema"
import * as financeSchema from "./finance-schema"
import * as platformPricingSchema from "./platform-pricing-schema"
import * as merchantSchema from "./merchant-schema"
import * as supplySchema from "./supply-schema"
import * as feishuSchema from "./feishu-schema"

export * from "./auth-schema"
export * from "./crm-schema"
export * from "./dashboard-schema"
export * from "./finance-schema"
export * from "./platform-pricing-schema"
export * from "./merchant-schema"
export * from "./supply-schema"
export * from "./supply-lifecycle-dictionary"
export * from "./feishu-schema"

export const schema = {
  ...authSchema,
  ...crmSchema,
  ...merchantSchema,
  ...supplySchema,
  ...financeSchema,
  ...platformPricingSchema,
  ...dashboardSchema,
  ...feishuSchema,
}
