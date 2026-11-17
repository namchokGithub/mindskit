import assert from 'node:assert/strict'
import test from 'node:test'

import {
  REFERENCE_SECONDS,
  REFERENCE_TICKS,
  TICKS_PER_DAY,
  breakdownFromSeconds,
  breakdownFromTicks,
  formatTickNumber,
  parseTickInput,
  secondsToTicks,
  ticksToSeconds,
} from '../src/features/minecraft/ticks.ts'

test('converts between game ticks and seconds at 20 TPS', () => {
  assert.equal(ticksToSeconds(20), 1)
  assert.equal(ticksToSeconds(1), 0.05)
  assert.equal(secondsToTicks(10), 200)
  assert.equal(secondsToTicks(30), 600)
  assert.equal(secondsToTicks(60), 1200)
  assert.equal(secondsToTicks(120), 2400)
})

test('breaks ticks into redstone ticks, seconds, and minutes', () => {
  assert.deepEqual(breakdownFromTicks(100), { ticks: 100, redstoneTicks: 50, seconds: 5, minutes: 5 / 60 })
  assert.deepEqual(breakdownFromSeconds(60), { ticks: 1200, redstoneTicks: 600, seconds: 60, minutes: 1 })
  assert.equal(breakdownFromSeconds(1200).ticks, TICKS_PER_DAY)
})

test('offers the requested reference rows', () => {
  assert.deepEqual([...REFERENCE_TICKS], [1, 2, 3, 5, 10, 20, 50, 100])
  const seconds = REFERENCE_SECONDS.map((row) => row.seconds)
  for (const required of [10, 30, 60, 120]) assert.ok(seconds.includes(required as never))
})

test('formats and parses tick values', () => {
  assert.equal(formatTickNumber(1200), '1,200')
  assert.equal(formatTickNumber(0.05), '0.05')
  assert.equal(formatTickNumber(0.1 + 0.2), '0.3')
  assert.equal(formatTickNumber(1 / 60), '0.0167')
  assert.equal(parseTickInput(' 1,200 '), 1200)
  assert.equal(parseTickInput('2.5'), 2.5)
  assert.equal(parseTickInput(''), null)
  assert.equal(parseTickInput('-1'), null)
  assert.equal(parseTickInput('abc'), null)
})
