import { RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { clampPasswordLength, generatePassword, passwordLengthRanges, type PasswordMode, type PasswordOptions, type PasswordResult } from '@/features/password-generator'
import { cn } from '@/lib/utils'

const defaultOptions: PasswordOptions = {
  mode: 'random', length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true,
  symbolSet: '!@#$%^&*()_+-=[]{}:?,./', excludedCharacters: '', excludeAmbiguous: true,
}

const modeLabels: Record<PasswordMode, string> = { random: 'Random', memorable: 'Memorable', pin: 'PIN' }
const scoreStyles = ['bg-destructive', 'bg-warning', 'bg-warning', 'bg-primary', 'bg-success']

export function StrongPasswordGeneratorPage() {
  const [options, setOptions] = useState(defaultOptions)
  const [result, setResult] = useState<PasswordResult>(() => generatePassword(defaultOptions))
  const [error, setError] = useState('')

  const update = <Key extends keyof PasswordOptions>(key: Key, value: PasswordOptions[Key]) => {
    setOptions((previous) => ({ ...previous, [key]: value }))
    setError('')
  }

  const changeMode = (mode: PasswordMode) => {
    setOptions((previous) => ({ ...previous, mode, length: clampPasswordLength(mode, previous.length) }))
    setError('')
  }

  const generate = () => {
    try {
      setResult(generatePassword(options))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to generate a password.')
    }
  }

  const inputLabel = options.mode === 'memorable' ? 'Number of words' : options.mode === 'pin' ? 'PIN length' : 'Password length'
  const { min: minLength, max: maxLength } = passwordLengthRanges[options.mode]

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title="Strong Password Generator" description="Create secure passwords locally with cryptographically secure randomness. Generated passwords are never saved." showRememberInput={false} />
      <div className="mx-auto w-full max-w-4xl rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="rounded-xl border border-input bg-muted/20 p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all text-center font-mono text-lg font-semibold tracking-wide text-foreground sm:text-xl">{result.value}</code><CopyButton value={result.value} /></div>
          <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-all', scoreStyles[result.score])} style={{ width: `${(result.score + 1) * 20}%` }} /></div><div className="mt-1 flex items-center justify-between text-xs"><span className="text-muted-foreground">Estimated entropy: {Math.round(result.entropy)} bits</span><span className={cn('font-semibold', result.score >= 4 ? 'text-success' : result.score >= 3 ? 'text-primary' : 'text-warning')}>{result.label}</span></div></div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-1 rounded-lg border border-input p-1"><ModeButton mode="random" selected={options.mode} onClick={() => changeMode('random')} /><ModeButton mode="memorable" selected={options.mode} onClick={() => changeMode('memorable')} /><ModeButton mode="pin" selected={options.mode} onClick={() => changeMode('pin')} /></div>

        <div className="mt-6"><label className="flex items-center justify-between gap-3 text-sm font-medium text-foreground"><span>{inputLabel}: {options.length}</span><span className="text-xs font-normal text-muted-foreground">{minLength}–{maxLength}</span></label><input type="range" min={minLength} max={maxLength} value={options.length} onChange={(event) => update('length', Number(event.target.value))} className="mt-3 w-full accent-primary" /></div>

        {options.mode !== 'pin' && <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="space-y-3"><Option checked={options.uppercase} onChange={(value) => update('uppercase', value)} label="Include uppercase (A–Z)" /><Option checked={options.lowercase} onChange={(value) => update('lowercase', value)} label="Include lowercase (a–z)" /><Option checked={options.numbers} onChange={(value) => update('numbers', value)} label="Include numbers (0–9)" /></div><div className="space-y-3"><Option checked={options.symbols} onChange={(value) => update('symbols', value)} label="Include symbols" /><input value={options.symbolSet} disabled={!options.symbols} onChange={(event) => update('symbolSet', event.target.value)} aria-label="Symbols to include" className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:opacity-50" /><Option checked={options.excludeAmbiguous} onChange={(value) => update('excludeAmbiguous', value)} label="Exclude ambiguous characters" /></div></div>}

        <label className="mt-5 block text-sm font-medium text-foreground">Exclude specific characters<input value={options.excludedCharacters} onChange={(event) => update('excludedCharacters', event.target.value)} placeholder="e.g. O0Il1" className="mt-1.5 block h-10 w-full rounded-lg border border-input bg-transparent px-3 font-mono text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" /></label>
        {options.mode === 'memorable' && <p className="mt-3 text-sm text-muted-foreground">Memorable mode joins random words{options.symbols ? ' with hyphens' : ''}{options.numbers ? ' and adds a three-digit suffix' : ''}.</p>}
        {options.mode === 'pin' && <p className="mt-3 text-sm text-muted-foreground">PIN mode always uses digits only. Keep it short and use it only where a PIN is appropriate.</p>}
        <Button type="button" className="mt-6 w-full" onClick={generate}><RefreshCw />Generate new password</Button>
      </div>
      <div className="mx-auto flex w-full max-w-4xl items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary-hover"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span>Passwords are generated entirely in your browser with <code>crypto.getRandomValues</code>. Nothing is sent or stored.</span></div>
      <ToolStatus state={error ? 'invalid' : 'idle'} message={error} />
    </div>
  )
}

function ModeButton({ mode, selected, onClick }: { mode: PasswordMode; selected: PasswordMode; onClick: () => void }) {
  return <Button type="button" size="sm" variant={mode === selected ? 'secondary' : 'ghost'} aria-pressed={mode === selected} onClick={onClick}>{modeLabels[mode]}</Button>
}

function Option({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex items-center gap-2 text-sm text-foreground"><Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />{label}</label>
}
