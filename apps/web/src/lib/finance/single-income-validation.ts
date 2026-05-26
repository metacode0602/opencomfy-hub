/** 兼容旧版 validate 响应（projectNames）与新版（projects） */
export type SharedPlatformTenantWarningLike = {
  platformTenantId: string
  tenantId?: string | null
  tenantName?: string | null
  projects?: Array<{ projectId: string; projectName: string }>
  /** @deprecated 旧 API 字段 */
  projectNames?: string[]
}

export function getProjectsFromSharedWarning(
  warning: SharedPlatformTenantWarningLike,
): Array<{ projectId: string; projectName: string }> {
  if (Array.isArray(warning.projects) && warning.projects.length > 0) {
    return warning.projects
  }
  if (Array.isArray(warning.projectNames) && warning.projectNames.length > 0) {
    return warning.projectNames.map((name) => ({
      projectId: '—',
      projectName: name,
    }))
  }
  return []
}
