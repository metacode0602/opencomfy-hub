import { createTRPCRouter } from '../trpc'
import { homeworkSessionsRouter } from './sessions'
import { homeworkImagesRouter } from './images'
import { knowledgePointsRouter } from './knowledge-points'
import { wrongQuestionsRouter } from './wrong-questions'
import { homeworkSummarizeRouter } from './summarize'
import { chatsRouter } from './chats'

export const homeworkRouter = createTRPCRouter({
  sessions: homeworkSessionsRouter,
  images: homeworkImagesRouter,
  knowledgePoints: knowledgePointsRouter,
  wrongQuestions: wrongQuestionsRouter,
  summarize: homeworkSummarizeRouter,
  chats: chatsRouter,
})
