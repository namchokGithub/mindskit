export type SqlDialect = 'postgresql' | 'mysql' | 'transactsql'
export const sqlDialects: { value: SqlDialect; label: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'transactsql', label: 'SQL Server' },
]

function quoteName(name: string, dialect: SqlDialect): string {
  if (!name.trim() || [...name].some((char) => char.charCodeAt(0) < 32)) throw new Error('Enter a non-empty identifier without control characters.')
  if (dialect === 'mysql') return '`' + name.replaceAll('`', '``') + '`'
  if (dialect === 'transactsql') return '[' + name.replaceAll(']', ']]') + ']'
  return '"' + name.replaceAll('"', '""') + '"'
}

export function quoteSqlIdentifier(name: string, dialect: SqlDialect): string {
  return name.trim().split('.').map((part) => quoteName(part.trim(), dialect)).join('.')
}

function sqlString(value: string, dialect: SqlDialect): string {
  if (value.includes('\0')) throw new Error('SQL text values cannot contain NUL characters.')
  const escaped = value.replaceAll("'", "''")
  if (dialect === 'mysql') {
    if (!value.includes('\\')) return `_utf8mb4'${escaped}'`
    // Hex literals avoid dependence on the connection's NO_BACKSLASH_ESCAPES mode.
    const hex = Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `CONVERT(X'${hex}' USING utf8mb4)`
  }
  if (dialect === 'transactsql') return `N'${escaped}'`
  return value.includes('\\') ? `E'${escaped.replaceAll('\\', '\\\\')}'` : `'${escaped}'`
}

