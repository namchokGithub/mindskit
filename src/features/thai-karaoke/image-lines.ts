import { convertThaiKaraoke } from './converter.ts'
import { formatKaraoke, type KaraokeFormatOptions } from './formatter.ts'
import type { KaraokeTextLine } from './image-model.ts'

/** One editable line pair. `karaoke: null` means the reading is generated from the Thai text. */
export interface KaraokeImageLine {
  id: number
  thai: string
  karaoke: string | null
}

export const MAX_KARAOKE_IMAGE_LINES = 20

/** Readings for every line: typed readings as-is, the rest converted with `format`. */
export function resolveKaraokeLines(lines: readonly KaraokeImageLine[], format: KaraokeFormatOptions): KaraokeTextLine[] {
  return lines.map((line) => ({
    thai: line.thai,
    karaoke: line.karaoke ?? (line.thai.trim() ? formatKaraoke(convertThaiKaraoke(line.thai.replace(/\s*\n\s*/g, ' ')), format) : ''),
  }))
}

/** Stored shape for Remember input: only the text, never the image. */
export function serializeKaraokeLines(lines: readonly KaraokeImageLine[]): string {
  return JSON.stringify(lines.map(({ thai, karaoke }) => ({ thai, karaoke })))
}

/** Restores stored lines; anything malformed is skipped. */
export function parseKaraokeLines(stored: string): Array<Pick<KaraokeImageLine, 'thai' | 'karaoke'>> {
  if (!stored) return []
  try {
    const value: unknown = JSON.parse(stored)
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (item): item is { thai: string; karaoke: string | null } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { thai?: unknown }).thai === 'string' &&
          ((item as { karaoke?: unknown }).karaoke === null || typeof (item as { karaoke?: unknown }).karaoke === 'string'),
      )
      .slice(0, MAX_KARAOKE_IMAGE_LINES)
      .map(({ thai, karaoke }) => ({ thai, karaoke }))
  } catch {
    return []
  }
}

/**
 * Pairs the Converter's Thai input with its formatted output, line by line, dropping empty lines.
 * The formatted reading is kept as typed text so the Converter's style and word edits carry over.
 */
export function pairConverterLines(input: string, output: string): Array<{ thai: string; karaoke: string }> {
  const thaiLines = input.replace(/\r\n?/g, '\n').split('\n')
  const readingLines = output.split('\n')
  return thaiLines
    .map((thai, index) => ({ thai: thai.trim(), karaoke: (readingLines[index] ?? '').trim() }))
    .filter((line) => line.thai || line.karaoke)
    .slice(0, MAX_KARAOKE_IMAGE_LINES)
}

/*
 * In-memory handoff of lines from the Converter to the Image Maker (never stored). The receiving page
 * reads it on mount and clears it once applied, like the image handoff, so StrictMode remounts still find it.
 */
export interface KaraokeLinesHandoff {
  id: number
  lines: Array<{ thai: string; karaoke: string }>
}

let pending: KaraokeLinesHandoff | null = null
let nextId = 1

export function sendKaraokeLines(lines: Array<{ thai: string; karaoke: string }>): KaraokeLinesHandoff {
  pending = { id: nextId, lines }
  nextId += 1
  return pending
}

export function peekKaraokeLinesHandoff(): KaraokeLinesHandoff | null {
  return pending
}

export function clearKaraokeLinesHandoff(id: number) {
  if (pending?.id === id) pending = null
}
