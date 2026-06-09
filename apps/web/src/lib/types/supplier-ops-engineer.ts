export type SupplierOpsEngineer = {
  id: string
  supplierId: string
  dataCenterId: string
  dataCenterName: string
  name: string
  phone: string
  email: string
  wechatId: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function formatSupplierOpsEngineerRow(engineer: SupplierOpsEngineer): string {
  const lines = [`姓名：${engineer.name}`]
  if (engineer.dataCenterName.trim()) lines.push(`机房：${engineer.dataCenterName}`)
  if (engineer.phone.trim()) lines.push(`手机：${engineer.phone}`)
  if (engineer.email.trim()) lines.push(`邮箱：${engineer.email}`)
  if (engineer.wechatId.trim()) lines.push(`微信：${engineer.wechatId}`)
  return lines.join('\n')
}
