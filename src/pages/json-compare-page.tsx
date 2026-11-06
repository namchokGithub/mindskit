import { Eraser, FileText, GitCompareArrows, WrapText } from 'lucide-react'
import { useState } from 'react'

import { CodeEditor } from '@/components/tool/code-editor'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { JsonPrecisionWarning } from '@/components/tool/json-precision-warning'
import { TextStats } from '@/components/tool/text-stats'
import { Button } from '@/components/ui/button'
import { useLargeInputConfirmation } from '@/hooks/use-large-input-confirmation'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'
import { cn } from '@/lib/utils'

type DifferenceKind = 'added' | 'removed' | 'changed'

type Difference = {
  kind: DifferenceKind
  path: string
  left?: unknown
  right?: unknown
}

type Comparison =
  | { ok: true; differences: Difference[] }
  | { ok: false; side: 'left' | 'right'; message: string; line?: number }

type ParsedJson =
  | { ok: true; value: unknown }
  | { ok: false; side: 'left' | 'right'; message: string; line?: number }

const leftSample = JSON.stringify({
  id: 42,
  name: 'MindsKit',
  active: true,
  tags: ['json', 'tools'],
  settings: { theme: 'dark', retries: 2 },
}, null, 2)

const rightSample = JSON.stringify({
  id: 42,
  name: 'MindsKit Pro',
  active: true,
  tags: ['json', 'compare'],
  settings: { theme: 'light', retries: 3 },
  version: 2,
}, null, 2)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getErrorLine(message: string) {
  const match = message.match(/line (\d+)/i)
  return match ? Number(match[1]) : undefined
}

