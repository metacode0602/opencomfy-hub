import type { ProjectCostTenantGroup } from '@/lib/finance/project-cost-from-source-lines'
import type { ProjectCostMetadataRow } from '@/lib/server/dataaccess/finance/list-project-cost-metadata'

export function enrichProjectCostGroups(
  groups: ProjectCostTenantGroup[],
  metadataRows: ProjectCostMetadataRow[],
): ProjectCostTenantGroup[] {
  const metadataByPlatform = new Map(
    metadataRows.map((row) => [row.tenant_platform_id, row]),
  )

  return groups.map((group) => {
    const metadata = metadataByPlatform.get(group.tenantPlatformId)
    return {
      ...group,
      customerFullName: metadata?.customer_full_name || '',
      accountManager: metadata?.account_manager || group.accountManager || '',
      opportunitySource: metadata?.opportunity_source || '',
      monthPhaseLabel: metadata?.month_phase || '',
    }
  })
}
