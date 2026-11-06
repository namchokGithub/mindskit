import { stringify } from 'yaml'

export function jsonToYaml(input: string): string {
  return stringify(JSON.parse(input))
}

export function jsonToCsv(input: string): string {
  const value: unknown = JSON.parse(input)
  if (!Array.isArray(value)) throw new Error('CSV conversion requires a JSON array of objects.')
  if (!value.length) return ''
  if (!value.every(isRecord)) throw new Error('Every item in the JSON array must be an object.')

  const rows = value as Record<string, unknown>[]
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  return [headers.map(csvValue), ...rows.map((row) => headers.map((header) => csvValue(row[header])))].map((row) => row.join(',')).join('\n')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