function parseJson(input: string, side: 'left' | 'right'): ParsedJson {
  if (!input.trim()) return { ok: false, side, message: `${side === 'left' ? 'Left' : 'Right'} JSON is empty.` }
  try {
    return { ok: true, value: JSON.parse(input) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON.'
    return { ok: false, side, message, line: getErrorLine(message) }
  }
}

function joinPath(parent: string, key: string | number) {
  return typeof key === 'number' ? `${parent}[${key}]` : parent === '$' ? `$.${key}` : `${parent}.${key}`
}

function collectDifferences(left: unknown, right: unknown, path = '$', differences: Difference[] = []): Difference[] {
  if (Object.is(left, right)) return differences

  if (Array.isArray(left) && Array.isArray(right)) {
    const length = Math.max(left.length, right.length)
    for (let index = 0; index < length; index += 1) {
      const nextPath = joinPath(path, index)
      if (index >= left.length) differences.push({ kind: 'added', path: nextPath, right: right[index] })
      else if (index >= right.length) differences.push({ kind: 'removed', path: nextPath, left: left[index] })
      else collectDifferences(left[index], right[index], nextPath, differences)
    }
    return differences
  }

  if (isRecord(left) && isRecord(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    for (const key of [...keys].sort((first, second) => first.localeCompare(second))) {
      const nextPath = joinPath(path, key)
      if (!Object.hasOwn(left, key)) differences.push({ kind: 'added', path: nextPath, right: right[key] })
      else if (!Object.hasOwn(right, key)) differences.push({ kind: 'removed', path: nextPath, left: left[key] })
      else collectDifferences(left[key], right[key], nextPath, differences)
    }
    return differences
  }

  differences.push({ kind: 'changed', path, left, right })
  return differences
}

function compareJson(leftInput: string, rightInput: string): Comparison {
  const left = parseJson(leftInput, 'left')
  if (!left.ok) return left
  const right = parseJson(rightInput, 'right')
  if (!right.ok) return right
  return { ok: true, differences: collectDifferences(left.value, right.value) }
}

function displayValue(value: unknown) {
  const text = JSON.stringify(value)
  return text.length > 180 ? `${text.slice(0, 177)}…` : text
}

const differenceStyle: Record<DifferenceKind, string> = {
  added: 'border-success/30 bg-success/10 text-success',
  removed: 'border-destructive/30 bg-destructive/10 text-destructive',
  changed: 'border-primary/30 bg-primary/10 text-primary-hover',
}

export function JsonComparePage() {
  const { enabled: saveLocally } = useSaveLocally()
  const [leftInput, setLeftInput] = usePersistedInput('json-compare-left', saveLocally)
  const [rightInput, setRightInput] = usePersistedInput('json-compare-right', saveLocally)
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [wrap, setWrap] = useState(false)
  const { confirm, dialog } = useLargeInputConfirmation()

  const compare = (left = leftInput, right = rightInput) => setComparison(compareJson(left, right))
  const comparisonError = comparison && !comparison.ok ? comparison : null
  const errorSide = comparisonError?.side
  const differences = comparison?.ok ? comparison.differences : []

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title="JSON Compare" description="Compare two JSON documents. Object key order is ignored; array order is compared." />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2">
          <Button type="button" size="sm" onClick={() => confirm(`${leftInput}\n${rightInput}`, () => compare())} disabled={!leftInput.trim() || !rightInput.trim()}><GitCompareArrows />Compare</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { setLeftInput(leftSample); setRightInput(rightSample); compare(leftSample, rightSample) }}><FileText />Sample</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => { setLeftInput(''); setRightInput(''); setComparison(null) }} disabled={!leftInput && !rightInput}><Eraser />Clear</Button>
          <Button type="button" variant="outline" size="sm" aria-pressed={wrap} onClick={() => setWrap((value) => !value)} className={cn(wrap && 'bg-accent text-accent-foreground')}><WrapText />Wrap</Button>
        </div>

        <div className="tool-workspace-grid grid min-h-0 flex-1 grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <section className="flex min-h-72 min-w-0 flex-col bg-editor/40 lg:min-h-0"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">JSON A</span><TextStats value={leftInput} /></div><CodeEditor bare value={leftInput} onChange={(value) => { setLeftInput(value); setComparison(null) }} placeholder="Paste the original JSON here…" wrap={wrap} ariaLabel="JSON A" errorLine={errorSide === 'left' ? comparisonError?.line : undefined} /></section>
          <section className="flex min-h-72 min-w-0 flex-col bg-muted/20 lg:min-h-0"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">JSON B</span><TextStats value={rightInput} /></div><CodeEditor bare value={rightInput} onChange={(value) => { setRightInput(value); setComparison(null) }} placeholder="Paste the JSON to compare here…" wrap={wrap} ariaLabel="JSON B" errorLine={errorSide === 'right' ? comparisonError?.line : undefined} /></section>
        </div>

        <section className="min-h-52 shrink-0 border-t border-border">
          <div className="flex items-center justify-between px-3 py-2"><span className="text-sm font-medium text-muted-foreground">Comparison result</span>{comparison?.ok && <span className={cn('text-xs font-medium', differences.length === 0 ? 'text-success' : 'text-muted-foreground')}>{differences.length === 0 ? 'Documents match' : `${differences.length} difference${differences.length === 1 ? '' : 's'}`}</span>}</div>
          <div className="max-h-72 overflow-auto px-3 pb-3">
            {comparison?.ok && differences.length === 0 && <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">The JSON documents are equivalent.</div>}
            {comparison?.ok && differences.map((difference, index) => <article key={`${difference.path}-${index}`} className={cn('mb-2 rounded-lg border px-3 py-2 text-sm last:mb-0', differenceStyle[difference.kind])}><div className="flex items-center justify-between gap-2"><span className="font-medium capitalize">{difference.kind}</span><code className="break-all font-mono text-xs">{difference.path}</code></div>{difference.kind === 'changed' ? <div className="mt-1 grid gap-1 font-mono text-xs sm:grid-cols-2"><span>JSON A: {displayValue(difference.left)}</span><span>JSON B: {displayValue(difference.right)}</span></div> : <code className="mt-1 block break-all font-mono text-xs">{displayValue(difference.kind === 'added' ? difference.right : difference.left)}</code>}</article>)}
            {comparison === null && <p className="px-1 py-3 text-sm text-muted-foreground">Compare two JSON documents to see their differences.</p>}
          </div>
        </section>
      </div>
      <JsonPrecisionWarning input={leftInput} />
      <JsonPrecisionWarning input={rightInput} />
      <ToolStatus state={comparison === null ? 'idle' : comparison.ok ? 'valid' : 'invalid'} message={comparison && !comparison.ok ? comparison.message : undefined} line={comparison && !comparison.ok ? comparison.line : undefined} validLabel={comparison?.ok && differences.length === 0 ? 'Documents match' : 'Comparison completed'} />
      {dialog}
    </div>
  )
}
