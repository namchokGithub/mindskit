import { Binary, ChevronDown, Clock, FileCode, Link2, Shuffle, TimerReset } from 'lucide-react'
import { useState } from 'react'

import { TextTransformPage } from '@/components/tool/text-transform-page'
import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { convertBase64, convertHtml, convertTimestamp, convertUrl, currentUnixTimestamp, quickOperations } from '@/features/quick-tools'

export function Base64Page() {
  return <TextTransformPage title="Base64" description="Encode or decode Base64 text entirely in your browser." actionLabel="Convert" actionIcon={Binary} storageKey="base64" inputPlaceholder="Paste text or Base64 here…" sample="Hello, MindsKit!" process={convertBase64} operations={[...quickOperations.base64]} />
}

export function UrlEncodeDecodePage() {
  return <TextTransformPage title="URL Encode / Decode" description="Encode or decode a URL component safely in your browser." actionLabel="Convert" actionIcon={Link2} storageKey="url-encode-decode" inputPlaceholder="Paste text or an encoded URL component here…" sample="hello world?lang=en" process={convertUrl} operations={[...quickOperations.url]} />
}

export function HtmlEncodeDecodePage() {
  return <TextTransformPage title="HTML Encode / Decode" description="Convert text to or from HTML entities in your browser." actionLabel="Convert" actionIcon={FileCode} storageKey="html-encode-decode" inputPlaceholder="Paste text or HTML entities here…" sample={'<p>Hello & welcome</p>'} process={convertHtml} operations={[...quickOperations.html]} />
}

export function UnixTimestampPage() {
  return <TextTransformPage title="Unix Timestamp" description="Convert between Unix timestamps and ISO date/time values." actionLabel="Convert" actionIcon={TimerReset} storageKey="unix-timestamp" inputPlaceholder="Enter a timestamp or date…" sample="1704067200" samples={{ 'to-date': '1704067200', 'to-timestamp': '2024-01-01T00:00:00.000Z' }} process={convertTimestamp} operations={[...quickOperations.timestamp]} timeZone inputAction={{ label: 'Now', icon: Clock, value: currentUnixTimestamp }} />
}

export function UuidPage() {
  const [count, setCount] = useState('1')
  const [output, setOutput] = useState('')
  const generate = () => {
    const total = Math.max(1, Math.min(200, Number(count) || 1))
    setOutput(Array.from({ length: total }, () => crypto.randomUUID()).join('\n'))
  }

  return <div className="flex min-h-0 flex-col gap-4 lg:h-full"><ToolPageHeader title="UUID" description="Generate one or more random UUID v4 values in your browser." /><div className="flex shrink-0 flex-wrap items-end gap-2"><div className="flex items-center gap-1 rounded-lg border border-input p-1"><Button type="button" size="sm" variant={count === '1' ? 'secondary' : 'ghost'} onClick={() => setCount('1')}>1</Button><Button type="button" size="sm" variant={count === '5' ? 'secondary' : 'ghost'} onClick={() => setCount('5')}>5</Button><Button type="button" size="sm" variant={count === '10' ? 'secondary' : 'ghost'} onClick={() => setCount('10')}>10</Button></div><label className="space-y-1 text-xs text-muted-foreground">Custom (max 200)<input type="number" min="1" max="200" value={count} onChange={(event) => setCount(event.target.value)} className="mt-1 block h-8 w-28 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label><Button onClick={generate}><Shuffle />Generate</Button></div><div className="flex min-h-65 flex-1 flex-col gap-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">Result</span><CopyButton value={output} /></div><CodeEditor value={output} readOnly placeholder="Your generated UUIDs will appear here." wrap ariaLabel="Result" language="text" /></div><ToolStatus state={output ? 'valid' : 'idle'} validLabel="UUIDs generated successfully" /></div>
}

