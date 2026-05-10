
import { router } from './trpc'
import { apiKeysRouter } from './web/apiKeys'
import { dashboardRouter } from './web/dashboard'
import { firstLoginRouter } from './web/first-login'
import { invitationRouter } from './invitation'
import { newslettersRouter } from './web/newsletters'

export * from './trpc'
export type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

export const appRouter = router({
  apiKeys: apiKeysRouter,
  dashboard: dashboardRouter,
  firstLogin: firstLoginRouter,
  invitation: invitationRouter,
  newsletters: newslettersRouter,
  // Admin routes
  admin: router({
  }),
})

// export type definition of API
export type AppRouter = typeof appRouter
