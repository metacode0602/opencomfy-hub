import XLSX from 'xlsx-js-style'

import type { DeviceRetireBatchPreview, DeviceRetireErrorExportRow } from '@/lib/types/device-retire'

const ERROR_FILL = {
  fill: {
    patternType: 'solid',
    fgColor: { rgb: 'FFFFC7CE' },
  },
}

const ERROR_FONT = {
  color: { rgb: 'FF9C0006' },
}

function formatCellValue(value: string | number | null | undefined): string {
  if (value == null) return ''
  return String(value)
}

export function buildDeviceRetireErrorExportRows(
  batch: DeviceRetireBatchPreview,
): DeviceRetireErrorExportRow[] {
  return batch.rows
    .filter((row) => row.errors.length > 0)
    .map((row) => ({
      row_no: row.row_no,
      originalCells: row.originalCells,
      errorColumnIndexes: row.errorColumnIndexes,
      errors: row.errors,
    }))
}

export function downloadDeviceRetireErrorExcel(params: {
  batch: DeviceRetireBatchPreview
  sourceFileName?: string
}) {
  const { batch } = params
  const errorRows = buildDeviceRetireErrorExportRows(batch)
  if (errorRows.length === 0) return

  const originalHeaders = batch.originalHeaders
  const headers = [...originalHeaders, '错误原因']
  const errorReasonCol = headers.length - 1
  const wsData: (string | number | null)[][] = [headers]

  for (const row of errorRows) {
    const line: (string | number | null)[] = originalHeaders.map((_, idx) =>
      formatCellValue(row.originalCells[idx]),
    )
    line[errorReasonCol] = row.errors.join('；')
    wsData.push(line)
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  for (let r = 1; r < wsData.length; r++) {
    const exportRow = errorRows[r - 1]!
    const errorIndexSet = new Set(exportRow.errorColumnIndexes)

    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) {
        ws[addr] = { t: 's', v: formatCellValue(wsData[r]![c]) }
      }

      if (c === errorReasonCol || errorIndexSet.has(c)) {
        ws[addr].s = {
          ...ERROR_FILL,
          font: ERROR_FONT,
        }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '下架错误')
  const baseName = (params.sourceFileName ?? batch.fileName).replace(/\.(xlsx|xls|csv|tsv|txt)$/i, '')
  const dcSlug = batch.dataCenterName.replace(/[^\w\u4e00-\u9fff-]+/g, '-')
  XLSX.writeFile(wb, `${baseName}-${dcSlug}-下架错误.xlsx`)
}
