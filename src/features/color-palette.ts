export const MAX_PALETTE_COLORS = 20

export type PaletteColor = { name: string; hex: string }

const hexPattern = /(?<![\w&#])#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-z_])/gi
const nameEdgeCharacters = /^[\s|:*_`>#\-–—=•·,.;()[\]]+|[\s|:*_`>#\-–—=•·,.;()[\]]+$/g
const maxNameLength = 60

export function isValidHexColor(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export function normalizeHexColor(value: string): string {
  const trimmed = value.trim()
  if (!isValidHexColor(trimmed)) throw new Error(`"${trimmed}" is not a valid HEX color. Use #RGB or #RRGGBB.`)
  return `#${trimmed.replace(/^#/, '').toUpperCase()}`
}

function cleanName(value: string): string {
  const cleaned = value.replace(nameEdgeCharacters, '').replace(/\s+/g, ' ').trim()
  return cleaned.length > maxNameLength ? `${cleaned.slice(0, maxNameLength - 1).trimEnd()}…` : cleaned
}

/** The first line of the paragraph above the color, stopping at a blank line or another color line. */
function nameFromLinesAbove(lines: string[], lineIndex: number): string {
  let name = ''
  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (!line.trim() || line.search(hexPattern) !== -1) break
    const cleaned = cleanName(line)
    if (cleaned) name = cleaned
  }
  return name
}

/** Finds HEX colors in free text, in the order they appear, paired with a nearby label when one exists. */
export function extractColorsFromText(text: string): PaletteColor[] {
  const lines = text.split(/\r?\n/)
  const colors: PaletteColor[] = []
  lines.forEach((line, lineIndex) => {
    let previousEnd = 0
    for (const match of line.matchAll(hexPattern)) {
      const start = match.index ?? 0
      const sameLineName = cleanName(line.slice(previousEnd, start))
      const name = sameLineName || (previousEnd === 0 ? nameFromLinesAbove(lines, lineIndex) : '')
      colors.push({ name: name || `Color ${colors.length + 1}`, hex: normalizeHexColor(match[0]) })
      previousEnd = start + match[0].length
    }
  })
  return colors
}

export function formatPaletteForCopy(colors: PaletteColor[]): string {
  return colors.map((color) => `${color.name} — ${color.hex}`).join('\n')
}

/** Picks black or white text for legible labels on top of a swatch. */
export function readableTextColor(hex: string): '#000000' | '#FFFFFF' {
  const value = normalizeHexColor(hex).slice(1)
  const expanded = value.length === 3 ? [...value].map((character) => character.repeat(2)).join('') : value
  const [red, green, blue] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(expanded.slice(offset, offset + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return luminance > 0.179 ? '#000000' : '#FFFFFF'
}

export const paletteSampleText = `Divine — Celestial Pearl Gold ✦✦✦

Primary Pearl Gold
ขอบตัว Slime หลัก
#D5C49A

Champagne Ivory
ขอบด้านสว่าง / Transition
#E9DDBF

Soft Pearl
เนื้อ Slime สีหลัก
#F5F0E4`
