import assert from 'node:assert/strict'
import test from 'node:test'

import {
  OUTPUT_SIZE_PRESETS,
  clampFreeAngle,
  maxInscribedRect,
  normalizeQuarterTurns,
  resizeCropRect,
  resizeCropToDimensions,
  rotatedBoundingSize,
  totalRotation,
  validateOutputSize,
} from '../src/features/images/crop.ts'

test('normalizes quarter turns and clamps the free angle', () => {
  assert.equal(normalizeQuarterTurns(-1), 3)
  assert.equal(normalizeQuarterTurns(5), 1)
  assert.equal(clampFreeAngle(60), 45)
  assert.equal(clampFreeAngle(-90), -45)
  assert.equal(clampFreeAngle(Number.NaN), 0)
  assert.equal(totalRotation({ quarterTurns: 1, angle: 10, flipH: false, flipV: false }), 100)
})

test('computes the bounding box of a rotated image', () => {
  assert.deepEqual(rotatedBoundingSize({ width: 400, height: 200 }, 0), { width: 400, height: 200 })
  assert.deepEqual(rotatedBoundingSize({ width: 400, height: 200 }, 90), { width: 200, height: 400 })
  assert.deepEqual(rotatedBoundingSize({ width: 100, height: 100 }, 45), { width: 141, height: 141 })
})

test('keeps the full image as the crop area without free rotation', () => {
  assert.deepEqual(maxInscribedRect({ width: 400, height: 200 }, 0), { x: 0, y: 0, width: 400, height: 200 })
  assert.deepEqual(maxInscribedRect({ width: 400, height: 200 }, 90), { x: 0, y: 0, width: 200, height: 400 })
})

test('limits the crop area to image pixels after a free rotation', () => {
  const rect = maxInscribedRect({ width: 100, height: 100 }, 45)
  assert.equal(rect.width, 70)
  assert.equal(rect.height, 70)
  assert.ok(rect.x >= 35 && rect.x <= 36)

  const tilted = maxInscribedRect({ width: 1000, height: 500 }, 10)
  const bounding = rotatedBoundingSize({ width: 1000, height: 500 }, 10)
  assert.ok(tilted.width < 1000 && tilted.height < 500)
  assert.ok(tilted.x + tilted.width <= bounding.width && tilted.y + tilted.height <= bounding.height)
})

test('sets an exact crop size around the current center', () => {
  const bounds = { width: 1000, height: 800 }
  const rect = { x: 100, y: 100, width: 400, height: 400 }
  assert.deepEqual(resizeCropToDimensions(rect, { width: 200 }, null, bounds), { x: 200, y: 100, width: 200, height: 400 })
  assert.deepEqual(resizeCropToDimensions(rect, { width: 300 }, 1, bounds), { x: 150, y: 150, width: 300, height: 300 })
  assert.deepEqual(resizeCropToDimensions(rect, { height: 200 }, 2, bounds), { x: 100, y: 200, width: 400, height: 200 })
  assert.equal(resizeCropToDimensions(rect, { width: 5000 }, null, bounds).width, 1000)
})

test('validates output sizes and keeps presets within limits', () => {
  assert.equal(validateOutputSize({ width: 1200, height: 630 }), null)
  assert.match(validateOutputSize({ width: 0, height: 630 }) ?? '', /whole-number/)
  assert.match(validateOutputSize({ width: 12.5, height: 630 }) ?? '', /whole-number/)
  assert.match(validateOutputSize({ width: 20_000, height: 630 }) ?? '', /10,000 px/)
  for (const preset of OUTPUT_SIZE_PRESETS) assert.equal(validateOutputSize(preset), null, preset.id)
  assert.equal(new Set(OUTPUT_SIZE_PRESETS.map((preset) => preset.id)).size, OUTPUT_SIZE_PRESETS.length)
})

test('keeps a locked ratio when a corner is dragged past the image edge', () => {
  const bounds = { width: 835, height: 1172 }
  const rect = resizeCropRect('se', { x: 100, y: 100, width: 400, height: 400 }, 2000, 2000, 1, bounds)
  assert.equal(rect.width, rect.height)
  assert.deepEqual(rect, { x: 100, y: 100, width: 735, height: 735 })

  const tall = resizeCropRect('nw', { x: 300, y: 300, width: 200, height: 400 }, -1000, -1000, 0.5, bounds)
  assert.equal(tall.width / tall.height, 0.5)
  assert.equal(tall.x + tall.width, 500)
  assert.equal(tall.y + tall.height, 700)
})

test('keeps the opposite corner fixed when a freeform corner hits the edge', () => {
  const rect = resizeCropRect('se', { x: 100, y: 100, width: 200, height: 200 }, 5000, 50, null, { width: 1000, height: 800 })
  assert.deepEqual(rect, { x: 100, y: 100, width: 900, height: 250 })
})
