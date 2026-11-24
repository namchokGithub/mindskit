import { romanizeDetailed } from '@pcampus/thai-romanization'

import { groupDictionaryWords, lookupDictionaryReading } from './dictionary.ts'

/**
 * Where a word's reading came from:
 * - `dictionary`: the curated dictionary (certain)
 * - `edited`: a reading the user typed (certain)
 * - `guessed`: the romanization library (needs review)
 * - `failed`: no usable Latin reading (needs review)
 */
export type KaraokeWordStatus = 'dictionary' | 'edited' | 'guessed' | 'failed'

export type KaraokeToken =
  | { kind: 'word'; thai: string; syllables: string[]; status: KaraokeWordStatus }
  | { kind: 'text'; text: string }

export type KaraokeLine = KaraokeToken[]

/** Thai word → reading typed by the user, e.g. `{ เป็น: 'pen' }` or `{ ตาบอด: 'ta-bot' }`. */
export type KaraokeOverrides = Readonly<Record<string, string>>

const THAI_LETTER = /[ก-๎]/
const THAI_DIGITS = /[๐-๙]/g
const MAI_YAMOK = 'ๆ'
const LATIN_SYLLABLE = /^[a-z]+$/i

let segmenter: Intl.Segmenter | null = null
function getSegmenter(): Intl.Segmenter {
  segmenter ??= new Intl.Segmenter('th', { granularity: 'word' })
  return segmenter
}

const libraryCache = new Map<string, { syllables: string[]; status: 'guessed' | 'failed' }>()

function readWithLibrary(word: string): { syllables: string[]; status: 'guessed' | 'failed' } {
  const cached = libraryCache.get(word)
  if (cached) return cached

  let syllables: string[] = []
  try {
    syllables = romanizeDetailed(word).segments.map((segment) => segment.roman.trim().toLowerCase()).filter(Boolean)
  } catch {
    syllables = []
  }
  const result = {
    syllables,
    status: syllables.length > 0 && syllables.every((syllable) => LATIN_SYLLABLE.test(syllable)) ? ('guessed' as const) : ('failed' as const),
  }
  if (libraryCache.size > 5000) libraryCache.clear()
  libraryCache.set(word, result)
  return result
}

/** Splits a typed reading into syllables on spaces, hyphens, slashes, or dots. */
export function parseReading(reading: string): string[] {
  return reading
    .trim()
    .toLowerCase()
    .split(/[\s\-/.·]+/)
    .filter(Boolean)
}

/** Reads one Thai word: user edit, then dictionary, then the romanization library. */
export function readThaiWord(word: string, overrides: KaraokeOverrides = {}): Extract<KaraokeToken, { kind: 'word' }> {
  const edited = overrides[word]
  if (edited !== undefined) {
    const syllables = parseReading(edited)
    if (syllables.length > 0) return { kind: 'word', thai: word, syllables, status: 'edited' }
  }

  const known = lookupDictionaryReading(word)
  if (known) return { kind: 'word', thai: word, syllables: known, status: 'dictionary' }

  return { kind: 'word', thai: word, ...readWithLibrary(word) }
}

function toArabicDigits(text: string): string {
  return text.replace(THAI_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0e50))
}

function pushText(tokens: KaraokeToken[], text: string) {
  if (!text) return
  const last = tokens.at(-1)
  if (last?.kind === 'text') last.text += text
  else tokens.push({ kind: 'text', text })
}

type LinePart = { kind: 'thai'; word: string } | { kind: 'repeat' } | { kind: 'text'; text: string }

/** Segments a line into Thai words, mai yamok marks, and pass-through text. */
function splitLine(line: string): LinePart[] {
  const parts: LinePart[] = []
  for (const { segment } of getSegmenter().segment(line)) {
    // Mai yamok (ๆ) may arrive attached to a word ("จริงๆ") or on its own, and a segment can mix
    // Thai letters with digits or Latin text ("รัก๒๕"), so split those apart first.
    for (const part of segment.split(/(ๆ|[^ก-๎]+)/).filter(Boolean)) {
      if (part === MAI_YAMOK) parts.push({ kind: 'repeat' })
      else if (THAI_LETTER.test(part)) parts.push({ kind: 'thai', word: part })
      else parts.push({ kind: 'text', text: part })
    }
  }

  // Regroup each run of adjacent Thai words so results do not depend on the browser's segmenter.
  const grouped: LinePart[] = []
  for (let index = 0; index < parts.length; ) {
    if (parts[index].kind !== 'thai') {
      grouped.push(parts[index])
      index += 1
      continue
    }
    const run: string[] = []
    while (index < parts.length && parts[index].kind === 'thai') {
      run.push((parts[index] as { word: string }).word)
      index += 1
    }
    grouped.push(...groupDictionaryWords(run).map((word) => ({ kind: 'thai' as const, word })))
  }
  return grouped
}

function convertLine(line: string, overrides: KaraokeOverrides): KaraokeLine {
  const tokens: KaraokeToken[] = []
  let previousWord: Extract<KaraokeToken, { kind: 'word' }> | null = null

  for (const part of splitLine(line)) {
    if (part.kind === 'repeat') {
      if (previousWord) tokens.push({ ...previousWord, syllables: [...previousWord.syllables] })
      else pushText(tokens, MAI_YAMOK)
      continue
    }
    if (part.kind === 'text') {
      // Latin words, digits, spaces, and punctuation pass through unchanged (Thai digits become 0–9).
      pushText(tokens, toArabicDigits(part.text))
      if (part.text.trim()) previousWord = null
      continue
    }
    previousWord = readThaiWord(part.word, overrides)
    tokens.push(previousWord)
  }
  return tokens
}

/** Converts Thai text into karaoke tokens, line by line. Non-Thai text is kept as-is. */
export function convertThaiKaraoke(text: string, overrides: KaraokeOverrides = {}): KaraokeLine[] {
  return text.replace(/\r\n?/g, '\n').split('\n').map((line) => convertLine(line, overrides))
}

export interface KaraokeWordSummary {
  thai: string
  syllables: string[]
  status: KaraokeWordStatus
  count: number
}

/** Unique Thai words in order of first appearance, with how often each occurs. */
export function summarizeKaraokeWords(lines: KaraokeLine[]): KaraokeWordSummary[] {
  const words = new Map<string, KaraokeWordSummary>()
  for (const token of lines.flat()) {
    if (token.kind !== 'word') continue
    const existing = words.get(token.thai)
    if (existing) existing.count += 1
    else words.set(token.thai, { thai: token.thai, syllables: token.syllables, status: token.status, count: 1 })
  }
  return [...words.values()]
}

export function needsReview(status: KaraokeWordStatus): boolean {
  return status === 'guessed' || status === 'failed'
}
