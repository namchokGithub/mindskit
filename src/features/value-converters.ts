export function convertNumberBase(input: string, sourceBase: number, targetBase: number): string {
  const value = input.trim().replace(/^[-+]?0[xX]/, '').replace(/^[-+]?0[oO]/, '').replace(/^[-+]?0[bB]/, '')
  const sign = input.trim().startsWith('-') ? -1n : 1n
  const digits = '0123456789abcdef'.slice(0, sourceBase)
  if (!value || [...value.toLowerCase()].some((character) => !digits.includes(character))) throw new Error(`Enter a valid base-${sourceBase} number.`)
  const number = [...value.toLowerCase()].reduce((total, character) => total * BigInt(sourceBase) + BigInt(digits.indexOf(character)), 0n) * sign
  return number.toString(targetBase).toUpperCase()
}

export type NumberLetterMapping = 'a1z26-uppercase' | 'a1z26-lowercase' | 'reverse-uppercase' | 'reverse-lowercase' | 'ascii' | 'roman'

export const numberLetterMappings: Record<NumberLetterMapping, { label: string; description: string; example: string; range: string }> = {
  'a1z26-uppercase': { label: 'A1Z26', description: 'Standard alphabet mapping', example: '1=A, 2=B, … 26=Z', range: '1–26' },
  'a1z26-lowercase': { label: 'a1z26', description: 'Lowercase alphabet mapping', example: '1=a, 2=b, … 26=z', range: '1–26' },
  'reverse-uppercase': { label: 'Reverse A1Z26', description: 'Reverse alphabet order', example: '1=Z, 2=Y, … 26=A', range: '1–26' },
  'reverse-lowercase': { label: 'Reverse a1z26', description: 'Reverse lowercase order', example: '1=z, 2=y, … 26=a', range: '1–26' },
  ascii: { label: 'ASCII', description: 'Printable ASCII characters', example: '65=A, 97=a, 48=0', range: '32–126' },
  roman: { label: 'Roman numerals', description: 'Classic Roman numeral system', example: '1=I, 4=IV, 26=XXVI', range: '1–3999' },
}

const romanValues: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

function toRoman(value: number) {
  let remaining = value
  let output = ''
  for (const [amount, symbol] of romanValues) {
    while (remaining >= amount) {
      output += symbol
      remaining -= amount
    }
  }
  return output
}

export function convertNumbersToLetters(input: string, mapping: NumberLetterMapping): string {
  if (!input.trim()) throw new Error('Enter one or more numbers to convert.')
  if (!/\d/.test(input)) throw new Error('Enter at least one whole number.')

  return input.replace(/\d+/g, (token) => {
    const value = Number(token)
    if (!Number.isSafeInteger(value)) throw new Error(`“${token}” is too large to convert safely.`)

    if (mapping === 'ascii') {
      if (value < 32 || value > 126) throw new Error(`ASCII values must be between 32 and 126; received ${value}.`)
      return String.fromCharCode(value)
    }

    if (mapping === 'roman') {
      if (value < 1 || value > 3999) throw new Error(`Roman numeral values must be between 1 and 3999; received ${value}.`)
      return toRoman(value)
    }

    if (value < 1 || value > 26) throw new Error(`Alphabet mapping values must be between 1 and 26; received ${value}.`)
    const alphabetPosition = mapping.startsWith('reverse') ? 27 - value : value
    const letter = String.fromCharCode(64 + alphabetPosition)
    return mapping.endsWith('lowercase') ? letter.toLowerCase() : letter
  })
}

function fromRoman(token: string) {
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  const normalized = token.toUpperCase()
  let total = 0
  for (let index = 0; index < normalized.length; index += 1) {
    const current = values[normalized[index]]
    const next = values[normalized[index + 1]] ?? 0
    total += current < next ? -current : current
  }
  if (total < 1 || total > 3999 || toRoman(total) !== normalized) throw new Error(`“${token}” is not a valid Roman numeral.`)
  return total
}

export function convertLettersToNumbers(input: string, mapping: NumberLetterMapping): string {
  if (!input.trim()) throw new Error('Enter letters or symbols to convert.')

  if (mapping === 'ascii') {
    return [...input].map((character) => {
      const value = character.charCodeAt(0)
      if (value < 32 || value > 126) throw new Error('ASCII conversion accepts printable characters only.')
      return String(value)
    }).join(' ')
  }

  if (mapping === 'roman') {
    if (!/[mdclxvi]/i.test(input)) throw new Error('Enter at least one Roman numeral.')
    return input.replace(/[mdclxvi]+/gi, (token) => String(fromRoman(token)))
  }

  if (!/[a-z]/i.test(input)) throw new Error('Enter at least one letter from A to Z.')
  return input.replace(/[a-z]/gi, (letter) => {
    const alphabetPosition = letter.toUpperCase().charCodeAt(0) - 64
    return String(mapping.startsWith('reverse') ? 27 - alphabetPosition : alphabetPosition)
  })
}

type DateParts = { day: number; month: number; year: number }

function assertValidDate({ day, month, year }: DateParts) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) || year < 1 || year > 3999) throw new Error('Enter a year between 1 and 3999.')
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('Enter a valid calendar date.')
}

