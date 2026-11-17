import { Eraser } from 'lucide-react'
import { useState } from 'react'

import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { Button } from '@/components/ui/button'
import {
  GAME_TICKS_PER_REDSTONE_TICK,
  REFERENCE_SECONDS,
  REFERENCE_TICKS,
  TICKS_PER_SECOND,
  breakdownFromSeconds,
  breakdownFromTicks,
  formatTickNumber,
  parseTickInput,
  type TickBreakdown,
} from '@/features/minecraft/ticks'

type Field = 'ticks' | 'seconds' | 'minutes'

const fieldClass = 'h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-base text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive'
const cellClass = 'px-3 py-2 text-right tabular-nums'
const headClass = 'px-3 py-2 text-right text-xs font-medium text-muted-foreground'

function breakdownFor(field: Field, value: number): TickBreakdown {
  if (field === 'ticks') return breakdownFromTicks(value)
  return breakdownFromSeconds(field === 'seconds' ? value : value * 60)
}

function ReferenceTable({ caption, firstHeader, rows }: { caption: string; firstHeader: string; rows: { label: string; breakdown: TickBreakdown }[] }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card shadow-sm">
      <h2 className="border-b border-border px-4 py-3 text-sm font-medium">{caption}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{firstHeader}</th>
              <th scope="col" className={headClass}>Game ticks</th>
              <th scope="col" className={headClass}>Redstone ticks</th>
              <th scope="col" className={headClass}>Seconds</th>
              <th scope="col" className={headClass}>Minutes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ label, breakdown }) => (
              <tr key={label}>
                <th scope="row" className="px-3 py-2 text-left font-medium">{label}</th>
                <td className={cellClass}>{formatTickNumber(breakdown.ticks)}</td>
                <td className={cellClass}>{formatTickNumber(breakdown.redstoneTicks)}</td>
                <td className={cellClass}>{formatTickNumber(breakdown.seconds)}</td>
                <td className={cellClass}>{formatTickNumber(breakdown.minutes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function MinecraftTickCalculatorPage() {
  // The field the user typed in is the source of truth; the others are derived from it.
  const [source, setSource] = useState<{ field: Field; text: string }>({ field: 'seconds', text: '10' })
  const parsed = parseTickInput(source.text)
  const breakdown = parsed === null ? null : breakdownFor(source.field, parsed)

  const valueFor = (field: Field) => {
    if (field === source.field) return source.text
    if (!breakdown) return ''
    return formatTickNumber(breakdown[field]).replace(/,/g, '')
  }

  const fields: { field: Field; label: string }[] = [
    { field: 'ticks', label: 'Game ticks' },
    { field: 'seconds', label: 'Seconds' },
    { field: 'minutes', label: 'Minutes' },
  ]

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <ToolPageHeader
        title="Minecraft Tick Calculator"
        description={`Convert Minecraft game ticks to seconds and minutes and back. The game runs at ${TICKS_PER_SECOND} ticks per second; one redstone tick is ${GAME_TICKS_PER_REDSTONE_TICK} game ticks.`}
        showRememberInput={false}
      />

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {fields.map(({ field, label }) => (
            <label key={field} className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
              {label}
              <input
                inputMode="decimal"
                value={valueFor(field)}
                onChange={(event) => setSource({ field, text: event.target.value })}
                aria-invalid={field === source.field && source.text.trim() !== '' && parsed === null}
                className={fieldClass}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {breakdown
              ? <>Redstone ticks: <span className="font-medium text-foreground tabular-nums">{formatTickNumber(breakdown.redstoneTicks)}</span> (repeater delay steps)</>
              : source.text.trim() === '' ? 'Type a value in any field.' : 'Enter a number of 0 or more.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={breakdown ? `${formatTickNumber(breakdown.ticks)} ticks = ${formatTickNumber(breakdown.seconds)} s = ${formatTickNumber(breakdown.minutes)} min` : ''} />
            <Button type="button" variant="outline" size="sm" onClick={() => setSource({ field: source.field, text: '' })} disabled={!source.text}><Eraser />Clear</Button>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ReferenceTable caption="Ticks → time" firstHeader="Ticks" rows={REFERENCE_TICKS.map((ticks) => ({ label: formatTickNumber(ticks), breakdown: breakdownFromTicks(ticks) }))} />
        <ReferenceTable caption="Time → ticks" firstHeader="Time" rows={REFERENCE_SECONDS.map((row) => ({ label: row.label, breakdown: breakdownFromSeconds(row.seconds) }))} />
      </div>
    </div>
  )
}
