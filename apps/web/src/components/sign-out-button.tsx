"use client"

import { useRouter } from "next/navigation"
import { signOut } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"

export function SignOutButton() {
  const router = useRouter()

  return (
    <Button
      variant="outline"
      onClick={async () => {
        await signOut({
          fetchOptions: {
            onSuccess: () => {
              router.push("/signin")
              router.refresh()
            },
          },
        })
      }}
    >
      Sign Out
    </Button>
  )
}
