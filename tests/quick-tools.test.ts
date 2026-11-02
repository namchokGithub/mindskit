import assert from 'node:assert/strict'
import test from 'node:test'

import * as quickTools from '../src/features/quick-tools.ts'

test('returns the current time as whole Unix seconds', () => {
  assert.equal(quickTools.currentUnixTimestamp?.(1_704_067_200_987), '1704067200')
})

test('counts unique characters by code point for random strings', () => {
  assert.deepEqual(quickTools.uniqueCharacters('aab😀😀'), ['a', 'b', '😀'])
  assert.equal(quickTools.randomStringCapacity(quickTools.uniqueCharacters('aa').length, 1), 1)
  assert.equal(quickTools.randomStringCapacity(2, 7), 128)
  assert.ok(quickTools.randomStringCapacity(26, 16) > 200)
})
