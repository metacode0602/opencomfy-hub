import { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
  title: '欢迎回来 - 登录继续'
}

interface SigninLayoutProps {
  children: ReactNode
}

export default function SigninLayout({ children }: SigninLayoutProps) {
  return children
}
