import assert from 'node:assert/strict'
import test from 'node:test'

import { convertColor } from '../src/features/value-converters.ts'

test('converts short and full HEX values with or without #', () => {
  for (const input of ['abc', '#abc', 'AABBCC', '#AABBCC']) {
    const result = convertColor(input)
    assert.match(result.output, /^HEX: #AABBCC\n/)
    assert.equal(result.cssValue, '#AABBCC')
  }
})
