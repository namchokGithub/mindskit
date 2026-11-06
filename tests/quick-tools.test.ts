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

test('converts both second and millisecond timestamps to dates', () => {
  assert.equal(quickTools.convertTimestamp('1704067200', 'to-date', undefined, undefined, 'UTC'), '2024-01-01T00:00:00.000Z')
  assert.equal(quickTools.convertTimestamp(' 1704067200000 ', 'to-date', undefined, undefined, 'UTC'), '2024-01-01T00:00:00.000Z')
})

test('rejects empty or whitespace-only timestamp input', () => {
  assert.throws(() => quickTools.convertTimestamp('   ', 'to-date', undefined, undefined, 'UTC'), { message: 'Enter a valid timestamp or date.' })
  assert.throws(() => quickTools.convertTimestamp('', 'to-timestamp'), { message: 'Enter a valid timestamp or date.' })
  assert.throws(() => quickTools.convertTimestamp('not a date', 'to-timestamp'), { message: 'Enter a valid timestamp or date.' })
  assert.equal(quickTools.convertTimestamp(' 2024-01-01T00:00:00Z ', 'to-timestamp'), '1704067200')
})

test('HTML encoding escapes quotes as well as markup characters', () => {
  assert.equal(quickTools.convertHtml(`<a href="x">Tom & Jerry's</a>`, 'encode'), '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;')
})

test('Base64 and URL conversion throw on invalid input instead of returning error text', () => {
  assert.equal(quickTools.convertBase64('Hello', 'encode'), 'SGVsbG8=')
  assert.equal(quickTools.convertBase64('SGVsbG8=', 'decode'), 'Hello')
  assert.throws(() => quickTools.convertBase64('%%%', 'decode'), { message: 'Invalid Base64 input.' })
  assert.equal(quickTools.convertUrl('a b', 'encode'), 'a%20b')
  assert.throws(() => quickTools.convertUrl('%E0%A4%A', 'decode'), { message: 'Invalid URL-encoded input.' })
})
