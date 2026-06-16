'use client'

import { trpc } from '@/lib/trpc/client'

export function useFeishuIntegrationConfig(enabled = true) {
  const { data, isLoading } = trpc.integration.feishu.getClientConfig.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
  })

  return {
    isLoading,
    autoCreateEnabled: data?.autoCreateEnabled ?? false,
    manualWorkOrderRequired: data?.manualWorkOrderRequired ?? true,
    integrationConfigured: data?.integrationConfigured ?? false,
  }
}
