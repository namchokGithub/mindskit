import { Braces, Download, Eraser, FileText, Shrink } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { JsonPrecisionWarning } from '@/components/tool/json-precision-warning'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatSql, formatSqlInClause, generateSqlInserts, minifySql, sqlDialects, type SqlDialect, type SqlInOptions } from '@/features/sql'
import { useLargeInputConfirmation } from '@/hooks/use-large-input-confirmation'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'

type SqlTool = 'formatter' | 'minifier' | 'in' | 'insert'
const configs = {
  formatter: { title: 'SQL Formatter', description: 'Format SQL with dialect-aware indentation and keyword casing.', storage: 'sql-formatter', action: 'Format SQL' },
  minifier: { title: 'SQL Minifier', description: 'Remove comments and unnecessary whitespace while preserving literals.', storage: 'sql-minifier', action: 'Minify SQL' },
  in: { title: 'SQL IN Builder', description: 'Build an IN or NOT IN clause from UUIDs, text, or numbers.', storage: 'sql-in-clause', action: 'Build clause' },
  insert: { title: 'JSON / CSV → INSERT', description: 'Generate batched SQL INSERT statements from JSON objects or CSV records.', storage: 'sql-insert', action: 'Generate INSERT' },
}
const controlClass = 'h-8 max-w-full rounded-md border border-input bg-background px-2 text-sm text-foreground'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-muted-foreground">{label}{children}</label>
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <Field label={label}><select className={controlClass} value={value} onChange={(event) => { const option = options.find((item) => item.value === event.target.value); if (option) onChange(option.value) }}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
}

