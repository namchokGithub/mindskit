import assert from 'node:assert/strict'
import test from 'node:test'

import { clampPasswordLength, generatePassword, passwordLengthRanges, type PasswordOptions } from '../src/features/password-generator.ts'

const defaults: PasswordOptions = {
  mode: 'random', length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true,
  symbolSet: '!@#$%^&*()_+-=[]{}:?,./', excludedCharacters: '', excludeAmbiguous: true,
}

test('PIN mode keeps every digit even when ambiguous characters are excluded', () => {
  const seen = new Set<string>()
  for (let index = 0; index < 200; index += 1) {
    for (const digit of generatePassword({ ...defaults, mode: 'pin', length: 12 }).value) seen.add(digit)
  }
  assert.deepEqual([...seen].sort(), [...'0123456789'])
  assert.equal(generatePassword({ ...defaults, mode: 'pin', length: 4 }).entropy, Math.log2(10) * 4)
  assert.doesNotMatch(generatePassword({ ...defaults, mode: 'pin', length: 12, excludedCharacters: '0123' }).value, /[0-3]/)
})

test('length clamps to the selected mode range', () => {
  assert.deepEqual(passwordLengthRanges.memorable, { min: 3, max: 6 })
  assert.equal(clampPasswordLength('random', 3), 8)
  assert.equal(clampPasswordLength('pin', 16), 12)
  assert.equal(clampPasswordLength('memorable', 16), 6)
  assert.equal(clampPasswordLength('random', 20), 20)
})

test('random mode de-duplicates the alphabet by code point before computing entropy', () => {
  const options: PasswordOptions = { ...defaults, length: 10, uppercase: false, lowercase: false, numbers: false, symbolSet: '==😀😀a', excludeAmbiguous: false }
  const result = generatePassword(options)
  assert.equal(result.entropy, Math.log2(3) * 10)
  assert.equal([...result.value].length, 10)
  assert.ok([...result.value].every((character) => ['=', '😀', 'a'].includes(character)))
  const overlapping = generatePassword({ ...defaults, length: 8, uppercase: false, numbers: false, symbolSet: 'abc', excludeAmbiguous: false })
  assert.equal(overlapping.entropy, Math.log2(26) * 8)
})

test('memorable mode respects excluded and ambiguous characters', () => {
  for (let index = 0; index < 50; index += 1) {
    const value = generatePassword({ ...defaults, mode: 'memorable', length: 4 }).value
    assert.doesNotMatch(value, /[O0oIl1|`'"]/)
  }
  const value = generatePassword({ ...defaults, mode: 'memorable', length: 3, excludedCharacters: 'e', excludeAmbiguous: false, numbers: false }).value
  assert.doesNotMatch(value, /e/)
  assert.throws(() => generatePassword({ ...defaults, mode: 'memorable', length: 3, excludedCharacters: 'aeiou' }), /words? remain after exclusions/)
  assert.throws(() => generatePassword({ ...defaults, mode: 'memorable', length: 3, excludedCharacters: '-' }), /hyphen separator/)
})
