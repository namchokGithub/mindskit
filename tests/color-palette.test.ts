import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractColorsFromText,
  formatPaletteForCopy,
  isValidHexColor,
  normalizeHexColor,
  paletteSampleText,
  readableTextColor,
} from '../src/features/color-palette.ts'

test('extracts the sample palette in order with paragraph names', () => {
  assert.deepEqual(extractColorsFromText(paletteSampleText), [
    { name: 'Primary Pearl Gold', hex: '#D5C49A' },
    { name: 'Champagne Ivory', hex: '#E9DDBF' },
    { name: 'Soft Pearl', hex: '#F5F0E4' },
  ])
})

test('uses a label on the same line before the color', () => {
  assert.deepEqual(extractColorsFromText('- **Accent**: #ff00aa\n| Border | #abc |'), [
    { name: 'Accent', hex: '#FF00AA' },
    { name: 'Border', hex: '#ABC' },
  ])
})

test('falls back to numbered names and keeps duplicates', () => {
  assert.deepEqual(extractColorsFromText('#111111 #111111\n\n#222'), [
    { name: 'Color 1', hex: '#111111' },
    { name: 'Color 2', hex: '#111111' },
    { name: 'Color 3', hex: '#222' },
  ])
})

test('ignores values that are not #RGB or #RRGGBB colors', () => {
  assert.deepEqual(extractColorsFromText('#1234 #ABCDEF12 &#123; #ggg abc#fff'), [])
})

test('validates and normalizes HEX colors to uppercase', () => {
  assert.equal(isValidHexColor('#abc'), true)
  assert.equal(isValidHexColor('a1b2c3'), true)
  assert.equal(isValidHexColor('#abcd'), false)
  assert.equal(isValidHexColor('#12345g'), false)
  assert.equal(normalizeHexColor(' d5c49a '), '#D5C49A')
  assert.throws(() => normalizeHexColor('#12'), /not a valid HEX color/)
})

test('formats the palette for copying and picks readable label colors', () => {
  assert.equal(
    formatPaletteForCopy([{ name: 'Soft Pearl', hex: '#F5F0E4' }, { name: 'Ink', hex: '#111' }]),
    'Soft Pearl — #F5F0E4\nInk — #111',
  )
  assert.equal(readableTextColor('#F5F0E4'), '#000000')
  assert.equal(readableTextColor('#111'), '#FFFFFF')
})
