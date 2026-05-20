import type { ProjectImportErrorExportRow, ProjectImportPreviewResult } from '@/lib/types/project-import'

import XLSX from 'xlsx-js-style'

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

export function buildProjectImportErrorExportRows(
  preview: ProjectImportPreviewResult,
): ProjectImportErrorExportRow[] {
  const cellMap = new Map(
    preview.parsedSnapshot.map((row) => [row.rowIndex, row.originalCells]),
  )

  return preview.rows
    .filter((row) => row.errors.length > 0)
    .map((row) => ({
      rowIndex: row.rowIndex,
      originalCells: cellMap.get(row.rowIndex) ?? [],
      errorColumnIndexes: row.errorColumnIndexes,
      errors: row.errors,
    }))
}

export function downloadProjectImportErrorExcel(params: {
  originalHeaders: string[]
  errorRows: ProjectImportErrorExportRow[]
  sourceFileName: string
}) {
  const { originalHeaders, errorRows, sourceFileName } = params
  if (errorRows.length === 0) return

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

      if (c === errorReasonCol) {
        ws[addr].s = {
          ...ERROR_FILL,
          font: ERROR_FONT,
        }
        continue
      }

      if (errorIndexSet.has(c)) {
        ws[addr].s = {
          ...ERROR_FILL,
          font: ERROR_FONT,
        }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '导入错误')
  const baseName = sourceFileName.replace(/\.(xlsx|xls)$/i, '')
  XLSX.writeFile(wb, `${baseName}-导入错误.xlsx`)
}
