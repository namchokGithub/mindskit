import { Check, Eraser, FileText, Search, WrapText, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { TextStats } from '@/components/tool/text-stats'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useLargeInputConfirmation } from '@/hooks/use-large-input-confirmation'
import { useSaveLocally } from '@/hooks/use-save-locally'
import { cn } from '@/lib/utils'
import type { TextOperation } from '@/features/text-tools/text'

type TextTransformPageConfig = {
  title: string
  description: string
  actionLabel: string
  actionIcon: LucideIcon
  storageKey: string
  inputPlaceholder: string
  sample: string
  samples?: Record<string, string>
  process: (input: string, option: string, prefix?: string, suffix?: string, timeZone?: string) => string
  operations?: TextOperation[]
  delimiter?: { label: string; placeholder: string; defaultValue: string }
  affixes?: boolean
  timeZone?: boolean
  language?: 'json' | 'xml' | 'markdown' | 'text'
  outputPreview?: (output: string) => ReactNode
  inputAction?: { label: string; icon: LucideIcon; value: () => string }
}

export function TextTransformPage(config: TextTransformPageConfig) {
  const { enabled: saveLocally } = useSaveLocally()
  const [input, setInput] = usePersistedInput(config.storageKey, saveLocally)
  const [output, setOutput] = useState('')
  const [wrap, setWrap] = useState(false)
  const [option, setOption] = useState(config.operations?.[0]?.value ?? config.delimiter?.defaultValue ?? '')
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [timeZone, setTimeZone] = useState('browser')
  const [hasRun, setHasRun] = useState(false)
  const { confirm, dialog } = useLargeInputConfirmation()
  const ActionIcon = config.actionIcon
  const InputActionIcon = config.inputAction?.icon

  const run = (nextInput = input, nextOption = option) => {
    setOutput(config.process(nextInput, nextOption, prefix, suffix, timeZone))
    setHasRun(true)
  }

  const handleInputChange = (next: string) => {
    setInput(next)
    setHasRun(false)
  }

  const handleOptionChange = (next: string) => {
    setOption(next)
    if (hasRun) run(input, next)
  }

  const handlePrefixChange = (value: string) => {
    setPrefix(value)
    if (hasRun) setOutput(config.process(input, option, value, suffix, timeZone))
  }

  const handleSuffixChange = (value: string) => {
    setSuffix(value)
    if (hasRun) setOutput(config.process(input, option, prefix, value, timeZone))
  }

  const handleTimeZoneChange = (value: string) => {
    setTimeZone(value)
    if (hasRun) setOutput(config.process(input, option, prefix, suffix, value))
  }

  const handleSample = () => {
    const sample = config.samples?.[option] ?? config.sample
    setInput(sample)
    run(sample)
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
    setHasRun(false)
  }

  const handleInputAction = () => {
    const nextInput = config.inputAction?.value()
    if (!nextInput) return
    setInput(nextInput)
    run(nextInput)
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title={config.title} description={config.description} />

      <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2">
          <Button type="button" size="sm" onClick={() => confirm(input, () => run())} disabled={!input}>
            <ActionIcon />
            {config.actionLabel}
          </Button>
          {config.inputAction && InputActionIcon && <Button type="button" size="sm" variant="outline" onClick={handleInputAction}><InputActionIcon />{config.inputAction.label}</Button>}
          {config.operations && (
            <Select value={option} onValueChange={handleOptionChange}>
              <SelectTrigger size="sm" className="w-auto min-w-[8rem]"><SelectValue /></SelectTrigger>
              <SelectContent>{config.operations.map((operation) => <SelectItem key={operation.value} value={operation.value}>{operation.label}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {config.delimiter && (
            <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0">{config.delimiter.label}</span>
              <input value={option} onChange={(event) => handleOptionChange(event.target.value)} placeholder={config.delimiter.placeholder} className="h-8 w-40 min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
            </label>
          )}
          {config.affixes && option === 'affix' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Prefix<input value={prefix} onChange={(event) => handlePrefixChange(event.target.value)} placeholder="Optional prefix" className="h-8 w-32 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Suffix<input value={suffix} onChange={(event) => handleSuffixChange(event.target.value)} placeholder="Optional suffix" className="h-8 w-32 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label>
            </div>
          )}
          {config.timeZone && option === 'to-date' && <TimeZoneSelect value={timeZone} onChange={handleTimeZoneChange} />}
          <Button type="button" variant="outline" size="sm" onClick={handleSample}><FileText />Sample</Button>
          <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={!input}><Eraser />Clear</Button>
          <Button type="button" variant="outline" size="sm" aria-pressed={wrap} onClick={() => setWrap((value) => !value)} className={cn(wrap && 'bg-accent text-accent-foreground')}><WrapText />Wrap</Button>
        </div>

        <div className="tool-workspace-grid grid min-h-0 grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="flex min-h-65 min-w-0 flex-col bg-editor/40 lg:min-h-0">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">Input</span><TextStats value={input} /></div>
            <CodeEditor bare value={input} onChange={handleInputChange} placeholder={config.inputPlaceholder} wrap={wrap} ariaLabel="Input" language={config.language ?? 'text'} fitContent />
          </div>

          <div className="flex min-h-65 min-w-0 flex-col bg-muted/20 lg:min-h-0">
            <div className="flex items-center justify-between px-3 py-1.5"><span className="text-sm font-medium text-muted-foreground">Output</span><CopyButton value={hasRun ? output : ''} /></div>
            {config.outputPreview ? (
              <div className="min-h-[12rem] max-h-[32rem] w-full overflow-auto bg-muted/30 p-4">
                {hasRun ? config.outputPreview(output) : <span className="text-sm text-muted-foreground">Result will appear here.</span>}
              </div>
            ) : (
              <CodeEditor bare value={hasRun ? output : ''} readOnly placeholder="Result will appear here." wrap={wrap} ariaLabel="Output" language={config.language ?? 'text'} fitContent />
            )}
          </div>
        </div>
      </div>
      <ToolStatus state={hasRun ? 'valid' : 'idle'} validLabel={`${config.actionLabel} completed`} />
      {dialog}
    </div>
  )
}

const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Browser default'
const availableTimeZones = ['UTC', ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])]

function TimeZoneSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const timeZones = availableTimeZones.filter((timeZone) => timeZone !== browserTimeZone && timeZone.toLowerCase().includes(normalizedQuery))
  const label = value === 'browser' ? `Browser default (${browserTimeZone})` : value

  const choose = (timeZone: string) => {
    onChange(timeZone)
    setOpen(false)
    setQuery('')
  }

  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" size="sm" variant="outline" className="w-52 justify-between font-normal" aria-label="Select output timezone">{label}</Button></PopoverTrigger><PopoverContent align="start" className="w-72 p-2"><label className="relative block"><Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted-foreground" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search timezone…" className="h-8 w-full rounded-md border border-input bg-transparent pr-2 pl-8 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label><div className="mt-2 max-h-60 overflow-y-auto"><TimeZoneOption selected={value === 'browser'} onClick={() => choose('browser')}>Browser default ({browserTimeZone})</TimeZoneOption>{timeZones.map((timeZone) => <TimeZoneOption key={timeZone} selected={value === timeZone} onClick={() => choose(timeZone)}>{timeZone}</TimeZoneOption>)}{timeZones.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No matching timezone.</p>}</div></PopoverContent></Popover>
}

function TimeZoneOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"><span className="truncate">{children}</span>{selected && <Check className="ml-2 size-4 shrink-0 text-primary" />}</button>
}
