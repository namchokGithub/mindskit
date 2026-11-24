/**
 * Casual Karaoke: an easier-to-read spelling derived from RTGS syllables.
 *
 * 1. จ initial → `j` (ฉ, ช, ฌ stay `ch`): ใจ chai → jai
 * 2. `oe` → `er`: เธอ thoe → ther, เดิน doen → dern (`oei` from เ-ย stays: เคย khoei)
 * 3. `ue` → `eu`: ถึง thueng → theung, เพื่อน phuean → pheuan
 * 4. Final ว written `o` → `w`: แล้ว laeo → laew, เดียว diao → diew, เร็ว reo → rew, หิว hio → hiw
 *    (`ao` stays, because RTGS uses it for both เ-า and -าว: เขา/ข้าว khao)
 */

const CH_LETTERS = /[จฉชฌ]/g
const LEADING_VOWELS = /^[เแโใไ]+/

function applyStringRules(syllable: string): string {
  return syllable
    .replace(/oe(?!i)/g, 'er')
    .replace(/ue/g, 'eu')
    .replace(/iao$/, 'iew')
    .replace(/aeo$/, 'aew')
    .replace(/eo$/, 'ew')
    .replace(/io$/, 'iw')
}

function startsWithJo(thaiSyllable: string): boolean {
  return thaiSyllable.replace(LEADING_VOWELS, '').startsWith('จ')
}

/**
 * Decides which `ch` syllables come from จ. With per-syllable Thai (library results) each syllable
 * is checked directly; otherwise the word's จ/ฉ/ช/ฌ letters are paired in order with its `ch`
 * syllables, and when the counts differ every `ch` is kept (ambiguous, e.g. a final จ read as `t`).
 */
function joFlags(thai: string, syllables: string[], syllableThai?: string[]): boolean[] {
  if (syllableThai && syllableThai.length === syllables.length) {
    return syllables.map((syllable, index) => syllable.startsWith('ch') && startsWithJo(syllableThai[index]))
  }

  const letters = thai.match(CH_LETTERS) ?? []
  const chIndexes = syllables.flatMap((syllable, index) => (syllable.startsWith('ch') ? [index] : []))
  const flags = syllables.map(() => false)
  if (letters.length !== chIndexes.length) return flags
  chIndexes.forEach((syllableIndex, order) => {
    flags[syllableIndex] = letters[order] === 'จ'
  })
  return flags
}

/** Converts one word's RTGS syllables to Casual Karaoke syllables. */
export function toCasualSyllables(thai: string, syllables: readonly string[], syllableThai?: readonly string[]): string[] {
  const lower = syllables.map((syllable) => syllable.toLowerCase())
  const jo = joFlags(thai, lower, syllableThai ? [...syllableThai] : undefined)
  return lower.map((syllable, index) => applyStringRules(jo[index] ? `j${syllable.slice(2)}` : syllable))
}
