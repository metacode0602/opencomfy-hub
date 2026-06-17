import 'server-only'

import { createBitableWorkOrderForBatch } from '@/lib/server/dataaccess/integrations/feishu/create-bitable-work-order'
import {
  createFeishuApprovalForBatch,
  retryFeishuApprovalForBatch,
} from '@/lib/server/dataaccess/integrations/feishu/create-batch-approval'
import { feishuWorkOrderConfigDataAccess } from '@/lib/server/dataaccess/integrations/feishu/work-order-config'
import {
  isFeishuAutoCreateEnabled,
  loadFeishuRuntimeConfig,
} from '@/lib/server/integrations/feishu/config'

export async function createFeishuWorkOrderForBatch(batchId: string): Promise<{
  workOrderNo: string | null
  createStatus: 'created' | 'failed' | 'skipped'
}> {
  const runtime = loadFeishuRuntimeConfig()
  if (!isFeishuAutoCreateEnabled(runtime)) {
    return { workOrderNo: null, createStatus: 'skipped' }
  }

  const woConfig = await feishuWorkOrderConfigDataAccess.getConfig()
  if (woConfig?.enabled && woConfig.workOrderBackend === 'bitable') {
    return createBitableWorkOrderForBatch(batchId)
  }

  return createFeishuApprovalForBatch(batchId)
}

export async function retryFeishuWorkOrderForBatch(batchId: string) {
  return createFeishuWorkOrderForBatch(batchId)
}

export { retryFeishuApprovalForBatch }
