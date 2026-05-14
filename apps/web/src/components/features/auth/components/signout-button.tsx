'use client'

import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { ReactNode, useState } from 'react'

interface SignoutButtonProps {
  children: ReactNode
}

export const SignoutButton = ({ children }: SignoutButtonProps) => {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignout() {
    await authClient.signOut({
      fetchOptions: {
        onRequest() {
          setLoading(true)
        },
        onResponse() {
          setLoading(false)
        },
        onSuccess() {
          setLoading(false)
          router.refresh()
        }
      }
    })
  }

  return (
    <div
      role="button"
      onClick={handleSignout}
      aria-disabled={loading}
      className="aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      {children}
    </div>
  )
}