/** CSV records, including quoted delimiters, doubled quotes, and embedded newlines. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let closed = false
  let started = false
  const finishField = () => { row.push(field); field = ''; closed = false; started = false }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else { quoted = false; closed = true }
      } else field += char
      continue
    }
    if (char === ',') { finishField(); continue }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++
      finishField(); rows.push(row); row = []; continue
    }
    if (closed) throw new Error('Unexpected character after a closing CSV quote.')
    if (char === '"') {
      if (started) throw new Error('CSV quotes must start at the beginning of a field.')
      quoted = true; started = true
    } else { field += char; started = true }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.')
  if (started || closed || row.length) { finishField(); rows.push(row) }
  return rows
}

export interface SqlInOptions {
  dialect?: SqlDialect
  valueType?: 'text' | 'number'
  separator?: 'lines' | 'csv' | 'whitespace'
  notIn?: boolean
}

export function formatSqlInClause(input: string, column: string, removeDuplicates: boolean, options: SqlInOptions = {}): string {
  const { dialect = 'postgresql', valueType = 'text', separator = 'lines', notIn = false } = options
  const values = (separator === 'csv' ? parseCsv(input).flat() : input.split(separator === 'lines' ? /\r?\n/ : /\s+/))
    .map((value) => value.trim()).filter(Boolean)
  const items = removeDuplicates ? [...new Set(values)] : values
  if (!items.length) throw new Error('Paste at least one UUID or value.')
  const literals = items.map((value) => {
    if (valueType === 'text') return sqlString(value, dialect)
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) throw new Error(`Invalid numeric value: ${value}`)
    return value
  })
  return `WHERE ${quoteSqlIdentifier(column, dialect)} ${notIn ? 'NOT IN' : 'IN'} (\n${literals.map((value) => `  ${value}`).join(',\n')}\n)`
}

export interface SqlInsertOptions {
  dialect: SqlDialect
  source: 'json' | 'csv'
  table: string
  batchSize: number
  emptyAsNull: boolean
}

function sqlValue(value: unknown, dialect: SqlDialect): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'string') return sqlString(value, dialect)
  if (typeof value === 'boolean') return dialect === 'postgresql' ? String(value).toUpperCase() : value ? '1' : '0'
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new Error('JSON contains an out-of-range number. Supply large integers as strings to preserve their digits.')
    }
    return String(value)
  }
  throw new Error('Nested JSON objects and arrays are not supported. Flatten them or supply JSON text as a string.')
}

export function generateSqlInserts(input: string, options: SqlInsertOptions): string {
  const { dialect, source, batchSize, emptyAsNull } = options
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new Error('Batch size must be between 1 and 1000 rows.')
  const table = quoteSqlIdentifier(options.table, dialect)
  let columns: string[]
  let rows: unknown[][]
  if (source === 'csv') {
    const records = parseCsv(input)
    columns = (records.shift() ?? []).map((name) => name.trim())
    if (!columns.length || columns.some((name) => !name) || new Set(columns).size !== columns.length) {
      throw new Error('CSV needs a header with non-empty, unique column names.')
    }
    rows = records.map((record, index) => {
      if (record.length !== columns.length) throw new Error(`CSV record ${index + 2} has ${record.length} fields; expected ${columns.length}.`)
      return record.map((value) => emptyAsNull && value === '' ? null : value)
    })
  } else {
    const data: unknown = JSON.parse(input)
    if (!Array.isArray(data) || !data.length || data.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
      throw new Error('Enter a non-empty JSON array of objects.')
    }
    const records = data as Record<string, unknown>[]
    columns = [...new Set(records.flatMap((row) => Object.keys(row)))]
    rows = records.map((row) => columns.map((column) => Object.hasOwn(row, column) ? row[column] : null))
  }
  if (!columns.length || !rows.length) throw new Error('Provide at least one column and one data row.')
  const header = `INSERT INTO ${table} (${columns.map((column) => quoteName(column, dialect)).join(', ')}) VALUES`
  const statements: string[] = []
  for (let start = 0; start < rows.length; start += batchSize) {
    const tuples = rows.slice(start, start + batchSize).map((row) => `  (${row.map((value) => sqlValue(value, dialect)).join(', ')})`)
    statements.push(`${header}\n${tuples.join(',\n')};`)
  }
  return statements.join('\n\n')
}

export async function formatSql(input: string, dialect: SqlDialect, indent: '2' | '4' | 'tab', keywordCase: 'upper' | 'lower' | 'preserve'): Promise<string> {
  if (!input.trim()) throw new Error('Paste a SQL query to format.')
  const { format } = await import('sql-formatter')
  return format(input, { language: dialect, tabWidth: indent === '4' ? 4 : 2, useTabs: indent === 'tab', keywordCase })
}

export function sqlLiteral(value: unknown, dialect: SqlDialect): string {
  return sqlValue(value, dialect)
}

function readSqlSegment(input: string, start: number): number {
  const quote = input[start]
  if (quote === '$') {
    const delimiter = input.slice(start).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0]
    if (delimiter) {
      const end = input.indexOf(delimiter, start + delimiter.length)
      if (end === -1) throw new Error('Unclosed PostgreSQL dollar-quoted string.')
      return end + delimiter.length
    }
  }
  if (quote !== "'" && quote !== '"' && quote !== '`' && quote !== '[') return start + 1
  const closing = quote === '[' ? ']' : quote
  let index = start + 1
  while (index < input.length) {
    if (input[index] === closing) {
      if (quote !== '[' && input[index + 1] === closing) { index += 2; continue }
      return index + 1
    }
    if (quote === "'" && input[index] === '\\' && index + 1 < input.length) index += 2
    else index++
  }
  throw new Error('Unclosed SQL quoted value or identifier.')
}

function parseParameterValues(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    throw new Error('Parameters must be valid JSON: an array for ? or $1, or an object for :name.')
  }
}

/** Expands only real SQL placeholders, skipping strings, identifiers, and comments. */
export function previewSqlParameters(query: string, parametersInput: string, dialect: SqlDialect): string {
  if (!query.trim()) throw new Error('Paste a SQL query.')
  const parameters = parseParameterValues(parametersInput)
  let positionalIndex = 0
  const usedPositionalIndexes = new Set<number>()
  let output = ''
  for (let index = 0; index < query.length;) {
    const character = query[index]
    if (character === "'" || character === '"' || character === '`' || character === '[' || (character === '$' && /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.test(query.slice(index)))) {
      const end = readSqlSegment(query, index)
      output += query.slice(index, end)
      index = end
      continue
    }
    if (character === '-' && query[index + 1] === '-') {
      const end = query.indexOf('\n', index + 2)
      output += query.slice(index, end === -1 ? query.length : end)
      index = end === -1 ? query.length : end
      continue
    }
    if (character === '/' && query[index + 1] === '*') {
      const end = query.indexOf('*/', index + 2)
      if (end === -1) throw new Error('Unclosed SQL block comment.')
      output += query.slice(index, end + 2)
      index = end + 2
      continue
    }
    if (character === '?') {
      if (!Array.isArray(parameters)) throw new Error('The ? placeholder needs a JSON array.')
      while (usedPositionalIndexes.has(positionalIndex)) positionalIndex++
      if (positionalIndex >= parameters.length) throw new Error(`Missing value for parameter ${positionalIndex + 1}.`)
      output += sqlLiteral(parameters[positionalIndex], dialect)
      usedPositionalIndexes.add(positionalIndex++)
      index++
      continue
    }
    if (character === '$') {
      const match = query.slice(index).match(/^\$(\d+)\b/)
      if (match) {
        if (!Array.isArray(parameters)) throw new Error('The $1 placeholder needs a JSON array.')
        const parameterIndex = Number(match[1]) - 1
        if (!Number.isSafeInteger(parameterIndex) || parameterIndex < 0 || parameterIndex >= parameters.length) throw new Error(`Missing value for ${match[0]}.`)
        output += sqlLiteral(parameters[parameterIndex], dialect)
        usedPositionalIndexes.add(parameterIndex)
        index += match[0].length
        continue
      }
    }
    if (character === ':' && query[index - 1] !== ':' && query[index + 1] !== ':') {
      const match = query.slice(index).match(/^:([A-Za-z_][A-Za-z0-9_]*)\b/)
      if (match) {
        if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error('The :name placeholder needs a JSON object.')
        if (!Object.hasOwn(parameters, match[1])) throw new Error(`Missing value for :${match[1]}.`)
        output += sqlLiteral((parameters as Record<string, unknown>)[match[1]], dialect)
        index += match[0].length
        continue
      }
    }
    output += character
    index++
  }
  return output
}

