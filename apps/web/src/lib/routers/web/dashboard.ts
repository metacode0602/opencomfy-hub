import { createTRPCRouter, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { db } from '@/db/drizzle'
import { wrongQuestions, knowledgePoints, chats, messages } from '@/db/schema'
import { eq, and, gte, sql, count, desc } from 'drizzle-orm'

// 艾宾浩斯复习间隔（天）
const EBBINGHAUS_INTERVALS = [1, 3, 7, 15, 30]

// 计算下次复习时间
function getNextReviewDate(lastReviewDate: Date, reviewCount: number): Date {
  const interval = EBBINGHAUS_INTERVALS[Math.min(reviewCount, EBBINGHAUS_INTERVALS.length - 1)]
  return new Date(lastReviewDate.getTime() + interval * 24 * 60 * 60 * 1000)
}

// 计算距离复习还有多少天
function getDaysUntilReview(nextReviewDate: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const reviewDate = new Date(nextReviewDate)
  reviewDate.setHours(0, 0, 0, 0)
  const diffTime = reviewDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export const dashboardRouter = createTRPCRouter({
  /**
   * 获取用户请求数据，暂时没有使用
   */
  getUserRequestsDataAction: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(60),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {

    }),

  getUserTokensDataAction: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(60),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { days, startDate, endDate } = input

      // Calculate date range
      let startDateValue: Date
      let endDateValue: Date

      if (startDate && endDate) {
        startDateValue = new Date(startDate)
        endDateValue = new Date(endDate)
      } else {
        endDateValue = new Date()
        startDateValue = new Date()
        startDateValue.setDate(endDateValue.getDate() - days)
      }

      // Convert dates to integer format (YYYYMMDD)
      const startDateInt = Number.parseInt(startDateValue.toISOString().slice(0, 10).replace(/-/g, ''))
      const endDateInt = Number.parseInt(endDateValue.toISOString().slice(0, 10).replace(/-/g, ''))

      return {
        success: true,
        data: {
        },
      }
    }),

  getUserVirtualKeySpendDataAction: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(60),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { days, startDate, endDate } = input
      let startDateValue: Date
      let endDateValue: Date

      if (startDate && endDate) {
        startDateValue = new Date(startDate)
        endDateValue = new Date(endDate)
      } else {
        endDateValue = new Date()
        startDateValue = new Date()
        startDateValue.setDate(endDateValue.getDate() - days)
      }

      // Convert dates to integer format (YYYYMMDD)
      const startDateInt = Number.parseInt(startDateValue.toISOString().slice(0, 10).replace(/-/g, ''))
      const endDateInt = Number.parseInt(endDateValue.toISOString().slice(0, 10).replace(/-/g, ''))

      // Get virtual key spend data from totalVirtualKeyUsage table
      // const virtualKeySpendData = await db
      //   .select({
      //     virtualKey: totalVirtualKeyUsage.virtualKey,
      //     spend: totalVirtualKeyUsage.spend,
      //   })
      //   .from(totalVirtualKeyUsage)
      //   .where(eq(totalVirtualKeyUsage.userId, userId))
      //   .orderBy(desc(totalVirtualKeyUsage.spend))

      // if (virtualKeySpendData.length === 0) {
      //   return {
      //     success: true,
      //     data: {
      //       chartData: [],
      //       totalSpend: 0,
      //     },
      //   }
      // }

      // Convert to chart data format
      // const chartData = virtualKeySpendData.map((item, index) => ({
      //   key: item.virtualKey,
      //   name: item.virtualKey,
      //   spend: Number(item.spend),
      //   fill: `var(--chart-${(index % 5) + 1})`,
      // }))

      // Calculate total spend
      // const totalSpend = virtualKeySpendData.reduce((sum, item) => sum + Number(item.spend), 0)

      return {
        success: true,
        data: {
          // chartData,
          // totalSpend,
        },
      }
    }),

  getUserModelSpendDataAction: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(60),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { days, startDate, endDate } = input
      // Calculate date range
      let startDateValue: Date
      let endDateValue: Date

      if (startDate && endDate) {
        startDateValue = new Date(startDate)
        endDateValue = new Date(endDate)
      } else {
        endDateValue = new Date()
        startDateValue = new Date()
        startDateValue.setDate(endDateValue.getDate() - days)
      }

      // Convert dates to integer format (YYYYMMDD)
      const startDateInt = Number.parseInt(startDateValue.toISOString().slice(0, 10).replace(/-/g, ''))
      const endDateInt = Number.parseInt(endDateValue.toISOString().slice(0, 10).replace(/-/g, ''))

      // Get model spend data from totalUserModelUsage table
      // const modelSpendData = await db
      //   .select({
      //     model: totalUserModelUsage.model,
      //     spend: totalUserModelUsage.spend,
      //   })
      //   .from(totalUserModelUsage)
      //   .where(eq(totalUserModelUsage.userId, userId))
      //   .orderBy(desc(totalUserModelUsage.spend))

      // if (modelSpendData.length === 0) {
      //   return {
      //     success: true,
      //     data: {
      //       chartData: [],
      //       totalSpend: 0,
      //     },
      //   }
      // }

      // Convert to chart data format
      // const chartData = modelSpendData.map((item, index) => ({
      //   key: item.model,
      //   name: item.model,
      //   spend: Number(item.spend),
      //   fill: `var(--chart-${(index % 5) + 1})`,
      // }))

      // // Calculate total spend
      // const totalSpend = modelSpendData.reduce((sum, item) => sum + Number(item.spend), 0)

      return {
        success: true,
        data: {
          // chartData,
          // totalSpend,
        },
      }
    }),

  /**
   * 获取学习 Dashboard 统计数据
   */
  getLearningStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id

    // 获取错题统计
    const wrongQuestionsData = await db
      .select({
        total: count(),
        reviewed: sql<number>`COUNT(CASE WHEN ${wrongQuestions.isReviewed} = true THEN 1 END)`,
      })
      .from(wrongQuestions)
      .where(eq(wrongQuestions.userId, userId))

    const totalWrongQuestions = Number(wrongQuestionsData[0]?.total || 0)
    const reviewedCount = Number(wrongQuestionsData[0]?.reviewed || 0)

    // 获取知识点统计
    const knowledgePointsData = await db
      .select({
        total: count(),
      })
      .from(knowledgePoints)
      .where(eq(knowledgePoints.userId, userId))

    const totalKnowledgePoints = Number(knowledgePointsData[0]?.total || 0)

    // 计算待复习错题（基于艾宾浩斯曲线）
    const allWrongQuestions = await db
      .select()
      .from(wrongQuestions)
      .where(eq(wrongQuestions.userId, userId))

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let pendingReview = 0
    for (const question of allWrongQuestions) {
      if (!question.reviewedAt) {
        // 从未复习过，需要复习
        pendingReview++
      } else {
        const lastReviewDate = new Date(question.reviewedAt)
        const nextReviewDate = getNextReviewDate(lastReviewDate, question.reviewCount || 0)
        const daysUntil = getDaysUntilReview(nextReviewDate)
        if (daysUntil <= 0) {
          pendingReview++
        }
      }
    }

    // 计算学习天数（连续学习天数）
    const chatsData = await db
      .select({
        createdAt: chats.createdAt,
      })
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.createdAt))
      .limit(100)

    // 简化的学习天数计算：有学习记录的天数
    const learningDaysSet = new Set<string>()
    chatsData.forEach((chat) => {
      if (chat.createdAt) {
        const date = new Date(chat.createdAt)
        const dateStr = date.toISOString().split('T')[0]
        learningDaysSet.add(dateStr)
      }
    })
    const learningDays = learningDaysSet.size

    // 计算掌握度（已复习错题 / 总错题）
    const masteryRate = totalWrongQuestions > 0 ? (reviewedCount / totalWrongQuestions) * 100 : 0

    return {
      success: true,
      data: {
        totalWrongQuestions,
        pendingReview,
        totalKnowledgePoints,
        learningDays,
        masteryRate: Math.round(masteryRate * 10) / 10, // 保留一位小数
      },
    }
  }),

  /**
   * 获取学习活动趋势数据
   */
  getLearningActivityTrend: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(365).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { days } = input

      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setHours(0, 0, 0, 0)

      // 获取每日错题数据
      const wrongQuestionsByDate = await db
        .select({
          date: sql<string>`${wrongQuestions.createdAt}::date::text`,
          count: count(),
        })
        .from(wrongQuestions)
        .where(and(eq(wrongQuestions.userId, userId), gte(wrongQuestions.createdAt, startDate)))
        .groupBy(sql`${wrongQuestions.createdAt}::date`)

      // 获取每日复习数据（基于 reviewedAt）
      const reviewsByDate = await db
        .select({
          date: sql<string>`${wrongQuestions.reviewedAt}::date::text`,
          count: count(),
        })
        .from(wrongQuestions)
        .where(
          and(
            eq(wrongQuestions.userId, userId),
            sql`${wrongQuestions.reviewedAt} IS NOT NULL`,
            gte(wrongQuestions.reviewedAt, startDate)
          )
        )
        .groupBy(sql`${wrongQuestions.reviewedAt}::date`)

      // 获取每日知识点数据
      const knowledgePointsByDate = await db
        .select({
          date: sql<string>`${knowledgePoints.createdAt}::date::text`,
          count: count(),
        })
        .from(knowledgePoints)
        .where(and(eq(knowledgePoints.userId, userId), gte(knowledgePoints.createdAt, startDate)))
        .groupBy(sql`${knowledgePoints.createdAt}::date`)

      // 生成日期范围
      const chartData = []
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        const dateStr = date.toISOString().split('T')[0]
        const dateLabel = `${date.getMonth() + 1}/${date.getDate()}`

        const questionsCount =
          wrongQuestionsByDate.find((item) => item.date === dateStr)?.count || 0
        const reviewsCount = reviewsByDate.find((item) => item.date === dateStr)?.count || 0
        const knowledgePointsCount =
          knowledgePointsByDate.find((item) => item.date === dateStr)?.count || 0

        chartData.push({
          date: dateStr,
          dateLabel,
          questions: Number(questionsCount),
          reviews: Number(reviewsCount),
          knowledgePoints: Number(knowledgePointsCount),
        })
      }

      return {
        success: true,
        data: chartData,
      }
    }),

  /**
   * 获取科目分布数据
   */
  getSubjectDistribution: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id

    const subjectData = await db
      .select({
        subject: wrongQuestions.subject,
        count: count(),
      })
      .from(wrongQuestions)
      .where(and(eq(wrongQuestions.userId, userId), sql`${wrongQuestions.subject} IS NOT NULL`))
      .groupBy(wrongQuestions.subject)
      .orderBy(desc(count()))

    return {
      success: true,
      data: subjectData.map((item) => ({
        subject: item.subject || '未知',
        value: Number(item.count),
      })),
    }
  }),

  /**
   * 获取知识点掌握度分布
   */
  getKnowledgeMasteryDistribution: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id

    // 获取所有错题，计算掌握度
    const allWrongQuestions = await db
      .select({
        reviewCount: wrongQuestions.reviewCount,
        isReviewed: wrongQuestions.isReviewed,
      })
      .from(wrongQuestions)
      .where(eq(wrongQuestions.userId, userId))

    // 计算掌握度：reviewCount 越高，掌握度越高
    // 简化计算：根据 reviewCount 分组
    const masteryRanges = {
      '0-20%': 0,
      '21-40%': 0,
      '41-60%': 0,
      '61-80%': 0,
      '81-100%': 0,
    }

    allWrongQuestions.forEach((question) => {
      // 根据 reviewCount 估算掌握度
      // reviewCount 0-1: 0-20%, 2-3: 21-40%, 4-5: 41-60%, 6-7: 61-80%, 8+: 81-100%
      const reviewCount = question.reviewCount || 0
      let mastery = 0

      if (reviewCount === 0) {
        mastery = 0
      } else if (reviewCount <= 1) {
        mastery = 10 + (reviewCount * 10)
      } else if (reviewCount <= 3) {
        mastery = 21 + ((reviewCount - 1) * 10)
      } else if (reviewCount <= 5) {
        mastery = 41 + ((reviewCount - 3) * 10)
      } else if (reviewCount <= 7) {
        mastery = 61 + ((reviewCount - 5) * 10)
      } else {
        mastery = 81 + Math.min((reviewCount - 7) * 5, 19)
      }

      if (mastery <= 20) {
        masteryRanges['0-20%']++
      } else if (mastery <= 40) {
        masteryRanges['21-40%']++
      } else if (mastery <= 60) {
        masteryRanges['41-60%']++
      } else if (mastery <= 80) {
        masteryRanges['61-80%']++
      } else {
        masteryRanges['81-100%']++
      }
    })

    return {
      success: true,
      data: Object.entries(masteryRanges).map(([range, count]) => ({
        range,
        count,
      })),
    }
  }),

  /**
   * 获取艾宾浩斯复习曲线数据
   */
  getEbbinghausCurveData: protectedProcedure
    .input(
      z.object({
        days: z.number().min(7).max(60).default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { days } = input

      // 获取所有错题及其复习记录
      const allWrongQuestions = await db
        .select()
        .from(wrongQuestions)
        .where(eq(wrongQuestions.userId, userId))

      // 生成理论遗忘曲线数据
      const theoreticalCurve = []
      for (let i = 0; i < days; i++) {
        // 艾宾浩斯遗忘曲线公式：记忆保持率 = 100 * e^(-t/7)
        const retention = Math.max(0, 100 * Math.exp(-i / 7))
        theoreticalCurve.push({
          day: i,
          theoretical: retention,
        })
      }

      // 生成实际复习效果数据
      const actualCurve: Array<{ day: number; actual: number; isReviewPoint: boolean }> = []
      const reviewPoints: number[] = []

      // 计算起始日期（days 天前）
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      startDate.setHours(0, 0, 0, 0)

      // 收集所有复习时间点（相对于起始日期的天数）
      const allReviewPoints: number[] = []
      for (const question of allWrongQuestions) {
        if (!question.reviewedAt) continue

        const reviewedDate = new Date(question.reviewedAt)
        reviewedDate.setHours(0, 0, 0, 0)

        // 计算从起始日期到复习日期的天数
        const daysSinceStart = Math.floor(
          (reviewedDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
        )

        if (daysSinceStart >= 0 && daysSinceStart < days) {
          if (!allReviewPoints.includes(daysSinceStart)) {
            allReviewPoints.push(daysSinceStart)
          }
        }
      }

      // 对复习点排序
      allReviewPoints.sort((a, b) => a - b)

      for (let i = 0; i < days; i++) {
        let retention = 100
        let lastReviewDay = -1

        // 找到最近的复习点（在当前天数之前或等于当前天数）
        for (let j = allReviewPoints.length - 1; j >= 0; j--) {
          const reviewDay = allReviewPoints[j]
          if (reviewDay <= i) {
            lastReviewDay = reviewDay
            break
          }
        }

        // 计算从上次复习到现在的遗忘
        if (lastReviewDay >= 0) {
          const daysSinceReview = i - lastReviewDay
          retention = Math.max(0, 100 * Math.exp(-daysSinceReview / 7))
        } else {
          // 如果没有复习过，从第一天开始遗忘
          retention = Math.max(0, 100 * Math.exp(-i / 7))
        }

        // 在复习点，记忆恢复
        if (allReviewPoints.includes(i)) {
          retention = Math.min(100, Math.max(0, retention + 30)) // 复习后记忆恢复，确保在 [0, 100] 范围内
        }

        // 确保 retention 在 [0, 100] 范围内
        retention = Math.max(0, Math.min(100, retention))

        actualCurve.push({
          day: i,
          actual: retention,
          isReviewPoint: allReviewPoints.includes(i),
        })
      }

      // 合并数据
      const chartData = theoreticalCurve.map((item, index) => ({
        day: item.day,
        theoretical: item.theoretical,
        actual: actualCurve[index]?.actual || 0,
        isReviewPoint: actualCurve[index]?.isReviewPoint || false,
      }))

      return {
        success: true,
        data: chartData,
      }
    }),

  /**
   * 获取复习提醒列表
   */
  getReviewReminders: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { limit } = input

      const allWrongQuestions = await db
        .select()
        .from(wrongQuestions)
        .where(eq(wrongQuestions.userId, userId))

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const reminders = []

      for (const question of allWrongQuestions) {
        let nextReviewDate: Date
        let daysUntil: number

        if (!question.reviewedAt) {
          // 从未复习过，使用创建日期作为基准
          const createdAt = new Date(question.createdAt)
          nextReviewDate = getNextReviewDate(createdAt, 0)
          daysUntil = getDaysUntilReview(nextReviewDate)
        } else {
          const lastReviewDate = new Date(question.reviewedAt)
          nextReviewDate = getNextReviewDate(lastReviewDate, question.reviewCount || 0)
          daysUntil = getDaysUntilReview(nextReviewDate)
        }

        // 只包含需要复习的（已逾期或即将到期）
        if (daysUntil <= 3) {
          reminders.push({
            id: question.id,
            questionText: question.questionText,
            subject: question.subject || '未知',
            lastReviewDate: question.reviewedAt
              ? new Date(question.reviewedAt).toISOString().split('T')[0]
              : new Date(question.createdAt).toISOString().split('T')[0],
            nextReviewDate: nextReviewDate.toISOString().split('T')[0],
            daysUntil,
            reviewCount: (question.reviewCount || 0) + 1,
            urgency:
              daysUntil < 0 ? 'urgent' : daysUntil <= 1 ? 'high' : daysUntil <= 3 ? 'medium' : 'low',
          })
        }
      }

      // 按紧急程度排序
      reminders.sort((a, b) => {
        if (a.daysUntil !== b.daysUntil) {
          return a.daysUntil - b.daysUntil
        }
        return a.reviewCount - b.reviewCount
      })

      return {
        success: true,
        data: reminders.slice(0, limit),
      }
    }),
})
