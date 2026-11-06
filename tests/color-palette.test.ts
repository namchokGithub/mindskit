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

test('extracts HEX colors without # and normalizes them for copying', () => {
  assert.deepEqual(extractColorsFromText('Primary Pearl Gold\nD5C49A\n\nAccent: abcdef'), [
    { name: 'Primary Pearl Gold', hex: '#D5C49A' },
    { name: 'Accent', hex: '#ABCDEF' },
  ])
})

test('does not treat short words made of HEX letters as colors without #', () => {
  assert.deepEqual(extractColorsFromText('Please add more contrast, the bad abc fad bed look\nAccent: abc'), [])
})

test('ignores list markers before a color and uses the label above instead', () => {
  assert.deepEqual(extractColorsFromText('Primary Gold\n1. #D5C49A\n\nSoft Pearl\n2) #F5F0E4\n\nInk\n- #111\n\n* #222\n\n3. Accent #abc'), [
    { name: 'Primary Gold', hex: '#D5C49A' },
    { name: 'Soft Pearl', hex: '#F5F0E4' },
    { name: 'Ink', hex: '#111' },
    { name: 'Color 4', hex: '#222' },
    { name: 'Accent', hex: '#ABC' },
  ])
})

test('falls back to numbered names and keeps duplicates', () => {
  assert.deepEqual(extractColorsFromText('#111111 #111111\n\n#222'), [
    { name: 'Color 1', hex: '#111111' },
    { name: 'Color 2', hex: '#111111' },
    { name: 'Color 3', hex: '#222' },
  ])
})

test('ignores incomplete HEX values and codes embedded in other tokens', () => {
  assert.deepEqual(extractColorsFromText('#1234 #ABCDEF12 &#123; #ggg abc#fff prefixD5C49A D5C49Asuffix'), [])
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
