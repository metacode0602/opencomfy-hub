export const stageSteps = [
  { key: 'lead', name: '线索孵化', requirements: ['需求确认', '技术评估', '方案设计'] },
  { key: 'testing', name: '测试中', requirements: ['POC 测试', '性能验证', '签订合同'] },
  { key: 'converted', name: '已转正', requirements: ['正式运营', '持续维护', '定期回顾'] },
]

export const consumptionTrend = [
  { date: '05-01', amount: 8500 },
  { date: '05-03', amount: 12000 },
  { date: '05-05', amount: 9800 },
  { date: '05-07', amount: 15600 },
  { date: '05-09', amount: 11200 },
  { date: '05-11', amount: 18900 },
  { date: '05-13', amount: 14500 },
]

export function getRoleLabel(role: string) {
  switch (role) {
    case 'sales':
      return '销售'
    case 'account_manager':
      return '客户经理'
    case 'pre_sales':
      return '售前'
    case 'system':
      return '系统'
    default:
      return role
  }
}
