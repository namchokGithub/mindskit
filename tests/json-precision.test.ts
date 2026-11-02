import assert from 'node:assert/strict'
import test from 'node:test'

import { findUnsafeJsonNumbers } from '../src/features/formatters/json-precision.ts'

test('flags integers beyond the safe range and over-precise decimals', () => {
  assert.deepEqual(findUnsafeJsonNumbers('{"id":12345678901234567890,"ok":9007199254740991,"pi":3.14159265358979323846}'), [
    '12345678901234567890',
    '3.14159265358979323846',
  ])
  assert.deepEqual(findUnsafeJsonNumbers('[-9007199254740993, 1e400]'), ['-9007199254740993', '1e400'])
})

test('ignores safe numbers and digits inside strings', () => {
  assert.deepEqual(findUnsafeJsonNumbers('{"big":"12345678901234567890","a":1.10,"b":1e2,"c":-0.5,"d":"esc \\" 99999999999999999999"}'), [])
})

test('stops after the limit', () => {
  assert.equal(findUnsafeJsonNumbers('[11111111111111111111,22222222222222222222,33333333333333333333]', 2).length, 2)
})
