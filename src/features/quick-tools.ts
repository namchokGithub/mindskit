function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export const quickOperations = {
  base64: [{ label: 'Encode', value: 'encode' }, { label: 'Decode', value: 'decode' }],
  url: [{ label: 'Encode', value: 'encode' }, { label: 'Decode', value: 'decode' }],
  html: [{ label: 'Encode', value: 'encode' }, { label: 'Decode', value: 'decode' }],
  timestamp: [{ label: 'Timestamp → Date', value: 'to-date' }, { label: 'Date → Timestamp', value: 'to-timestamp' }],
} as const

export function currentUnixTimestamp(now = Date.now()): string {
  return String(Math.floor(now / 1000))
}

export function convertBase64(input: string, operation: string): string {
  try {
    return operation === 'decode'
      ? new TextDecoder().decode(base64ToBytes(input))
      : bytesToBase64(new TextEncoder().encode(input))
  } catch {
    throw new Error('Invalid Base64 input.')
  }
}

export function convertUrl(input: string, operation: string): string {
  try {
    return operation === 'decode' ? decodeURIComponent(input) : encodeURIComponent(input)
  } catch {
    throw new Error('Invalid URL-encoded input.')
  }
}

export function convertHtml(input: string, operation: string): string {
  if (operation === 'decode') {
    const element = document.createElement('textarea')
    element.innerHTML = input
    return element.value
  }
  return input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

export function convertTimestamp(input: string, operation: string, _prefix?: string, _suffix?: string, timeZone = 'browser'): string {
  const trimmed = input.trim()
  const date = !trimmed ? new Date(Number.NaN) : operation === 'to-date' ? new Date(/^\d{13}$/.test(trimmed) ? Number(trimmed) : Number(trimmed) * 1000) : new Date(trimmed)
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid timestamp or date.')
  return operation === 'to-date' ? formatTimestampForTimeZone(date, timeZone === 'browser' ? undefined : timeZone) : String(Math.floor(date.getTime() / 1000))
}

function formatTimestampForTimeZone(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const offset = values.timeZoneName === 'GMT' ? 'Z' : values.timeZoneName.replace('GMT', '')
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}.${String(date.getMilliseconds()).padStart(3, '0')}${offset}`
}

/** Distinct characters by code point, so duplicates and emoji count once and are never split into surrogate halves. */
export function uniqueCharacters(alphabet: string): string[] {
  return [...new Set(alphabet)]
}

/** How many distinct strings of `length` can be built from `characterCount` characters (may be Infinity for huge values). */
export function randomStringCapacity(characterCount: number, length: number): number {
  return characterCount ** length
}
