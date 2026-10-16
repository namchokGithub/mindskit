import { ArrowDownUp, CalendarClock, Equal, Eraser, Palette } from 'lucide-react'
import { useState } from 'react'

import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { convertColor, convertNumberBase, formatDate } from '@/features/value-converters'
import { ColorPaletteBuilder } from '@/pages/color-palette-builder'

const fieldClass = 'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'

function Output({ value, label }: { value: string; label: string }) {
  return <div className="shrink-0 space-y-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">{label}</span><CopyButton value={value} /></div><textarea value={value} readOnly aria-label={label} placeholder="Your converted result will appear here." className="block h-48 w-full resize-y rounded-lg border border-input bg-muted/30 p-3 font-mono text-sm text-foreground outline-none" /></div>
}

export function NumberBaseConverterPage() {
  const [input, setInput] = useState('')
  const [fromBase, setFromBase] = useState('10')
  const [toBase, setToBase] = useState('16')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const convert = () => { try { setOutput(convertNumberBase(input, Number(fromBase), Number(toBase))); setError('') } catch (cause) { setOutput(''); setError(cause instanceof Error ? cause.message : 'Unable to convert this number.') } }
  const reset = () => { setInput(''); setFromBase('10'); setToBase('16'); setOutput(''); setError('') }
  const swap = () => { if (output) setInput(output); setOutput(''); setError(''); setFromBase(toBase); setToBase(fromBase) }

  return <div className="flex min-h-0 flex-col gap-4 lg:h-full"><ToolPageHeader title="Number Base Converter" description="Convert a number from any supported base to another." /><div className="mx-auto w-full max-w-xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"><p className="mb-4 text-sm font-medium text-foreground">Convert number from any base to any base:</p><div className="space-y-4"><label className="block space-y-1.5 text-sm font-medium text-foreground">Enter number<input value={input} onChange={(event) => { setInput(event.target.value); setOutput(''); setError('') }} className={`${fieldClass} block h-11 w-full text-base`} placeholder="e.g. 255 or FF" autoFocus /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1.5 text-sm font-medium text-foreground">From Base<select value={fromBase} onChange={(event) => { setFromBase(event.target.value); setOutput('') }} className={`${fieldClass} block w-full text-base`}><option value="2">2 (binary)</option><option value="8">8 (octal)</option><option value="10">10 (decimal)</option><option value="16">16 (hexadecimal)</option></select></label><label className="block space-y-1.5 text-sm font-medium text-foreground">To base<select value={toBase} onChange={(event) => { setToBase(event.target.value); setOutput('') }} className={`${fieldClass} block w-full text-base`}><option value="2">2 (binary)</option><option value="8">8 (octal)</option><option value="10">10 (decimal)</option><option value="16">16 (hexadecimal)</option></select></label></div><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button onClick={convert} disabled={!input.trim()} className="w-full bg-emerald-700 text-white hover:bg-emerald-800 sm:w-auto"><Equal />Convert</Button><Button variant="secondary" onClick={reset} className="w-full sm:w-auto"><Eraser />Reset</Button><Button variant="secondary" onClick={swap} className="w-full sm:w-auto"><ArrowDownUp />Swap</Button></div><label className="block space-y-1.5 text-sm font-medium text-foreground">Result number<textarea value={output} readOnly aria-label="Result number" placeholder="Converted number will appear here." className="block min-h-24 w-full resize-y rounded-lg border border-input bg-muted/30 p-3 font-mono text-sm text-foreground outline-none" /></label></div></div><div className="mx-auto w-full max-w-xl"><ToolStatus state={error ? 'invalid' : output ? 'valid' : 'idle'} message={error} validLabel="Number converted successfully" /></div></div>
}

