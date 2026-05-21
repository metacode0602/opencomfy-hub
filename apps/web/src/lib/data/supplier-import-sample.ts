/**
 * 供应商 Excel 导入 — 样例行（Mock / 手工测试用）
 * 表头与 supplier-import-design.md §2.1 一致；可另存为 .xlsx 或 .csv（UTF-8）测试导入。
 */
export const SUPPLIER_IMPORT_EXCEL_HEADERS = [
  'ID',
  '租户ID',
  '入驻类型',
  '企业全称/真实姓名',
  '统一社会信用代码/身份证号码',
  '经营范围',
  '企业地址/地址',
  '联系人',
  '联系人电话',
  '营业执照',
  '法人身份证正面/身份证正面',
  '法人身份证反面/身份证反面',
  '银行名称',
  '开户行名称',
  '银行账号',
  '开户行地址',
  '管理员手机号',
  '管理员邮箱',
  '设备信息',
  '审核状态',
  '审核状态是否已确认',
  '合作模式',
  '审核备注',
  '创建时间',
  '最后更新时间',
] as const

/** 与 mockSuppliers sup1 对应 — 重导应显示「更新」；第二行应为「新建」 */
export const SUPPLIER_IMPORT_SAMPLE_ROWS: string[][] = [
  [
    '10001',
    '16462',
    '企业',
    '北京云智算力科技有限公司',
    '91110108MA01XXXXXX',
    '算力服务、云计算技术开发',
    '北京市海淀区西二旗中路12号',
    '王建国',
    '13811118888',
    'https://example.com/kyc/sup1/license.pdf',
    'https://example.com/kyc/sup1/id-front.jpg',
    'https://example.com/kyc/sup1/id-back.jpg',
    '中国工商银行',
    '中国工商银行北京海淀支行',
    '1100 1234 5678 9012 3456',
    '北京市海淀区西二旗中路1号',
    '13900001111',
    'admin@yunzhi.com',
    '{"gpu_count":520}',
    '已通过',
    '是',
    '卡时',
    '资质齐全',
    '2023/06/15',
    '2025/04/10',
  ],
  [
    '10003',
    '',
    '个人',
    '赵算力',
    '110101199001011234',
    '',
    '北京市朝阳区望京街道',
    '赵算力',
    '13600003333',
    '',
    'https://example.com/kyc/zhao/front.jpg',
    'https://example.com/kyc/zhao/back.jpg',
    '招商银行',
    '招商银行北京望京支行',
    '6225880123456789',
    '北京市朝阳区阜通东大街',
    '13600003333',
    'zhao@example.com',
    '2×A100',
    '待审核',
    '否',
    '分成',
    '',
    '2025/05/01',
    '2025/05/20',
  ],
]

/** 生成 UTF-8 CSV 文本（含 BOM），便于下载测试 */
export function buildSupplierImportSampleCsv(): string {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const lines = [
    SUPPLIER_IMPORT_EXCEL_HEADERS.map(escape).join(','),
    ...SUPPLIER_IMPORT_SAMPLE_ROWS.map((row) => row.map(escape).join(',')),
  ]
  return `\ufeff${lines.join('\n')}`
}
