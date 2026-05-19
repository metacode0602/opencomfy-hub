import * as authSchema from "./auth-schema"
import * as crmSchema from "./crm-schema"
import * as financeSchema from "./finance-schema"
import * as supplySchema from "./supply-schema"

export * from "./auth-schema"
export * from "./crm-schema"
export * from "./finance-schema"
export * from "./supply-schema"

export const schema = {
  ...authSchema,
  ...crmSchema,
  ...supplySchema,
  ...financeSchema,
}