export function RandomStringPage() {
  const [count, setCount] = useState('1')
  const [length, setLength] = useState('16')
  const [lowercase, setLowercase] = useState(true)
  const [uppercase, setUppercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(false)
  const [useCustomSet, setUseCustomSet] = useState(false)
  const [customSet, setCustomSet] = useState('')
  const [excludedCharacters, setExcludedCharacters] = useState('O0Il1')
  const [unique, setUnique] = useState(false)
  const [separator, setSeparator] = useState('\\n')
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [output, setOutput] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [error, setError] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const fieldClass = 'mt-1 block h-8 w-24 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'
  const generate = () => {
    let alphabet = useCustomSet ? customSet : `${lowercase ? 'abcdefghijklmnopqrstuvwxyz' : ''}${uppercase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : ''}${numbers ? '0123456789' : ''}${symbols ? '!@#$%^&*()-_=+[]{}' : ''}`
    alphabet = [...alphabet].filter((character) => !excludedCharacters.includes(character)).join('')
    const total = Math.max(1, Math.min(200, Number(count) || 1))
    const size = Math.max(1, Math.min(256, Number(length) || 16))
    if (!alphabet) {
      setResults([])
      setOutput('')
      setError('Choose at least one allowed character.')
      return
    }
    const capacity = size > 6 ? Infinity : alphabet.length ** size
    if (unique && total > capacity) {
      setResults([])
      setOutput('')
      setError('Unable to create that many unique strings with these settings.')
      return
    }
    const randomString = () => Array.from({ length: size }, () => {
      const values = new Uint32Array(1)
      crypto.getRandomValues(values)
      return alphabet[values[0] % alphabet.length]
    }).join('')
    const results = unique
      ? (() => {
          const values = new Set<string>()
          while (values.size < total) values.add(randomString())
          return [...values]
        })()
      : Array.from({ length: total }, randomString)
    const decorated = results.map((value) => `${prefix}${value}${suffix}`)
    setError('')
    setResults(decorated)
    setOutput(decorated.join(separator === '\\n' ? '\n' : separator))
  }

  return <div className="flex min-h-0 flex-col gap-4 lg:h-full"><ToolPageHeader title="Random String" description="Generate one or more random strings in your browser." /><div className="tool-options-card shrink-0 rounded-lg border border-border p-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs text-muted-foreground">Number of strings (max 200)<input type="number" min="1" max="200" value={count} onChange={(event) => setCount(event.target.value)} className={fieldClass} /></label><label className="text-xs text-muted-foreground">Length per string (max 256)<input type="number" min="1" max="256" value={length} onChange={(event) => setLength(event.target.value)} className={fieldClass} /></label><div className="space-y-2 text-xs text-muted-foreground"><span className="block">Allowed characters</span><label className="flex items-center gap-2"><Checkbox checked={lowercase} onCheckedChange={(value) => setLowercase(value === true)} disabled={useCustomSet} />Lowercase (a-z)</label><label className="flex items-center gap-2"><Checkbox checked={uppercase} onCheckedChange={(value) => setUppercase(value === true)} disabled={useCustomSet} />Uppercase (A-Z)</label><label className="flex items-center gap-2"><Checkbox checked={numbers} onCheckedChange={(value) => setNumbers(value === true)} disabled={useCustomSet} />Numbers (0-9)</label><label className="flex items-center gap-2"><Checkbox checked={symbols} onCheckedChange={(value) => setSymbols(value === true)} disabled={useCustomSet} />Symbols</label></div></div><Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-4 border-t border-border pt-3"><CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium text-foreground"><span>Advanced settings</span><ChevronDown className={`size-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} /></CollapsibleTrigger><CollapsibleContent className="pt-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs text-muted-foreground">Separator (use \n for new line)<input value={separator} onChange={(event) => setSeparator(event.target.value)} className={fieldClass} /></label><label className="text-xs text-muted-foreground">Prefix<input value={prefix} onChange={(event) => setPrefix(event.target.value)} className={fieldClass} /></label><label className="text-xs text-muted-foreground">Suffix<input value={suffix} onChange={(event) => setSuffix(event.target.value)} className={fieldClass} /></label><label className="text-xs text-muted-foreground">Exclude characters<input value={excludedCharacters} onChange={(event) => setExcludedCharacters(event.target.value)} placeholder="e.g. O0Il1" className={`${fieldClass} w-full`} /></label><div className="space-y-2 text-xs text-muted-foreground"><span className="block">Custom character set</span><label className="flex items-center gap-2"><Checkbox checked={useCustomSet} onCheckedChange={(value) => setUseCustomSet(value === true)} />Use custom characters</label><input value={customSet} disabled={!useCustomSet} onChange={(event) => setCustomSet(event.target.value)} placeholder="e.g. ABC123" className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50" /></div><div className="space-y-2 text-xs text-muted-foreground"><span className="block">Duplicates</span><label className="flex items-center gap-2"><Checkbox checked={unique} onCheckedChange={(value) => setUnique(value === true)} />Make every string unique</label></div></div></CollapsibleContent></Collapsible><div className="mt-4"><Button onClick={generate} disabled={useCustomSet ? !customSet : !lowercase && !uppercase && !numbers && !symbols}><Shuffle />Generate</Button></div></div><div className="flex min-h-65 flex-1 flex-col gap-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">Result</span><CopyButton value={output} /></div>{error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : results.length > 1 && separator === '\\n' ? <div className="min-h-[260px] overflow-auto rounded-lg border border-input bg-muted/30 p-2">{results.map((value, index) => <div key={`${value}-${index}`} className="flex items-center gap-2 border-b border-border px-2 py-1.5 last:border-0"><span className="w-7 text-right font-mono text-xs text-muted-foreground">{index + 1}</span><code className="min-w-0 flex-1 break-all font-mono text-sm">{value}</code><CopyButton value={value} /></div>)}</div> : <CodeEditor value={output} readOnly placeholder="Your generated string will appear here." wrap ariaLabel="Result" language="text" />}</div><ToolStatus state={error ? 'invalid' : output ? 'valid' : 'idle'} message={error} validLabel="Random strings generated successfully" /></div>
}
