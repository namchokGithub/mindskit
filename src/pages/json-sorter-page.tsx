import { ArrowDownUp, Eraser, FileText, WrapText } from 'lucide-react'
import { useState } from 'react'

import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { JsonPrecisionWarning } from '@/components/tool/json-precision-warning'
import { TextStats } from '@/components/tool/text-stats'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useLargeInputConfirmation } from '@/hooks/use-large-input-confirmation'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'
import { cn } from '@/lib/utils'
import type { FormatResult } from '@/types/format'

type SortMode = 'key-name' | 'key-value' | 'key-name-reversed' | 'key-value-reversed'
type JsonRecord = Record<string, unknown>

const sample = JSON.stringify([
  { id: 1, name: 'Tom Cruise', age: 61 },
  { id: 2, name: 'Justin Timberlake', age: 42 },
  { id: 3, name: 'Elon Musk', age: 52 },
], null, 2)

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function compareValues(left: unknown, right: unknown, mode: SortMode) {
  const direction = mode.endsWith('reversed') ? -1 : 1
  const leftNumber = typeof left === 'number' ? left : Number(left)
  const rightNumber = typeof right === 'number' ? right : Number(right)

  if (mode.startsWith('key-value') && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return (leftNumber - rightNumber) * direction
  }

  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: mode.startsWith('key-value'), sensitivity: 'base' }) * direction
}

function sortJson(input: string, key: string, mode: SortMode): FormatResult {
  if (!input.trim()) return { ok: false, message: 'Input is empty.' }
  if (!key.trim()) return { ok: false, message: 'Enter the key name to sort by.' }

  try {
    const parsed: unknown = JSON.parse(input)
    if (!Array.isArray(parsed)) return { ok: false, message: 'JSON Sorter accepts an array of objects.' }
    if (!parsed.every(isRecord)) return { ok: false, message: 'Every array item must be a JSON object.' }
    if (!parsed.some((item) => key in item)) return { ok: false, message: `No array item contains the key "${key}".` }

    const sorted = parsed.toSorted((left, right) => compareValues(left[key], right[key], mode))
    return { ok: true, output: JSON.stringify(sorted, null, 2) }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message.replace(/\s*at position \d+.*/i, '') : 'Invalid JSON.' }
  }
}

export function JsonSorterPage() {
  const { enabled: saveLocally } = useSaveLocally()
  const [input, setInput] = usePersistedInput('json-sorter', saveLocally)
  const [key, setKey] = useState('name')
  const [mode, setMode] = useState<SortMode>('key-name')
  const [result, setResult] = useState<FormatResult | null>(null)
  const [wrap, setWrap] = useState(false)
  const { confirm, dialog } = useLargeInputConfirmation()

  const run = (value = input, nextKey = key, nextMode = mode) => setResult(sortJson(value, nextKey, nextMode))
  const resetResult = () => setResult(null)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <ToolPageHeader title="JSON Sorter" description="Sort an array of JSON objects by any field, in ascending or descending order." />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2">
          <Button type="button" size="sm" onClick={() => confirm(input, () => run())} disabled={!input.trim()}><ArrowDownUp />Sort JSON</Button>
          <Select value={mode} onValueChange={(value) => { setMode(value as SortMode); resetResult() }}>
            <SelectTrigger size="sm" className="min-w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="key-name">Key Name</SelectItem>
              <SelectItem value="key-value">Key Value</SelectItem>
              <SelectItem value="key-name-reversed">Key Name (reversed)</SelectItem>
              <SelectItem value="key-value-reversed">Key Value (reversed)</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Key Name<input value={key} onChange={(event) => { setKey(event.target.value); resetResult() }} placeholder="e.g. name" className="h-7 w-32 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label>
          <Button type="button" variant="outline" size="sm" onClick={() => { setInput(sample); run(sample) }}><FileText />Sample</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { setInput(''); resetResult() }} disabled={!input}><Eraser />Clear</Button>
          <Button type="button" variant="outline" size="sm" aria-pressed={wrap} onClick={() => setWrap((value) => !value)} className={cn(wrap && 'bg-accent text-accent-foreground')}><WrapText />Wrap</Button>
        </div>
        <div className="tool-workspace-grid grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
          <section className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-r lg:border-b-0"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">JSON array input</span><TextStats value={input} /></div><CodeEditor bare value={input} onChange={(value) => { setInput(value); resetResult() }} placeholder="Paste an array of JSON objects here…" wrap={wrap} ariaLabel="JSON array input" errorLine={result && !result.ok ? result.line : undefined} /></section>
          <section className="flex min-h-0 min-w-0 flex-col"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">Sorted JSON</span><CopyButton value={result?.ok ? result.output : ''} /></div><CodeEditor bare value={result?.ok ? result.output : ''} readOnly placeholder="Sorted JSON will appear here." wrap={wrap} ariaLabel="Sorted JSON" /></section>
        </div>
      </div>
      <JsonPrecisionWarning input={input} />
      <ToolStatus state={result === null ? 'idle' : result.ok ? 'valid' : 'invalid'} message={result && !result.ok ? result.message : undefined} validLabel="Sorted successfully" />
      {dialog}
    </div>
  )
}
