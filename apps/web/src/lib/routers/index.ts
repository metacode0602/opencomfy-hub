import { adminSessionsRouter } from '@/web/sessions/router-admin'
import { router } from './trpc'
import { apiKeysRouter } from './web/apiKeys'
import { newsletterRouter } from '@/newsletter/router'
import { dashboardRouter } from './web/dashboard'
import { firstLoginRouter } from './web/first-login'
import { rechargeRouter } from '@/payment/recharge/router'
import { paymentRouter } from '@/payment/router'
import { homeworkRouter } from './homework'
import { adminUsersRouter } from '@/web/users/router-admin'
import { newsletterSubscriptionsRouter } from '@/web/newsletter-subscriptions/router'
import { paymentsRouter } from '@/web/payments/router'
import { adminBalancesRouter } from '@/web/balance/router-admin'
import { rechargeOrdersRouter } from '@/web/recharge-orders/router'
import { userSubscriptionsRouter } from '@/web/user-subscriptions/router'
import { adminSubscriptionsRouter } from '@/web/user-subscriptions/router-admin'
import { wrongQuestionsRouter } from '@/web/wrong-questions/router'
import { chatsRouter } from '@/web/chats/router'
import { adminArticlesRouter } from '@/web/articles/router-admin'
import { adminBlogRouter } from '@/web/blog/router-admin'
import { contactInquiriesRouter } from '@/web/contact-inquiries/router'
import { invitationRouter } from './invitation'

export * from './trpc'
export type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

export const appRouter = router({
  apiKeys: apiKeysRouter,
  dashboard: dashboardRouter,
  newsletters: newsletterRouter,
  payment: paymentRouter,
  homework: homeworkRouter,
  subscriptions: userSubscriptionsRouter,
  firstLogin: firstLoginRouter,
  invitation: invitationRouter,
  // Admin routes
  admin: router({
    sessions: adminSessionsRouter,
    blog: adminBlogRouter,
    users: adminUsersRouter,
    newsletterSubscriptions: newsletterSubscriptionsRouter,
    payments: paymentsRouter,
    rechargeOrders: rechargeOrdersRouter,
    balances: adminBalancesRouter,
    subscriptions: adminSubscriptionsRouter,
    wrongQuestions: wrongQuestionsRouter,
    chats: chatsRouter,
    articles: adminArticlesRouter,
    contactInquiries: contactInquiriesRouter,
  }),
  recharge: rechargeRouter,
})

// export type definition of API
export type AppRouter = typeof appRouter
