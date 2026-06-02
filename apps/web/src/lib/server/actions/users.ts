import { db } from '@/lib/db'
import { member, user } from '@workspace/db/schema'
import { auth } from '@/lib/auth'
import { eq, inArray, not } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { Routes } from '@/lib/routes'

export const getCurrentUser = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect(Routes.Login)
  }

  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
  })

  if (!currentUser) {
    redirect(Routes.Login)
  }

  return {
    ...session,
    currentUser,
  }
}

export const getUserById = async (userId: string) => {
  const userInfo = await db.query.user.findFirst({
    where: eq(user.id, userId),
  })
  return userInfo
}

export const signIn = async (email: string, password: string) => {
  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    })

    return {
      success: true,
      message: 'Signed in successfully.',
    }
  } catch (error) {
    const e = error as Error

    return {
      success: false,
      message: e.message || 'An unknown error occurred.',
    }
  }
}

export const signUp = async (_email: string, _password: string, _username: string) => {
  return {
    success: false,
    message: '注册已关闭，请联系管理员开通账号',
  }
}

export const getUsers = async (organizationId: string) => {
  try {
    const members = await db.query.member.findMany({
      where: eq(member.organizationId, organizationId),
    })

    const users = await db.query.user.findMany({
      where: not(
        inArray(
          user.id,
          members.map((member) => member.userId)
        )
      ),
    })

    return users
  } catch (error) {
    console.error(error)
    return []
  }
}
