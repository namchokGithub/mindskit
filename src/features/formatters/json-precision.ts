const JSON_NUMBER_PATTERN = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y

function losesPrecision(token: string): boolean {
  const value = Number(token)
  if (!Number.isFinite(value)) return true
  if (/^-?\d+$/.test(token)) return !Number.isSafeInteger(value)
  // A double keeps about 15 significant decimal digits; longer mantissas may be rounded.
  const digits = token.replace(/^-/, '').replace(/[eE].*$/, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '')
  return digits.length > 15
}

/**
 * Finds numbers in raw JSON text that `JSON.parse` cannot represent exactly (integers beyond
 * Number.MAX_SAFE_INTEGER, mantissas over 15 significant digits, or values that overflow). Strings are skipped.
 */
export function findUnsafeJsonNumbers(input: string, limit = 3): string[] {
  const found: string[] = []
  let inString = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (inString) {
      if (character === '\\') index += 1
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      continue
    }
    if (character !== '-' && (character < '0' || character > '9')) continue
    JSON_NUMBER_PATTERN.lastIndex = index
    const match = JSON_NUMBER_PATTERN.exec(input)
    if (!match) continue
    if (losesPrecision(match[0])) {
      found.push(match[0])
      if (found.length >= limit) break
    }
    index += match[0].length - 1
  }
  return found
}