export function ColorConverterPage() {
  const [input, setInput] = useState('#7C3AED')
  const [output, setOutput] = useState('')
  const [preview, setPreview] = useState('#7C3AED')
  const [error, setError] = useState('')
  const convert = () => { try { const result = convertColor(input); setOutput(result.output); setPreview(result.cssValue); setError('') } catch (cause) { setOutput(''); setError(cause instanceof Error ? cause.message : 'Unable to convert this color.') } }
  return <div className="flex min-h-0 flex-col gap-4"><ToolPageHeader title="Color Converter" description="Convert colors between HEX, RGB(A), and HSL(A), or extract and build a palette." /><ColorPaletteBuilder converter={<div className="flex w-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"><p className="mb-4 text-sm font-medium text-foreground">Convert a color between common web formats:</p><div className="space-y-4"><label className="block space-y-1.5 text-sm font-medium text-foreground">Color value<input value={input} onChange={(event) => { setInput(event.target.value); setOutput(''); setError('') }} className={`${fieldClass} block h-11 w-full text-base`} placeholder="#7C3AED, rgb(...), or hsl(...)" /></label><div className="grid grid-cols-[1fr_auto] items-end gap-3"><label className="block space-y-1.5 text-sm font-medium text-foreground">Color picker<input aria-label="Color picker" type="color" value={preview.slice(0, 7)} onChange={(event) => { setInput(event.target.value); setOutput(''); setPreview(event.target.value); setError('') }} className="block h-11 w-full cursor-pointer rounded-lg border border-input bg-transparent p-1" /></label><div className="h-11 w-16 rounded-lg border border-border sm:w-20" style={{ backgroundColor: preview }} aria-label="Color preview" /></div><div className="flex flex-col gap-2 sm:flex-row"><Button onClick={convert} className="w-full sm:w-auto"><Palette />Convert</Button><Button variant="secondary" onClick={() => { setInput('#7C3AED'); setOutput(''); setPreview('#7C3AED'); setError('') }} className="w-full sm:w-auto"><Eraser />Clear</Button></div></div><ToolStatus state={error ? 'invalid' : output ? 'valid' : 'idle'} message={error} validLabel="Color converted successfully" /><Output value={output} label="Color values" /></div>} /></div>
}

export function DateFormatterPage() {
  const [input, setInput] = useState('2024-01-01T00:00:00.000Z')
  const [timeZone, setTimeZone] = useState('browser')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const convert = () => { try { setOutput(formatDate(input, timeZone)); setError('') } catch (cause) { setOutput(''); setError(cause instanceof Error ? cause.message : 'Unable to format this date.') } }
  return <div className="flex min-h-0 flex-col gap-4 lg:h-full"><ToolPageHeader title="Date Formatter" description="Format dates, ISO date-times, and Unix timestamps in common formats." /><div className="mx-auto flex w-full max-w-xl flex-col rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"><p className="mb-4 text-sm font-medium text-foreground">Format a date in common date-time formats:</p><div className="space-y-4"><label className="block space-y-1.5 text-sm font-medium text-foreground">Date or timestamp<input value={input} onChange={(event) => { setInput(event.target.value); setOutput(''); setError('') }} className={`${fieldClass} block h-11 w-full text-base`} placeholder="ISO date-time or timestamp" /></label><label className="block space-y-1.5 text-sm font-medium text-foreground">Time zone<select value={timeZone} onChange={(event) => { setTimeZone(event.target.value); setOutput('') }} className={`${fieldClass} block h-11 w-full text-base`}><option value="browser">Browser default</option><option value="UTC">UTC</option><option value="Asia/Bangkok">Asia/Bangkok</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option><option value="Asia/Tokyo">Asia/Tokyo</option></select></label><div className="flex flex-col gap-2 sm:flex-row"><Button onClick={convert} className="w-full sm:w-auto"><CalendarClock />Format</Button><Button variant="secondary" onClick={() => { setInput('2024-01-01T00:00:00.000Z'); setOutput(''); setError('') }} className="w-full sm:w-auto"><Eraser />Clear</Button></div></div><ToolStatus state={error ? 'invalid' : output ? 'valid' : 'idle'} message={error} validLabel="Date formatted successfully" /><Output value={output} label="Formatted date" /></div></div>
}
