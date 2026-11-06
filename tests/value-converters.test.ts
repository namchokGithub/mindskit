import assert from 'node:assert/strict'
import test from 'node:test'

import { convertColor, convertNumberBase } from '../src/features/value-converters.ts'

test('converts short and full HEX values with or without #', () => {
  for (const input of ['abc', '#abc', 'AABBCC', '#AABBCC']) {
    const result = convertColor(input)
    assert.match(result.output, /^HEX: #AABBCC\n/)
    assert.equal(result.cssValue, '#AABBCC')
  }
})

test('number base accepts a sign on any input and strips only the matching prefix', () => {
  assert.equal(convertNumberBase('-255', 10, 16), '-FF')
  assert.equal(convertNumberBase('+5', 10, 2), '101')
  assert.equal(convertNumberBase('-0xff', 16, 10), '-255')
  assert.equal(convertNumberBase('0B12', 16, 10), '2834')
  assert.equal(convertNumberBase('0b101', 2, 10), '5')
  assert.equal(convertNumberBase('0o17', 8, 10), '15')
  assert.throws(() => convertNumberBase('0x101', 2, 10), /valid base-2/)
  assert.throws(() => convertNumberBase('-', 10, 2), /valid base-10/)
})
