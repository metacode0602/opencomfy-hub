import { createAuthClient } from 'better-auth/react'
import {
  adminClient,
  lastLoginMethodClient,
  organizationClient,
  phoneNumberClient,
} from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    phoneNumberClient(),
    organizationClient(),
    lastLoginMethodClient(),
  ],
})

export const { signIn, signUp, signOut, useSession } = authClient