export function SqlToolsPage({ tool }: { tool: SqlTool }) {
  const config = configs[tool]
  const { enabled } = useSaveLocally()
  const [input, setInput] = usePersistedInput(config.storage, enabled)
  const [dialect, setDialect] = useState<SqlDialect>('postgresql')
  const [indent, setIndent] = useState<'2' | '4' | 'tab'>('2')
  const [keywordCase, setKeywordCase] = useState<'upper' | 'lower' | 'preserve'>('upper')
  const [column, setColumn] = useState('id')
  const [table, setTable] = useState('users')
  const [valueType, setValueType] = useState<'text' | 'number'>('text')
  const [separator, setSeparator] = useState<NonNullable<SqlInOptions['separator']>>('lines')
  const [operator, setOperator] = useState<'IN' | 'NOT IN'>('IN')
  const [removeDuplicates, setRemoveDuplicates] = useState(true)
  const [source, setSource] = useState<'json' | 'csv'>('json')
  const [batchSize, setBatchSize] = useState('100')
  const [emptyAsNull, setEmptyAsNull] = useState(false)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const revision = useRef(0)
  const { confirm, dialog } = useLargeInputConfirmation()

  useEffect(() => {
    if (tool !== 'insert') return
    try {
      const transferredJson = sessionStorage.getItem('mindskit:transfer:json-insert')
      if (!transferredJson) return
      sessionStorage.removeItem('mindskit:transfer:json-insert')
      queueMicrotask(() => {
        setInput(transferredJson)
        setSource('json')
      })
    } catch {
      // sessionStorage may be unavailable; use the regular input instead.
    }
  }, [tool, setInput])

  const invalidate = () => { revision.current++; setOutput(''); setError(''); setBusy(false) }
  const update = <T,>(setter: (value: T) => void) => (value: T) => { invalidate(); setter(value) }
  const changeInput = (value: string) => { invalidate(); setInput(value) }
  const run = async (value = input) => {
    const current = ++revision.current
    setBusy(true); setOutput(''); setError('')
    try {
      const result = tool === 'formatter'
        ? await formatSql(value, dialect, indent, keywordCase)
        : tool === 'minifier'
          ? minifySql(value)
        : tool === 'in'
          ? formatSqlInClause(value, column, removeDuplicates, { dialect, valueType, separator, notIn: operator === 'NOT IN' })
          : generateSqlInserts(value, { dialect, source, table, batchSize: Number(batchSize), emptyAsNull })
      if (revision.current === current) setOutput(result)
    } catch (cause) {
      if (revision.current === current) setError(cause instanceof Error ? cause.message : 'Unable to process the input.')
    } finally {
      if (revision.current === current) setBusy(false)
    }
  }
  const sample = tool === 'formatter' ? "select u.id,u.name,count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.active=1 group by u.id,u.name order by orders desc;"
    : tool === 'minifier' ? "-- Keep the literal below intact\nSELECT  id,  'from  where' AS note /* removed */\nFROM users\nWHERE active = true;"
    : tool === 'in' ? (valueType === 'number' ? ['1', '2', '2', '3'] : ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8']).join(separator === 'csv' ? ',' : separator === 'whitespace' ? ' ' : '\n')
      : source === 'json' ? JSON.stringify([{ id: 1, name: "O'Brien", active: true }, { id: 2, name: 'Ada', active: false, note: null }], null, 2)
        : 'id,name,note\r\n001,"O\'Brien","Hello, SQL"\r\n002,Ada,\r\n'

  const download = () => {
    const url = URL.createObjectURL(new Blob([output], { type: 'application/sql;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = `${config.storage}.sql`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="flex min-h-0 flex-1 flex-col gap-4">
    <ToolPageHeader title={config.title} description={`${config.description} Everything runs in your browser.`} />
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
      {tool !== 'minifier' && <Choice label="SQL dialect" value={dialect} options={sqlDialects} onChange={update(setDialect)} />}
      {tool === 'formatter' && <>
        <Choice label="Indentation" value={indent} options={[{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }, { value: 'tab', label: 'Tabs' }]} onChange={update(setIndent)} />
        <Choice label="Keyword case" value={keywordCase} options={[{ value: 'upper', label: 'UPPERCASE' }, { value: 'lower', label: 'lowercase' }, { value: 'preserve', label: 'Preserve' }]} onChange={update(setKeywordCase)} />
      </>}
      {tool === 'in' && <>
        <Field label="Column (optional table prefix)"><input className={`${controlClass} w-44`} value={column} onChange={(event) => update(setColumn)(event.target.value)} /></Field>
        <Choice label="Value type" value={valueType} options={[{ value: 'text', label: 'Text / UUID' }, { value: 'number', label: 'Number' }]} onChange={update(setValueType)} />
        <Choice label="Input separator" value={separator} options={[{ value: 'lines', label: 'One value per line' }, { value: 'csv', label: 'CSV (double-quoted fields)' }, { value: 'whitespace', label: 'Whitespace' }]} onChange={update(setSeparator)} />
        <Choice label="Operator" value={operator} options={[{ value: 'IN', label: 'IN' }, { value: 'NOT IN', label: 'NOT IN' }]} onChange={update(setOperator)} />
        <label className="flex h-8 items-center gap-2 text-sm"><Checkbox checked={removeDuplicates} onCheckedChange={(checked) => { invalidate(); setRemoveDuplicates(checked === true) }} />Remove duplicates</label>
      </>}
      {tool === 'insert' && <>
        <Choice label="Input format" value={source} options={[{ value: 'json', label: 'JSON array' }, { value: 'csv', label: 'CSV with header' }]} onChange={update(setSource)} />
        <Field label="Table (optional schema prefix)"><input className={`${controlClass} w-44`} value={table} onChange={(event) => update(setTable)(event.target.value)} /></Field>
        <Field label="Rows per INSERT (1–1000)"><input type="number" min={1} max={1000} step={1} className={`${controlClass} w-36`} value={batchSize} onChange={(event) => update(setBatchSize)(event.target.value)} /></Field>
        {source === 'csv' && <label className="flex h-8 items-center gap-2 text-sm"><Checkbox checked={emptyAsNull} onCheckedChange={(checked) => { invalidate(); setEmptyAsNull(checked === true) }} />Empty fields as NULL</label>}
      </>}
    </div>
    <p className="text-xs text-muted-foreground">{tool === 'formatter' ? 'Formats queries; does not validate schemas or execute SQL. Stored procedures and custom delimiters are not supported.' : tool === 'minifier' ? 'Removes line and block comments, then collapses unnecessary whitespace. It does not validate or execute SQL.' : tool === 'in' ? 'Paste raw values without SQL quotes. Use CSV mode for values containing commas. Text values are always treated as literal text.' : source === 'json' ? 'Use a flat array of objects. Missing fields become NULL; nested objects and arrays must be flattened. Supply large integers as strings.' : 'The first CSV record supplies column names. CSV values stay text, preserving leading zeros; empty fields become NULL only when selected.'}</p>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap gap-2 border-b border-border bg-secondary/50 px-3 py-2">
        <Button size="sm" disabled={!input.trim() || busy} onClick={() => confirm(input, () => { void run() })}>{tool === 'minifier' ? <Shrink /> : <Braces />}{busy ? 'Processing…' : config.action}</Button>
        <Button size="sm" variant="outline" onClick={() => { changeInput(sample); void run(sample) }}><FileText />Sample</Button>
        <Button size="sm" variant="outline" disabled={!input && !output && !error} onClick={() => changeInput('')}><Eraser />Clear</Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section className="flex min-w-0 flex-col"><div className="flex h-11 items-center px-3 text-sm font-medium">Input</div><CodeEditor bare value={input} onChange={changeInput} wrap ariaLabel={`${config.title} input`} language={tool === 'formatter' || tool === 'minifier' ? 'sql' : tool === 'insert' && source === 'json' ? 'json' : 'text'} placeholder="Paste input here or try Sample…" /></section>
        <section className="flex min-w-0 flex-col"><div className="flex h-11 items-center justify-between gap-2 px-3"><span className="text-sm font-medium">SQL output</span><div className="flex gap-2"><CopyButton value={output} /><Button size="sm" variant="outline" disabled={!output} onClick={download}><Download />.sql</Button></div></div><CodeEditor bare value={output} readOnly wrap ariaLabel={`${config.title} output`} language="sql" placeholder="SQL output will appear here." /></section>
      </div>
    </div>
    {tool === 'insert' && <JsonPrecisionWarning input={input} />}
    <ToolStatus state={error ? 'invalid' : output ? 'valid' : 'idle'} message={error || undefined} validLabel="SQL generated successfully" />
    {dialog}
  </div>
}

export function SqlFormatterPage() { return <SqlToolsPage key="formatter" tool="formatter" /> }
export function SqlMinifierPage() { return <SqlToolsPage key="minifier" tool="minifier" /> }
export function SqlInsertPage() { return <SqlToolsPage key="insert" tool="insert" /> }
