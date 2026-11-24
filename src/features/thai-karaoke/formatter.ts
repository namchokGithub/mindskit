import type { KaraokeLine } from './converter.ts'

export type KaraokeLetterCase = 'lower' | 'upper' | 'title'
export type KaraokeSyllableSeparator = '' | '-' | ' ' | '/'
export type KaraokeWordSeparator = ' ' | ' - ' | ' / '

export interface KaraokeFormatOptions {
  letterCase: KaraokeLetterCase
  syllableSeparator: KaraokeSyllableSeparator
  wordSeparator: KaraokeWordSeparator
}

export const DEFAULT_KARAOKE_FORMAT: KaraokeFormatOptions = {
  letterCase: 'lower',
  syllableSeparator: '',
  wordSeparator: ' ',
}

function applyCase(word: string, letterCase: KaraokeLetterCase): string {
  if (letterCase === 'upper') return word.toUpperCase()
  if (letterCase === 'title') return word.charAt(0).toUpperCase() + word.slice(1)
  return word
}

const ENDS_WITH_WORD_CHAR = /[\p{L}\p{N}]$/u
const STARTS_WITH_WORD_CHAR = /^[\p{L}\p{N}]/u

/**
 * Renders karaoke lines as text. Adjacent Thai words get `wordSeparator` between them, and a
 * space is added where a reading would otherwise run into neighbouring Latin text or digits.
 * Words without a usable reading keep their original Thai spelling so they stay visible.
 */
export function formatKaraoke(lines: KaraokeLine[], options: KaraokeFormatOptions = DEFAULT_KARAOKE_FORMAT): string {
  return lines
    .map((line) => {
      let output = ''
      let previousWasWord = false
      for (const token of line) {
        if (token.kind === 'text') {
          if (ENDS_WITH_WORD_CHAR.test(output) && STARTS_WITH_WORD_CHAR.test(token.text)) output += ' '
          output += token.text
          previousWasWord = false
          continue
        }

        const reading =
          token.status === 'failed'
            ? token.thai
            : applyCase(token.syllables.map((syllable) => syllable.toLowerCase()).join(options.syllableSeparator), options.letterCase)
        if (previousWasWord) output += options.wordSeparator
        else if (ENDS_WITH_WORD_CHAR.test(output)) output += ' '
        output += reading
        previousWasWord = true
      }
      return output
    })
    .join('\n')
}
