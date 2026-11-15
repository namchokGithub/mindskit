/** Minecraft runs at 20 game ticks per second; a redstone tick (repeater delay step) is 2 game ticks. */
export const TICKS_PER_SECOND = 20
export const GAME_TICKS_PER_REDSTONE_TICK = 2
/** One in-game day is 24,000 ticks (20 real minutes at 20 TPS). */
export const TICKS_PER_DAY = 24_000

export const REFERENCE_TICKS = [1, 2, 3, 5, 10, 20, 50, 100] as const

export const REFERENCE_SECONDS = [
  { label: '1 second', seconds: 1 },
  { label: '5 seconds', seconds: 5 },
  { label: '10 seconds', seconds: 10 },
  { label: '30 seconds', seconds: 30 },
  { label: '1 minute', seconds: 60 },
  { label: '2 minutes', seconds: 120 },
  { label: '5 minutes', seconds: 300 },
  { label: '10 minutes', seconds: 600 },
  { label: '20 minutes (1 Minecraft day)', seconds: 1200 },
] as const

export interface TickBreakdown {
  ticks: number
  redstoneTicks: number
  seconds: number
  minutes: number
}

export function ticksToSeconds(ticks: number): number {
  return ticks / TICKS_PER_SECOND
}

export function secondsToTicks(seconds: number): number {
  return seconds * TICKS_PER_SECOND
}

export function breakdownFromTicks(ticks: number): TickBreakdown {
  const seconds = ticksToSeconds(ticks)
  return { ticks, redstoneTicks: ticks / GAME_TICKS_PER_REDSTONE_TICK, seconds, minutes: seconds / 60 }
}

export function breakdownFromSeconds(seconds: number): TickBreakdown {
  return breakdownFromTicks(secondsToTicks(seconds))
}

/** Rounds away floating-point noise and formats with thousands separators, e.g. 1200 → "1,200", 0.05 → "0.05". */
export function formatTickNumber(value: number, maximumFractionDigits = 4): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(Number(value.toFixed(maximumFractionDigits)))
}

/** Parses a non-negative number typed by the user ("1,200", " 2.5 "); returns null when invalid. */
export function parseTickInput(input: string): number | null {
  const value = Number(input.replace(/,/g, '').trim())
  return input.trim() !== '' && Number.isFinite(value) && value >= 0 ? value : null
}
