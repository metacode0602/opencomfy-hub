import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card'
import { SigninForm } from '@/components/features/auth/components/signin-form'
import { requireUnauth } from '@/components/features/auth/lib/utils'
import Link from 'next/link'

export default async function SignupPage() {
  await requireUnauth('/dashboard')

  return (
    <div className="my-8 flex w-full items-center justify-center px-6">
      <Card className="w-full max-w-3xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome Back.</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <SigninForm />
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-center text-sm">
            Do not have an account?{' '}
            <Link
              href="/signup"
              className="decoration-primary hover:text-primary underline underline-offset-4 transition-colors"
            >
              Click here
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
