'use client'

import { TooltipProvider } from '@workspace/ui/components/tooltip'
import { websiteConfig } from '@/lib/config/website'
import { ThemeProvider } from 'next-themes'
import { useState, type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider, isServer } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createTRPCClient } from '@trpc/client'
import { AppRouter } from '@/lib/server/routers'
import { trpcLinks } from '@/lib/trpc/links'
import { trpc } from '@/lib/trpc/client'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient()
  }

  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

/**
 * Providers
 *
 * This component is used to wrap the app in the providers.
 *
 * - ThemeProvider: Provides the theme to the app.
 * - ActiveThemeProvider: Provides the active theme to the app.
 * - RootProvider: Provides the root provider for Fumadocs UI.
 * - TooltipProvider: Provides the tooltip to the app.
 * - PaymentProvider: Provides the payment state to the app.
 */
export function Providers({ children }: PropsWithChildren) {
  const defaultMode = websiteConfig.metadata.mode?.defaultMode ?? 'system'
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient()
  queryClient.getQueryCache().config.onError = (error, query) => {
    console.error(error, query)

    if (error.message) toast.error(error.message)
  }

  const [trpcClient] = useState(() => {
    return createTRPCClient<AppRouter>({
      links: trpcLinks,
    })
  })


  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute='class' defaultTheme={defaultMode} enableSystem={true} disableTransitionOnChange>
            <TooltipProvider>
              {children}
            </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  )
}
