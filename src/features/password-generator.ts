export type PasswordMode = 'random' | 'memorable' | 'pin'

export type PasswordOptions = {
  mode: PasswordMode
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  symbolSet: string
  excludedCharacters: string
  excludeAmbiguous: boolean
}

export type PasswordResult = {
  value: string
  entropy: number
  score: 0 | 1 | 2 | 3 | 4
  label: 'Very weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
}

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const NUMBERS = '0123456789'
const AMBIGUOUS = 'O0oIl1|`\'"'
const WORDS = ['amber', 'anchor', 'atlas', 'bamboo', 'beacon', 'birch', 'canyon', 'cedar', 'cinder', 'comet', 'coral', 'crystal', 'dawn', 'ember', 'falcon', 'fern', 'forest', 'glacier', 'harbor', 'indigo', 'jasmine', 'lagoon', 'maple', 'meadow', 'meteor', 'moon', 'moss', 'ocean', 'orbit', 'pebble', 'pine', 'quartz', 'raven', 'river', 'sage', 'solstice', 'sparrow', 'summit', 'thunder', 'topaz', 'valley', 'violet', 'willow', 'winter', 'zenith']

function randomIndex(length: number) {
  const limit = Math.floor(0x1_0000_0000 / length) * length
  const values = new Uint32Array(1)
  do crypto.getRandomValues(values)
  while (values[0] >= limit)
  return values[0] % length
}

function randomCharacter(characters: readonly string[]) {
  return characters[randomIndex(characters.length)]
}

function shuffle(values: string[]) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const next = randomIndex(index + 1)
    ;[values[index], values[next]] = [values[next], values[index]]
  }
  return values.join('')
}

/** Splits text into unique characters by code point, preserving first-seen order. */
function uniqueCharacters(value: string) {
  return [...new Set(value)]
}

function getExcludedCharacters(options: PasswordOptions, includeAmbiguous = options.excludeAmbiguous) {
  return new Set(`${options.excludedCharacters}${includeAmbiguous ? AMBIGUOUS : ''}`)
}

function filterCharacters(value: string, excluded: ReadonlySet<string>) {
  return uniqueCharacters(value).filter((character) => !excluded.has(character))
}

export const passwordLengthRanges: Record<PasswordMode, { min: number; max: number }> = {
  random: { min: 8, max: 128 },
  memorable: { min: 3, max: 6 },
  pin: { min: 4, max: 12 },
}

export function clampPasswordLength(mode: PasswordMode, length: number) {
  const { min, max } = passwordLengthRanges[mode]
  return Math.max(min, Math.min(max, length))
}

function getScore(entropy: number): PasswordResult['score'] {
  if (entropy < 28) return 0
  if (entropy < 40) return 1
  if (entropy < 60) return 2
  if (entropy < 80) return 3
  return 4
}

const labels: PasswordResult['label'][] = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']

function createResult(value: string, entropy: number): PasswordResult {
  const score = getScore(entropy)
  return { value, entropy, score, label: labels[score] }
}

function generateRandom(options: PasswordOptions) {
  const excluded = getExcludedCharacters(options)
  const groups = [
    options.uppercase ? filterCharacters(UPPERCASE, excluded) : [],
    options.lowercase ? filterCharacters(LOWERCASE, excluded) : [],
    options.numbers ? filterCharacters(NUMBERS, excluded) : [],
    options.symbols ? filterCharacters(options.symbolSet, excluded) : [],
  ].filter((group) => group.length > 0)
  if (!groups.length) throw new Error('Choose at least one character group.')
  if (options.length < groups.length) throw new Error(`Choose a length of at least ${groups.length} to include every selected group.`)
  const alphabet = uniqueCharacters(groups.flat().join(''))
  const value = groups.map(randomCharacter)
  while (value.length < options.length) value.push(randomCharacter(alphabet))
  return createResult(shuffle(value), Math.log2(alphabet.length) * options.length)
}

function generateMemorable(options: PasswordOptions) {
  const count = clampPasswordLength('memorable', options.length)
  const excluded = getExcludedCharacters(options)
  const capitalize = (word: string) => options.uppercase ? `${word[0].toUpperCase()}${word.slice(1)}` : word
  const available = WORDS.map(capitalize).filter((word) => ![...word].some((character) => excluded.has(character)))
  if (available.length < count) {
    throw new Error(`Only ${available.length} word${available.length === 1 ? '' : 's'} remain after exclusions; choose ${available.length < 3 ? 'fewer excluded characters' : `at most ${available.length} words`}.`)
  }
  const separator = options.symbols ? '-' : ''
  if (separator && excluded.has(separator)) throw new Error('The hyphen separator is excluded. Allow "-" or turn off symbols.')
  const digits = filterCharacters(NUMBERS, excluded)
  const leadingDigits = digits.filter((digit) => digit !== '0')
  if (options.numbers && !leadingDigits.length) throw new Error('Keep at least one digit from 1 to 9 available for the number suffix.')
  const selected: string[] = []
  while (selected.length < count) {
    const word = available[randomIndex(available.length)]
    if (!selected.includes(word)) selected.push(word)
  }
  const suffix = options.numbers ? `${randomCharacter(leadingDigits)}${randomCharacter(digits)}${randomCharacter(digits)}` : ''
  const value = `${selected.join(separator)}${suffix ? `${separator}${suffix}` : ''}`
  const entropy = Math.log2(available.length) * count + (options.numbers ? Math.log2(leadingDigits.length) + Math.log2(digits.length) * 2 : 0)
  return createResult(value, entropy)
}

function generatePin(options: PasswordOptions) {
  const length = clampPasswordLength('pin', options.length)
  // PINs always use the full 0-9 range; ambiguous-character exclusion does not apply to digits-only output.
  const digits = filterCharacters(NUMBERS, getExcludedCharacters(options, false))
  if (digits.length < 2) throw new Error('Keep at least two digits available for a PIN.')
  const value = Array.from({ length }, () => randomCharacter(digits)).join('')
  return createResult(value, Math.log2(digits.length) * length)
}

export function generatePassword(options: PasswordOptions): PasswordResult {
  if (options.mode === 'memorable') return generateMemorable(options)
  if (options.mode === 'pin') return generatePin(options)
  return generateRandom(options)
}
