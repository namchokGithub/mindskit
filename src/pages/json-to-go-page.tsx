import { Eraser, FileCode2, FileText } from 'lucide-react'
import { useState } from 'react'

import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { JsonPrecisionWarning } from '@/components/tool/json-precision-warning'
import { TextStats } from '@/components/tool/text-stats'
import { Button } from '@/components/ui/button'
import { jsonToGoStruct } from '@/features/json-to-go'
import { useLargeInputConfirmation } from '@/hooks/use-large-input-confirmation'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'

const sample = JSON.stringify({ employees: { employee: [{ id: '1', firstName: 'Tom', lastName: 'Cruise', photo: 'https://example.com/tom.jpg' }, { id: '3', firstName: 'Robert', lastName: 'Downey Jr.', photo: 'https://example.com/robert.jpg', item: { id: '3', firstName: 'Robert', lastName: 'Downey Jr.', photo: 'https://example.com/robert.jpg' } }] } }, null, 2)

export function JsonToGoPage() {
  const { enabled: saveLocally } = useSaveLocally()
  const [input, setInput] = usePersistedInput('json-to-go', saveLocally)
  const [rootName, setRootName] = useState('Root')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [hasRun, setHasRun] = useState(false)
  const { confirm, dialog } = useLargeInputConfirmation()
  const run = (value = input) => { try { setOutput(jsonToGoStruct(value, rootName)); setError(''); setHasRun(true) } catch (cause) { setOutput(''); setError(cause instanceof Error ? cause.message : 'Invalid JSON.'); setHasRun(false) } }

  return <div className="flex h-full min-h-0 flex-col gap-4"><ToolPageHeader title="JSON → Go Struct" description="Generate Go structs from JSON locally in your browser." /><div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2"><Button type="button" size="sm" onClick={() => confirm(input, () => run())} disabled={!input.trim()}><FileCode2 />Generate</Button><label className="flex items-center gap-1.5 text-xs text-muted-foreground">Root struct<input value={rootName} onChange={(event) => { setRootName(event.target.value); setHasRun(false) }} className="h-7 w-28 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label><Button type="button" variant="outline" size="sm" onClick={() => { setInput(sample); run(sample) }}><FileText />Sample</Button><Button type="button" variant="outline" size="sm" onClick={() => { setInput(''); setOutput(''); setError(''); setHasRun(false) }} disabled={!input && !output}><Eraser />Clear</Button></div><div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2"><section className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-r lg:border-b-0"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">JSON input</span><TextStats value={input} /></div><CodeEditor bare value={input} onChange={(value) => { setInput(value); setHasRun(false); setError('') }} placeholder="Paste JSON here…" wrap ariaLabel="JSON input" /></section><section className="flex min-h-0 min-w-0 flex-col"><div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">Go structs</span><CopyButton value={hasRun ? output : ''} /></div><CodeEditor bare value={hasRun ? output : ''} readOnly placeholder="Generated Go structs will appear here." wrap ariaLabel="Go structs" language="go" /></section></div></div><JsonPrecisionWarning input={input} /><ToolStatus state={error ? 'invalid' : hasRun ? 'valid' : 'idle'} message={error || undefined} validLabel="Go structs generated successfully" />{dialog}</div>
}