export type SqlTargetLanguage = 'typescript' | 'go'

function toPascalCase(value: string): string {
  const words = value.replaceAll('`', '').replaceAll('"', '').replaceAll('[', '').replaceAll(']', '').split(/[^A-Za-z0-9]+/).filter(Boolean)
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join('') || 'Row'
}

function splitDdlColumns(body: string): string[] {
  const items: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < body.length;) {
    if (body[index] === "'" || body[index] === '"' || body[index] === '`' || body[index] === '[') { index = readSqlSegment(body, index); continue }
    if (body[index] === '(') depth++
    else if (body[index] === ')') depth--
    else if (body[index] === ',' && depth === 0) { items.push(body.slice(start, index).trim()); start = index + 1 }
    index++
  }
  const last = body.slice(start).trim()
  if (last) items.push(last)
  return items
}

const SQL_INTEGER_TYPES = new Set(['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'int2', 'int4', 'serial', 'serial2', 'serial4', 'smallserial'])
const SQL_BIGINT_TYPES = new Set(['bigint', 'int8', 'bigserial', 'serial8'])
const SQL_FLOAT_TYPES = new Set(['real', 'double', 'float', 'float4', 'float8', 'numeric', 'decimal', 'money'])
const SQL_BOOLEAN_TYPES = new Set(['bool', 'boolean', 'bit'])
const SQL_JSON_TYPES = new Set(['json', 'jsonb'])
const SQL_BINARY_TYPES = new Set(['bytea', 'blob', 'tinyblob', 'mediumblob', 'longblob', 'binary', 'varbinary'])

function sqlTypeToTarget(type: string, language: SqlTargetLanguage): string {
  // Match the whole base type name so prefixes such as `int` do not capture `interval`.
  const normalized = type.toLowerCase().replace(/\(.*/, '').trim().split(/\s+/)[0]
  if (language === 'typescript') {
    if (SQL_INTEGER_TYPES.has(normalized) || SQL_FLOAT_TYPES.has(normalized)) return 'number'
    if (SQL_BIGINT_TYPES.has(normalized)) return 'string'
    if (SQL_BOOLEAN_TYPES.has(normalized)) return 'boolean'
    if (SQL_JSON_TYPES.has(normalized)) return 'unknown'
    return 'string'
  }
  if (SQL_INTEGER_TYPES.has(normalized)) return 'int'
  if (SQL_BIGINT_TYPES.has(normalized)) return 'int64'
  if (SQL_FLOAT_TYPES.has(normalized)) return 'float64'
  if (SQL_BOOLEAN_TYPES.has(normalized)) return 'bool'
  if (SQL_JSON_TYPES.has(normalized)) return 'json.RawMessage'
  if (SQL_BINARY_TYPES.has(normalized)) return '[]byte'
  return 'string'
}

export function createTableToTypes(input: string, language: SqlTargetLanguage): string {
  const match = input.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([^\s(]+)\s*\(([\s\S]*)\)\s*;?\s*$/i)
  if (!match) throw new Error('Enter one complete CREATE TABLE statement.')
  const tableName = match[1].split('.').at(-1)!
  const columns = splitDdlColumns(match[2]).flatMap((definition) => {
    if (/^(constraint|primary\s+key|foreign\s+key|unique|check|exclude|key|index)\b/i.test(definition)) return []
    const column = definition.match(/^(?:`|"|\[)?([A-Za-z_][A-Za-z0-9_$]*)(?:`|"|\])?\s+([A-Za-z][A-Za-z0-9_]*(?:\s+[A-Za-z][A-Za-z0-9_]*)?(?:\s*\([^)]*\))?)/)
    if (!column) throw new Error(`Unable to read column definition: ${definition}`)
    return [{ name: column[1], type: column[2], nullable: !/\bnot\s+null\b|\bprimary\s+key\b/i.test(definition) }]
  })
  if (!columns.length) throw new Error('The CREATE TABLE statement has no supported columns.')
  const typeName = toPascalCase(tableName)
  if (language === 'typescript') {
    return `export interface ${typeName} {\n${columns.map((column) => `  ${column.name}${column.nullable ? '?:' : ':'} ${sqlTypeToTarget(column.type, language)}${column.nullable ? ' | null' : ''}`).join('\n')}\n}`
  }
  const needsJson = columns.some((column) => sqlTypeToTarget(column.type, language) === 'json.RawMessage')
  const imports = needsJson ? 'import "encoding/json"\n\n' : ''
  return `${imports}type ${typeName} struct {\n${columns.map((column) => `\t${toPascalCase(column.name)} ${sqlTypeToTarget(column.type, language)} \`json:"${column.name}${column.nullable ? ',omitempty' : ''}"\``).join('\n')}\n}`
}

export async function validateSqlSyntax(input: string, dialect: SqlDialect): Promise<{ valid: boolean; message?: string }> {
  try {
    await formatSql(input, dialect, '2', 'preserve')
    return { valid: true }
  } catch (cause) {
    return { valid: false, message: cause instanceof Error ? cause.message : 'The SQL could not be parsed.' }
  }
}

function needsSqlSpace(before: string, after: string): boolean {
  // Joining these pairs would start a comment (`5 - -3` must not become `5--3`).
  if ((before === '-' && after === '-') || (before === '/' && after === '*')) return true
  const punctuation = '(),;.+-*/%=<>!|&^~'
  return !punctuation.includes(before) && !punctuation.includes(after)
}

/** Removes comments and redundant whitespace without modifying quoted SQL. */
export function minifySql(input: string): string {
  if (!input.trim()) throw new Error('Paste a SQL query to minify.')

  let output = ''
  let pendingSpace = false
  let index = 0
  const append = (value: string) => {
    if (pendingSpace && output && needsSqlSpace(output.at(-1)!, value[0])) output += ' '
    output += value
    pendingSpace = false
  }
  const readQuoted = (delimiter: string, escapeDoubled = true) => {
    const start = index
    let closed = false
    index++
    while (index < input.length) {
      if (input[index] === delimiter) {
        if (escapeDoubled && input[index + 1] === delimiter) { index += 2; continue }
        index++
        closed = true
        break
      }
      if (input[index] === '\\' && delimiter === "'" && index + 1 < input.length) index += 2
      else index++
    }
    if (!closed) throw new Error('Unclosed SQL quoted value or identifier.')
    append(input.slice(start, index))
  }

  while (index < input.length) {
    const character = input[index]
    if (/\s/.test(character)) { pendingSpace = true; index++; continue }
    if (character === '-' && input[index + 1] === '-') {
      index += 2
      while (index < input.length && input[index] !== '\n' && input[index] !== '\r') index++
      pendingSpace = true
      continue
    }
    if (character === '/' && input[index + 1] === '*') {
      const end = input.indexOf('*/', index + 2)
      if (end === -1) throw new Error('Unclosed SQL block comment.')
      index = end + 2
      pendingSpace = true
      continue
    }
    if (character === "'" || character === '"' || character === '`') { readQuoted(character); continue }
    if (character === '[') { readQuoted(']', false); continue }
    if (character === '$') {
      const delimiter = input.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0]
      if (delimiter) {
        const end = input.indexOf(delimiter, index + delimiter.length)
        if (end === -1) throw new Error('Unclosed PostgreSQL dollar-quoted string.')
        append(input.slice(index, end + delimiter.length))
        index = end + delimiter.length
        continue
      }
    }
    append(character)
    index++
  }
  return output.trim()
}
