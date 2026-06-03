/** 下载服务端返回的 base64 Excel（导入错误标注文件） */
export function downloadBase64Excel(fileName: string, fileBase64: string): void {
  const bin = atob(fileBase64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function buildImportParseFailureMessage(input: {
  message?: string
  parseErrorCount?: number
  hasErrorReport?: boolean
}): string {
  if (input.message?.trim()) return input.message.trim()
  if (input.parseErrorCount && input.parseErrorCount > 0) {
    return `存在 ${input.parseErrorCount} 处错误，请下载标注 Excel：错误单元格已标红，「错误说明」列有逐行说明`
  }
  if (input.hasErrorReport) {
    return '解析未通过，请下载标注 Excel 查看错误说明'
  }
  return '解析未通过，请修正后重新上传'
}

export function buildImportSuccessMessage(rowCount: number): string {
  return `解析成功（${rowCount} 行）`
}
