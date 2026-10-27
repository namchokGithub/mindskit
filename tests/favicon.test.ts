import assert from 'node:assert/strict'
import test from 'node:test'

import { FAVICON_SIZES, downscaleSteps, encodeIco, fitInSquare } from '../src/features/images/favicon.ts'

test('uses the standard favicon sizes', () => {
  assert.deepEqual([...FAVICON_SIZES], [16, 32, 48])
})

test('fits a non-square image inside the square with transparent padding', () => {
  assert.deepEqual(fitInSquare({ width: 400, height: 200 }, 100), { x: 0, y: 25, width: 100, height: 50 })
  assert.deepEqual(fitInSquare({ width: 100, height: 300 }, 48), { x: 16, y: 0, width: 16, height: 48 })
  assert.deepEqual(fitInSquare({ width: 64, height: 64 }, 32), { x: 0, y: 0, width: 32, height: 32 })
})

test('halves large images before the final favicon size', () => {
  assert.deepEqual(downscaleSteps(1024, 16), [512, 256, 128, 64, 32, 16])
  assert.deepEqual(downscaleSteps(100, 48), [50, 48])
  assert.deepEqual(downscaleSteps(10, 16), [16])
})

test('packs PNG entries into an ICO container', () => {
  const first = new Uint8Array([1, 2, 3])
  const second = new Uint8Array([4, 5])
  const ico = encodeIco([{ size: 16, png: first }, { size: 256, png: second }])
  const view = new DataView(ico.buffer)

  assert.equal(ico.byteLength, 6 + 16 * 2 + 5)
  assert.equal(view.getUint16(0, true), 0)
  assert.equal(view.getUint16(2, true), 1)
  assert.equal(view.getUint16(4, true), 2)

  assert.equal(ico[6], 16)
  assert.equal(view.getUint16(6 + 6, true), 32)
  assert.equal(view.getUint32(6 + 8, true), 3)
  assert.equal(view.getUint32(6 + 12, true), 38)
  assert.deepEqual([...ico.slice(38, 41)], [1, 2, 3])

  assert.equal(ico[22], 0, '256 px is stored as 0')
  assert.equal(view.getUint32(22 + 12, true), 41)
  assert.deepEqual([...ico.slice(41)], [4, 5])
})

test('rejects empty or out-of-range ICO input', () => {
  assert.throws(() => encodeIco([]), /at least one image/)
  assert.throws(() => encodeIco([{ size: 512, png: new Uint8Array(1) }]), /1–256 px/)
})
