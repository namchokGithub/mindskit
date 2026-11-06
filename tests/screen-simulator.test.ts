import assert from 'node:assert/strict'
import test from 'node:test'

import { fillNoise } from '../src/features/screen-simulator/noise.ts'
import {
  MAX_CALL_MEMBERS,
  RESOLUTIONS,
  avatarInitials,
  formatCallDuration,
  formatClock,
  hexToRgbText,
  kelvinToHex,
  parseMemberNames,
  parseScreenColor,
  progressPercent,
  randomMemberNames,
} from '../src/features/screen-simulator/screen.ts'

test('parses HEX and RGB screen colors', () => {
  assert.equal(parseScreenColor('#FFC0CB'), '#FFC0CB')
  assert.equal(parseScreenColor('ffc0cb'), '#FFC0CB')
  assert.equal(parseScreenColor('#fcb'), '#FFCCBB')
  assert.equal(parseScreenColor('12, 23, 12'), '#0C170C')
  assert.equal(parseScreenColor('rgb(255, 0, 128)'), '#FF0080')
  assert.equal(parseScreenColor('12 23 12'), '#0C170C')
  assert.equal(parseScreenColor('256, 0, 0'), null)
  assert.equal(parseScreenColor('#12345'), null)
  assert.equal(hexToRgbText('#0C170C'), '12, 23, 12')
})

test('maps color temperature from warm to cool', () => {
  assert.equal(kelvinToHex(6600), '#FFFFFF')
  const warm = kelvinToHex(1500)
  const cool = kelvinToHex(8500)
  assert.equal(warm.slice(1, 3), 'FF')
  assert.ok(Number.parseInt(warm.slice(5, 7), 16) < 40, 'warm light has little blue')
  assert.equal(cool.slice(5, 7), 'FF')
  assert.ok(Number.parseInt(cool.slice(1, 3), 16) < 255, 'cool light has less red')
  assert.equal(kelvinToHex(100), kelvinToHex(1500))
  assert.equal(kelvinToHex(20000), kelvinToHex(8500))
})

test('computes fake progress over time or as a fixed value', () => {
  assert.equal(progressPercent('auto', 0, 120, 50), 0)
  assert.equal(progressPercent('auto', 60_000, 120, 50), 50)
  assert.equal(progressPercent('auto', 999_999, 120, 50), 100)
  assert.equal(progressPercent('fixed', 60_000, 120, 42.4), 42)
  assert.equal(progressPercent('fixed', 0, 120, 140), 100)
  assert.equal(progressPercent('auto', 1000, 0, 0), 100)
})

test('builds avatar initials for English and Thai names', () => {
  assert.equal(avatarInitials('Jane Doe'), 'JD')
  assert.equal(avatarInitials('olivia van der berg'), 'OB')
  assert.equal(avatarInitials('Cher'), 'C')
  assert.equal(avatarInitials('สุดา รักษ์ไทย'), 'สด')
  assert.equal(avatarInitials('เอกชัย ศรีสุข'), 'อก')
  assert.equal(avatarInitials('ไพโรจน์'), 'พร')
  assert.equal(avatarInitials('   '), '?')
})

test('limits call members to nine', () => {
  assert.equal(parseMemberNames('a\nb, c\n\n d ').length, 4)
  assert.equal(parseMemberNames(Array.from({ length: 12 }, (_, index) => `Name ${index}`).join('\n')).length, MAX_CALL_MEMBERS)
  const picked = randomMemberNames(20, () => 0)
  assert.equal(picked.length, MAX_CALL_MEMBERS)
  assert.equal(new Set(picked).size, picked.length)
})

test('formats clocks and call durations', () => {
  const date = new Date(2026, 0, 1, 0, 5, 9)
  assert.deepEqual(formatClock(date, false), { hours: '00', minutes: '05', seconds: '09', period: '' })
  assert.deepEqual(formatClock(date, true), { hours: '12', minutes: '05', seconds: '09', period: 'AM' })
  assert.equal(formatClock(new Date(2026, 0, 1, 13, 0, 0), true).hours, '01')
  assert.equal(formatCallDuration(65_000), '01:05')
  assert.equal(formatCallDuration(3_725_000), '1:02:05')
})

test('offers 480p through 8K previews', () => {
  assert.deepEqual(RESOLUTIONS.map((item) => item.id), ['480p', '720p', '1080p', '2k', '4k', '8k'])
})

test('keeps generated noise within [-1, 1]', () => {
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const color of ['white', 'pink', 'brown'] as const) {
    const samples = fillNoise(new Float32Array(10_000), color, random)
    assert.ok(samples.every((value) => value >= -1 && value <= 1), color)
    assert.ok(samples.some((value) => value !== 0), color)
  }
})

test('maps gray levels from black to white', async () => {
  const { grayHex } = await import('../src/features/screen-simulator/screen.ts')
  assert.equal(grayHex(0), '#000000')
  assert.equal(grayHex(128), '#808080')
  assert.equal(grayHex(255), '#FFFFFF')
  assert.equal(grayHex(300), '#FFFFFF')
})

test('tracks countdown and stopwatch time across pauses', async () => {
  const { STOPPED_TIMER, countdownRemaining, durationFromParts, formatTimer, pauseTimer, startTimer, timerElapsed } = await import('../src/features/screen-simulator/screen.ts')
  let state = startTimer(STOPPED_TIMER, 1_000)
  assert.equal(timerElapsed(state, 3_500), 2_500)
  state = pauseTimer(state, 3_500)
  assert.equal(timerElapsed(state, 99_000), 2_500)
  state = startTimer(state, 10_000)
  assert.equal(timerElapsed(state, 11_000), 3_500)
  assert.equal(startTimer(state, 50_000), state, 'starting a running timer keeps its start time')

  const total = durationFromParts(0, 1, 30)
  assert.equal(total, 90_000)
  assert.equal(countdownRemaining(total, state, 11_000), 86_500)
  assert.equal(countdownRemaining(total, state, 500_000), 0)
  assert.equal(durationFromParts(-1, Number.NaN, 5.9), 5_000)

  assert.equal(formatTimer(86_500), '01:27')
  assert.equal(formatTimer(3_725_000), '1:02:05')
  assert.equal(formatTimer(65_432, true), '01:05.43')
  assert.equal(formatTimer(0), '00:00')
})

test('draws opaque black-and-white static frames', async () => {
  const { fillNoiseFrame } = await import('../src/features/screen-simulator/noise.ts')
  assert.deepEqual([...fillNoiseFrame(new Uint8ClampedArray(4), () => 0.9)], [255, 255, 255, 255])
  assert.deepEqual([...fillNoiseFrame(new Uint8ClampedArray(4), () => 0.1)], [0, 0, 0, 255])
})

test('builds Matrix characters from the selected languages', async () => {
  const { MATRIX_CHARSETS, matrixCharacters } = await import('../src/features/screen-simulator/screen.ts')
  const mixed = matrixCharacters(['en', 'pt'])
  assert.ok(mixed.includes('A') && mixed.includes('Ç') && mixed.includes('7'))
  assert.equal(mixed.filter((character) => character === 'A').length, 1, 'shared Latin letters appear once')
  assert.deepEqual(matrixCharacters([]), matrixCharacters(['ja']))
  assert.ok(matrixCharacters(['th']).every((character) => !/[ัิ-ฺ็-๎]/.test(character)), 'no Thai combining marks')
  for (const { characters } of Object.values(MATRIX_CHARSETS)) assert.ok(characters.length >= 20)
})
