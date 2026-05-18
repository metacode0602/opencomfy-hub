import * as authSchema from "./auth-schema"
import * as crmSchema from "./crm-schema"

export * from "./auth-schema"
export * from "./crm-schema"

export const schema = {
  ...authSchema,
  ...crmSchema,
}
