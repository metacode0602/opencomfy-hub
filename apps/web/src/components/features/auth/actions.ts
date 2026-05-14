'use server'

import { auth } from '@/lib/auth'
import { SigninFormValues, SignupFormValues } from './components/validation'
import { headers } from 'next/headers'

export async function serverSignUp({
  email,
  name,
  password
}: SignupFormValues): Promise<{ error: boolean; message: string }> {
  try {
    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        callbackURL: '/dashboard'
      },
      headers: await headers()
    })

    return { error: false, message: 'Signed up successfully.' }
  } catch (error: unknown) {
    console.log(error)

    return { error: true, message: 'Internal Server Error' }
  }
}

export async function serverSignIn({
  email,
  password,
  remember
}: SigninFormValues): Promise<{ error: boolean; message: string }> {
  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: remember
      },
      headers: await headers()
    })

    return { error: false, message: 'Signed in successfully.' }
  } catch (error: unknown) {
    console.log(error)

    return { error: true, message: 'Internal Server Error' }
  }
}

export async function serverSignOut(): Promise<{
  error: boolean
  message: string
}> {
  try {
    await auth.api.signOut({
      headers: await headers()
    })

    return { error: false, message: 'Signed out successfully.' }
  } catch (error: unknown) {
    console.log(error)

    return { error: true, message: 'Internal Server Error' }
  }
}
