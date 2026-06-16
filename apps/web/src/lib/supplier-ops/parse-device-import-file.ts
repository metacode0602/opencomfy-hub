import * as XLSX from 'xlsx'

import type {
  DeviceChangelogParsedRow,
  DeviceInventoryParsedRow,
  FaultRecordsParsedRow,
} from '@/lib/types/supplier-domain'
import {
  importMatrixToTable,
  parseCsvTextToTable,
  parseDeviceChangelogTable,
  parseDeviceFaultRecordsTable,
  parseDeviceInventoryTable,
  type ParseCsvResult,
} from '@/lib/supplier-ops/parse-device-import-csv'

export type DeviceImportFileKind = 'device_inventory' | 'device_changelog' | 'fault_records'

function isCsvImportFileName(fileName: string): boolean {
  const name = fileName.toLowerCase()
  return name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')
}

function readExcelMatrix(buffer: ArrayBuffer, fileName: string): unknown[][] {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch (e) {
    throw new Error(`无法解析文件 ${fileName}：${e instanceof Error ? e.message : '格式错误'}`)
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 无有效工作表')

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('Excel 工作表为空')

  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][]
}

function readImportTable(buffer: ArrayBuffer, fileName: string): string[][] {
  if (isCsvImportFileName(fileName)) {
    return parseCsvTextToTable(new TextDecoder('utf-8').decode(buffer))
  }
  return importMatrixToTable(readExcelMatrix(buffer, fileName))
}

/** 将行对象组装为与 Excel/CSV 相同的二维表结构 */
export function buildImportTableFromRows(
  headers: string[],
  rows: Record<string, string>[],
): string[][] {
  const table: string[][] = [headers]
  for (const row of rows) {
    table.push(headers.map((header) => row[header] ?? ''))
  }
  return table
}

export function parseDeviceImportFile(
  buffer: ArrayBuffer,
  fileName: string,
  kind: 'device_inventory',
): ParseCsvResult<DeviceInventoryParsedRow>
export function parseDeviceImportFile(
  buffer: ArrayBuffer,
  fileName: string,
  kind: 'device_changelog',
): ParseCsvResult<DeviceChangelogParsedRow>
export function parseDeviceImportFile(
  buffer: ArrayBuffer,
  fileName: string,
  kind: 'fault_records',
): ParseCsvResult<FaultRecordsParsedRow>
/** 将上传文件（Excel / CSV）解析为设备导入行 */
export function parseDeviceImportFile(
  buffer: ArrayBuffer,
  fileName: string,
  kind: DeviceImportFileKind,
): ParseCsvResult<DeviceInventoryParsedRow | DeviceChangelogParsedRow | FaultRecordsParsedRow> {
  const table = readImportTable(buffer, fileName)
  if (kind === 'device_inventory') {
    return parseDeviceInventoryTable(table)
  }
  if (kind === 'device_changelog') {
    return parseDeviceChangelogTable(table)
  }
  return parseDeviceFaultRecordsTable(table)
}
