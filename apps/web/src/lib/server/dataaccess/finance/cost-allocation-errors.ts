export type PendingCostAllocationProject = {
  projectId: string
  projectName: string
  staffName: string | null
  allocationPercent: string | null
}

export type PendingCostAllocationIssue = {
  tenantPlatformId: string
  tenantId: string
  tenantName: string | null
  customerFullName: string | null
  reason: 'missing_project' | 'sum_not_100'
  projects: PendingCostAllocationProject[]
  missingProjects: PendingCostAllocationProject[]
  allocationSumPercent: number | null
}

function formatTenantLabel(issue: PendingCostAllocationIssue): string {
  const parts = [`租户 ${issue.tenantPlatformId}`]
  if (issue.customerFullName) parts.push(`客户：${issue.customerFullName}`)
  if (issue.tenantName && issue.tenantName !== issue.customerFullName) {
    parts.push(`计费租户：${issue.tenantName}`)
  }
  return parts.join('，')
}

function formatProjectLine(project: PendingCostAllocationProject): string {
  const staff = project.staffName ? `客户经理 ${project.staffName}` : '未配置客户经理'
  const pct =
    project.allocationPercent != null ? `已配 ${project.allocationPercent}%` : '未配置分成'
  return `${project.projectName}（${staff}，${pct}）`
}

export function formatPendingCostAllocationError(
  issues: PendingCostAllocationIssue[],
  context: 'cost' | 'income' | 'validate' = 'validate',
): string {
  if (issues.length === 0) return ''

  const actionHint =
    '请在本账期为各项目填写成本分成比例（合计须为 100%），或在 CRM 租户详情维护「项目成本分成」预置后重试。'

  const verb =
    context === 'cost' ? '计算成本' : context === 'income' ? '计算收入' : '继续计算'

  const header = `${issues.length} 个租户需先配置成本分成比例方可${verb}：`
  const lines = issues.map((issue, index) => {
    const label = formatTenantLabel(issue)
    if (issue.reason === 'sum_not_100') {
      const projectLines = issue.projects.map((p) => `  · ${formatProjectLine(p)}`).join('\n')
      return `${index + 1}. ${label} — 已填分成合计 ${issue.allocationSumPercent?.toFixed(2) ?? '—'}%，须为 100%：\n${projectLines}`
    }
    const missingLines = issue.missingProjects
      .map((p) => `  · ${formatProjectLine(p)}`)
      .join('\n')
    const configured = issue.projects.filter((p) => p.allocationPercent != null)
    const configuredHint =
      configured.length > 0
        ? `\n  已配置：${configured.map((p) => `${p.projectName} ${p.allocationPercent}%`).join('、')}`
        : ''
    return `${index + 1}. ${label} — 关联 ${issue.projects.length} 个项目，${issue.missingProjects.length} 个未配置分成：\n${missingLines}${configuredHint}`
  })

  return `${header}\n${lines.join('\n')}\n${actionHint}`
}
