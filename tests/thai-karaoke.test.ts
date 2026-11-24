import assert from 'node:assert/strict'
import test from 'node:test'

import { convertThaiKaraoke, parseReading, readThaiWord, summarizeKaraokeWords } from '../src/features/thai-karaoke/converter.ts'
import { groupDictionaryWords, lookupDictionaryReading } from '../src/features/thai-karaoke/dictionary.ts'
import { formatKaraoke } from '../src/features/thai-karaoke/formatter.ts'

const format = (text: string, options = {}, overrides = {}) =>
  formatKaraoke(convertThaiKaraoke(text, overrides), { letterCase: 'lower', syllableSeparator: '', wordSeparator: ' ', ...options })

test('reads dictionary words and exact dictionary compounds as certain', () => {
  assert.deepEqual(lookupDictionaryReading('เป็น'), ['pen'])
  assert.deepEqual(lookupDictionaryReading('เป็นไร'), ['pen', 'rai'])
  assert.deepEqual(lookupDictionaryReading('ตาบอด'), ['ta', 'bot'])
  assert.equal(lookupDictionaryReading('คอมพิวเตอร์'), null)
  assert.equal(readThaiWord('ไม่เป็นไร').status, 'dictionary')
})

test('regroups segmenter output by dictionary words, whichever way it was split', () => {
  assert.deepEqual(groupDictionaryWords(['ไม่', 'เป็นไร']), ['ไม่เป็นไร'])
  assert.deepEqual(groupDictionaryWords(['ไม่', 'เป็น', 'ไร']), ['ไม่เป็นไร'])
  assert.deepEqual(groupDictionaryWords(['ความ', 'รัก']), ['ความรัก'])
  assert.deepEqual(groupDictionaryWords(['ความรัก']), ['ความรัก'])
  assert.deepEqual(groupDictionaryWords(['ตาบอด']), ['ตา', 'บอด'])
  assert.deepEqual(groupDictionaryWords(['ตา', 'บอด']), ['ตา', 'บอด'])
  assert.deepEqual(groupDictionaryWords(['คอมพิวเตอร์', 'ใหม่']), ['คอมพิวเตอร์', 'ใหม่'])
})

test('falls back to the library and flags the word for review', () => {
  const word = readThaiWord('คอมพิวเตอร์')
  assert.equal(word.status, 'guessed')
  assert.ok(word.syllables.length > 0)
  assert.ok(word.syllables.every((syllable) => /^[a-z]+$/.test(syllable)))
})

test('user edits win over the dictionary and accept common separators', () => {
  assert.deepEqual(parseReading(' Mai-Pen / Rai '), ['mai', 'pen', 'rai'])
  const word = readThaiWord('เป็น', { เป็น: 'bpen' })
  assert.equal(word.status, 'edited')
  assert.deepEqual(word.syllables, ['bpen'])
  assert.equal(readThaiWord('เป็น', { เป็น: '  ' }).status, 'dictionary')
})

test('formats lines with word spacing, multi-line input, and pass-through text', () => {
  assert.equal(format('ฉันรักเธอ'), 'chan rak thoe')
  assert.equal(format('คิดถึงเธอทุกวัน\nไม่เป็นไรนะ'), 'khitthueng thoe thuk wan\nmaipenrai na')
  assert.equal(format('รัก 2025! hello'), 'rak 2025! hello')
  assert.equal(format('รัก๒๕'), 'rak 25')
  assert.equal(format('helloรัก'), 'hello rak')
})

test('applies syllable and word separators and letter case', () => {
  assert.equal(format('ความรักของเรา', { syllableSeparator: '-' }), 'khwam-rak khong rao')
  assert.equal(format('ความรักของเรา', { syllableSeparator: '/', wordSeparator: ' / ' }), 'khwam/rak / khong / rao')
  assert.equal(format('ความรัก', { syllableSeparator: ' ' }), 'khwam rak')
  assert.equal(format('ความรักของเรา', { letterCase: 'upper', syllableSeparator: '-' }), 'KHWAM-RAK KHONG RAO')
  assert.equal(format('ความรักของเรา', { letterCase: 'title', syllableSeparator: '-' }), 'Khwam-rak Khong Rao')
})

test('repeats the previous word for mai yamok, attached or standalone', () => {
  assert.equal(format('จริงๆ', { syllableSeparator: '-' }), 'ching ching')
  assert.equal(format('ดี ๆ'), 'di di')
  assert.equal(format('ๆ'), 'ๆ')
})

test('summarizes unique words with counts and review status', () => {
  const summary = summarizeKaraokeWords(convertThaiKaraoke('รักเธอ รักเธอ คอมพิวเตอร์'))
  assert.deepEqual(
    summary.map(({ thai, count, status }) => [thai, count, status]),
    [
      ['รัก', 2, 'dictionary'],
      ['เธอ', 2, 'dictionary'],
      ['คอมพิวเตอร์', 1, 'guessed'],
    ],
  )
})
