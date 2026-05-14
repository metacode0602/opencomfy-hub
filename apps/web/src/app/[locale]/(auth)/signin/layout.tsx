import { Metadata } from 'next'
import { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Welcome Back - login to continue'
}

interface SigninLayoutProps {
  children: ReactNode
}

export default function SigninLayout({ children }: SigninLayoutProps) {
  return children
}