function parseNumericDate(input: string): DateParts {
  const value = input.trim()
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/)
  if (!iso && !slash) throw new Error('Use YYYY-MM-DD or DD/MM/YYYY.')
  const [, first, second, third] = iso ?? slash!
  const date = iso ? { year: Number(first), month: Number(second), day: Number(third) } : { day: Number(first), month: Number(second), year: Number(third) }
  assertValidDate(date)
  return date
}

function formatNumericDate({ day, month, year }: DateParts) {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`
}

export function convertDateToRoman(input: string) {
  const { day, month, year } = parseNumericDate(input)
  return `${toRoman(day)}/${toRoman(month)}/${toRoman(year)}`
}

export function convertRomanToDate(input: string) {
  const parts = input.trim().split('/')
  if (parts.length !== 3 || parts.some((part) => !/^[mdclxvi]+$/i.test(part.trim()))) throw new Error('Use Roman dates in DD/MM/YYYY form, for example III/IX/MMXXVI.')
  const [day, month, year] = parts.map((part) => fromRoman(part.trim()))
  const date = { day, month, year }
  assertValidDate(date)
  return formatNumericDate(date)
}

type Rgba = { red: number; green: number; blue: number; alpha: number }

function validChannel(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 255
}

function fromHex(input: string): Rgba | null {
  const value = input.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{3,4}$|^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return null
  const expanded = value.length < 5 ? [...value].map((character) => character.repeat(2)).join('') : value
  return { red: Number.parseInt(expanded.slice(0, 2), 16), green: Number.parseInt(expanded.slice(2, 4), 16), blue: Number.parseInt(expanded.slice(4, 6), 16), alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1 }
}

function fromRgb(input: string): Rgba | null {
  const match = input.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i)
  if (!match) return null
  const [red, green, blue, alpha = 1] = match.slice(1).map(Number)
  return validChannel(red) && validChannel(green) && validChannel(blue) && alpha >= 0 && alpha <= 1 ? { red, green, blue, alpha } : null
}

function hueToRgb(first: number, second: number, hue: number) {
  const normalized = (hue + 1) % 1
  if (normalized * 6 < 1) return first + (second - first) * 6 * normalized
  if (normalized * 2 < 1) return second
  if (normalized * 3 < 2) return first + (second - first) * (2 / 3 - normalized) * 6
  return first
}

function fromHsl(input: string): Rgba | null {
  const match = input.trim().match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+\s*([\d.]+)%[,\s]+\s*([\d.]+)%(?:\s*[,/]\s*([\d.]+))?\s*\)$/i)
  if (!match) return null
  const [rawHue, rawSaturation, rawLightness, rawAlpha = 1] = match.slice(1).map(Number)
  if (![rawHue, rawSaturation, rawLightness, rawAlpha].every(Number.isFinite)) return null
  if (rawSaturation > 100 || rawLightness > 100 || rawAlpha < 0 || rawAlpha > 1) return null
  const hue = ((rawHue % 360) + 360) % 360 / 360
  const saturation = rawSaturation / 100
  const lightness = rawLightness / 100
  const second = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const first = 2 * lightness - second
  return { red: Math.round(hueToRgb(first, second, hue + 1 / 3) * 255), green: Math.round(hueToRgb(first, second, hue) * 255), blue: Math.round(hueToRgb(first, second, hue - 1 / 3) * 255), alpha: rawAlpha }
}

function toHsl({ red, green, blue, alpha }: Rgba): string {
  const [r, g, b] = [red / 255, green / 255, blue / 255]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const delta = max - min
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  const hue = delta === 0 ? 0 : ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360
  const label = alpha === 1 ? 'hsl' : 'hsla'
  return `${label}(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%${alpha === 1 ? '' : `, ${Number(alpha.toFixed(2))}`})`
}

export function convertColor(input: string): { output: string; cssValue: string } {
  const color = fromHex(input) ?? fromRgb(input) ?? fromHsl(input)
  if (!color) throw new Error('Enter a valid HEX, RGB(A), or HSL(A) color.')
  const hex = `#${[color.red, color.green, color.blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}${color.alpha === 1 ? '' : Math.round(color.alpha * 255).toString(16).padStart(2, '0')}`.toUpperCase()
  const rgb = `${color.alpha === 1 ? 'rgb' : 'rgba'}(${Math.round(color.red)}, ${Math.round(color.green)}, ${Math.round(color.blue)}${color.alpha === 1 ? '' : `, ${Number(color.alpha.toFixed(2))}`})`
  return { output: `HEX: ${hex}\nRGB: ${rgb}\nHSL: ${toHsl(color)}`, cssValue: hex }
}

export function formatDate(input: string, timeZone: string): string {
  const trimmed = input.trim()
  const timestamp = /^\d{10}$/.test(trimmed) ? Number(trimmed) * 1000 : /^\d{13}$/.test(trimmed) ? Number(trimmed) : Date.parse(trimmed)
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date, ISO date-time, or Unix timestamp.')
  const options = { timeZone: timeZone === 'browser' ? undefined : timeZone }
  const formatted = (settings: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...options, ...settings }).format(date)
  return [`ISO 8601 (UTC): ${date.toISOString()}`, `Date: ${formatted({ year: 'numeric', month: '2-digit', day: '2-digit' })}`, `Long date: ${formatted({ year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}`, `Time: ${formatted({ hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short' })}`, `Unix seconds: ${Math.floor(date.getTime() / 1000)}`, `Unix milliseconds: ${date.getTime()}`].join('\n')
}
