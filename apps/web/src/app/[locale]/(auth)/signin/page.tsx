import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card'
import { SigninForm } from '@/components/features/auth/components/signin-form'
import { requireUnauth } from '@/components/features/auth/lib/utils'
import { getTranslations } from 'next-intl/server'

export default async function SigninPage() {
  await requireUnauth('/dashboard')
  const t = await getTranslations('AuthPage.login')

  return (
    <div className="my-8 flex w-full items-center justify-center px-6">
      <Card className="w-full max-w-2xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">{t('welcomeBack')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <SigninForm />
        </CardContent>
      </Card>
    </div>
  )
}
