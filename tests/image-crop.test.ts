import assert from 'node:assert/strict'
import test from 'node:test'

import {
  IDENTITY_TRANSFORM,
  MAX_CROP_FILE_SIZE,
  OUTPUT_SIZE_PRESETS,
  clampFreeAngle,
  fitAspectRatioKeepingArea,
  flipInScreenAxes,
  mapCropToTransform,
  maxInscribedRect,
  normalizeQuarterTurns,
  recenterCrop,
  resizeCropRect,
  resizeCropToDimensions,
  rotateCropRectQuarter,
  rotatedBoundingSize,
  totalRotation,
  validateCropFile,
  validateCropOutput,
  validateCropSourceSize,
  validateOutputSize,
  type CropRect,
  type ImageBounds,
  type ImageTransform,
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

test('re-fits a crop to a new ratio without collapsing it', () => {
  const bounds = { width: 1000, height: 1000 }
  const start = { x: 300, y: 300, width: 400, height: 400 }
  assert.deepEqual(fitAspectRatioKeepingArea(start, 4, bounds), { x: 100, y: 400, width: 800, height: 200 })
  const extreme = fitAspectRatioKeepingArea(start, 8 / 630, bounds)
  assert.equal(extreme.height, 1000)
  assert.ok(Math.abs(extreme.width - (1000 * 8) / 630) < 1e-9)
  // Re-fitting from the same start (not the extreme result) restores a usable crop with the same area.
  const restored = fitAspectRatioKeepingArea(start, 2, bounds)
  assert.ok(Math.abs(restored.width * restored.height - 160_000) < 1e-6)
  assert.ok(Math.abs(restored.width / restored.height - 2) < 1e-9)
  assert.ok(Math.abs(restored.x + restored.width / 2 - 500) < 1e-9)
})

test('resizes a locked-ratio crop from a vertical-only corner drag', () => {
  const bounds = { width: 1000, height: 1000 }
  const start = { x: 100, y: 100, width: 200, height: 200 }
  assert.deepEqual(resizeCropRect('se', start, 0, 100, 1, bounds), { x: 100, y: 100, width: 300, height: 300 })
  assert.deepEqual(resizeCropRect('nw', { x: 300, y: 300, width: 200, height: 200 }, 0, -50, 1, bounds), { x: 250, y: 250, width: 250, height: 250 })
  // A horizontal-only drag still drives the size, including shrinking.
  assert.deepEqual(resizeCropRect('se', start, -100, 0, 1, bounds), { x: 100, y: 100, width: 100, height: 100 })
  // A vertical drag past the edge is still limited by the room on both axes.
  const wide = resizeCropRect('se', { x: 700, y: 100, width: 200, height: 100 }, 0, 5000, 2, bounds)
  assert.deepEqual(wide, { x: 700, y: 100, width: 300, height: 150 })
})

/** Rotates a point clockwise (screen axes, y down) about the center of `from`, placing it in the turned box `to`. */
function rotatePoint(point: { x: number; y: number }, from: ImageBounds, to: ImageBounds, degrees: number) {
  const radians = (degrees * Math.PI) / 180
  const dx = point.x - from.width / 2
  const dy = point.y - from.height / 2
  return { x: to.width / 2 + dx * Math.cos(radians) - dy * Math.sin(radians), y: to.height / 2 + dx * Math.sin(radians) + dy * Math.cos(radians) }
}

function corners(rect: CropRect) {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ]
}

function assertSameCorners(rect: CropRect, points: { x: number; y: number }[]) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  assert.ok(Math.abs(rect.x - Math.min(...xs)) < 1e-9 && Math.abs(rect.x + rect.width - Math.max(...xs)) < 1e-9, JSON.stringify(rect))
  assert.ok(Math.abs(rect.y - Math.min(...ys)) < 1e-9 && Math.abs(rect.y + rect.height - Math.max(...ys)) < 1e-9, JSON.stringify(rect))
}

test('turns a crop with the image by +90° and −90° on a non-square image', () => {
  const bounds = { width: 400, height: 200 }
  const turned = { width: 200, height: 400 }
  const rect = { x: 10, y: 20, width: 100, height: 50 }

  const clockwise = rotateCropRectQuarter(rect, bounds, 1)
  assert.deepEqual(clockwise, { x: 130, y: 10, width: 50, height: 100 })
  assertSameCorners(clockwise, corners(rect).map((point) => rotatePoint(point, bounds, turned, 90)))

  const counterclockwise = rotateCropRectQuarter(rect, bounds, -1)
  assert.deepEqual(counterclockwise, { x: 20, y: 290, width: 50, height: 100 })
  assertSameCorners(counterclockwise, corners(rect).map((point) => rotatePoint(point, bounds, turned, -90)))

  // A turn and its inverse restore the crop; four clockwise turns are the identity.
  assert.deepEqual(rotateCropRectQuarter(clockwise, turned, -1), rect)
  let spun: CropRect = rect
  let spunBounds: ImageBounds = bounds
  for (let index = 0; index < 4; index++) {
    spun = rotateCropRectQuarter(spun, spunBounds, 1)
    spunBounds = { width: spunBounds.height, height: spunBounds.width }
  }
  assert.deepEqual(spun, rect)
})

test('carries the crop through quarter turns of the transform', () => {
  const size = { width: 400, height: 200 }
  const rect = { x: 10, y: 20, width: 100, height: 50 }
  const turnedRight = { ...IDENTITY_TRANSFORM, quarterTurns: 1 }
  const turnedLeft = { ...IDENTITY_TRANSFORM, quarterTurns: 3 }
  assert.deepEqual(mapCropToTransform(rect, size, IDENTITY_TRANSFORM, turnedRight, null), { x: 130, y: 10, width: 50, height: 100 })
  assert.deepEqual(mapCropToTransform(rect, size, IDENTITY_TRANSFORM, turnedLeft, null), { x: 20, y: 290, width: 50, height: 100 })
  // A half turn maps every corner through 180°.
  assert.deepEqual(mapCropToTransform(rect, size, IDENTITY_TRANSFORM, { ...IDENTITY_TRANSFORM, quarterTurns: 2 }, null), { x: 290, y: 130, width: 100, height: 50 })

  // With a free angle, the turn happens in the tilted bounding box.
  const tilted = { ...IDENTITY_TRANSFORM, angle: 10 }
  const tiltedBounds = rotatedBoundingSize(size, 10)
  const tiltedRect = { x: 50, y: 40, width: 120, height: 60 }
  const turnedTilted = mapCropToTransform(tiltedRect, size, tilted, { ...tilted, quarterTurns: 1 }, null)
  assertSameCorners(turnedTilted, corners(tiltedRect).map((point) => rotatePoint(point, tiltedBounds, rotatedBoundingSize(size, 100), 90)))
})

test('re-fits a locked ratio around the same center after a quarter turn', () => {
  const size = { width: 1600, height: 900 }
  const rect = { x: 400, y: 200, width: 640, height: 360 }
  const next = mapCropToTransform(rect, size, IDENTITY_TRANSFORM, { ...IDENTITY_TRANSFORM, quarterTurns: 1 }, 16 / 9)
  assert.ok(Math.abs(next.width / next.height - 16 / 9) < 1e-9)
  assert.ok(Math.abs(next.width * next.height - 640 * 360) < 1e-6)
  // Same content center as the turned crop: (900 − 200 − 180, 400 + 320) in the 900 × 1600 box.
  assert.ok(Math.abs(next.x + next.width / 2 - 520) < 1e-9)
  assert.ok(Math.abs(next.y + next.height / 2 - 720) < 1e-9)
  assert.ok(next.x >= 0 && next.x + next.width <= 900 && next.y >= 0 && next.y + next.height <= 1600)
})

test('keeps the crop size and center when the free angle changes', () => {
  const size = { width: 1000, height: 500 }
  const from = rotatedBoundingSize(size, 0)
  const to = rotatedBoundingSize(size, 20)
  const rect = { x: 300, y: 100, width: 200, height: 100 }
  const moved = recenterCrop(rect, from, to, null)
  assert.equal(moved.width, 200)
  assert.equal(moved.height, 100)
  assert.ok(Math.abs(moved.x + moved.width / 2 - to.width / 2 - (400 - 500)) < 1e-9)
  assert.ok(Math.abs(moved.y + moved.height / 2 - to.height / 2 - (150 - 250)) < 1e-9)
  assert.deepEqual(mapCropToTransform(rect, size, IDENTITY_TRANSFORM, { ...IDENTITY_TRANSFORM, angle: 20 }, null), moved)

  // Going back restores the crop exactly when nothing had to be clamped.
  assert.deepEqual(recenterCrop(moved, to, from, null), rect)
})

test('clamps a recentered crop into smaller bounds and keeps a locked ratio', () => {
  const from = { width: 1200, height: 800 }
  const to = { width: 1000, height: 600 }
  const free = recenterCrop({ x: 0, y: 0, width: 1100, height: 400 }, from, to, null)
  assert.deepEqual(free, { x: 0, y: 0, width: 1000, height: 400 })

  const locked = recenterCrop({ x: 100, y: 100, width: 1000, height: 500 }, from, to, 2)
  assert.ok(Math.abs(locked.width / locked.height - 2) < 1e-9)
  assert.ok(locked.width <= 1000 && locked.height <= 600)
  assert.ok(locked.x >= 0 && locked.y >= 0 && locked.x + locked.width <= 1000 && locked.y + locked.height <= 600)
})

/** The matrix the preview CSS and `renderCropToBlob` apply: rotate(θ) after scale(flip), i.e. R(θ)·F. */
function screenMatrix(transform: ImageTransform): number[] {
  const radians = (totalRotation(transform) * Math.PI) / 180
  const sx = transform.flipH ? -1 : 1
  const sy = transform.flipV ? -1 : 1
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return [cos * sx, -sin * sy, sin * sx, cos * sy]
}

function assertMatrix(actual: number[], expected: number[]) {
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9, `${actual} vs ${expected}`))
}

test('flips in screen axes whatever the rotation', () => {
  const transforms: ImageTransform[] = [
    IDENTITY_TRANSFORM,
    { quarterTurns: 1, angle: 0, flipH: false, flipV: false },
    { quarterTurns: 3, angle: 12.5, flipH: true, flipV: false },
    { quarterTurns: 2, angle: -30, flipH: false, flipV: true },
  ]
  for (const transform of transforms) {
    const [a, b, c, d] = screenMatrix(transform)
    // Mirroring the screen negates the x row (horizontal) or the y row (vertical).
    assertMatrix(screenMatrix(flipInScreenAxes(transform, 'horizontal')), [-a, -b, c, d])
    assertMatrix(screenMatrix(flipInScreenAxes(transform, 'vertical')), [a, b, -c, -d])
    // The bounding box keeps its size, so the crop can stay in place.
    const size = { width: 640, height: 360 }
    assert.deepEqual(rotatedBoundingSize(size, totalRotation(flipInScreenAxes(transform, 'horizontal'))), rotatedBoundingSize(size, totalRotation(transform)))
  }

  // Without rotation it is a plain flip; flipping twice restores the transform.
  assert.deepEqual(flipInScreenAxes(IDENTITY_TRANSFORM, 'horizontal'), { ...IDENTITY_TRANSFORM, flipH: true })
  const turned = { quarterTurns: 1, angle: 10, flipH: false, flipV: false }
  assert.deepEqual(flipInScreenAxes(turned, 'horizontal'), { quarterTurns: 3, angle: -10, flipH: true, flipV: false })
  assert.deepEqual(flipInScreenAxes(flipInScreenAxes(turned, 'vertical'), 'vertical'), turned)
})

test('rejects oversized files and images like Image Resize', () => {
  assert.equal(MAX_CROP_FILE_SIZE, 20 * 1024 * 1024)
  assert.equal(validateCropFile({ type: 'image/png', size: MAX_CROP_FILE_SIZE }), null)
  assert.equal(validateCropFile({ type: 'image/gif', size: 1024 }), null)
  assert.match(validateCropFile({ type: 'image/jpeg', size: MAX_CROP_FILE_SIZE + 1 }) ?? '', /20 MiB/)
  assert.match(validateCropFile({ type: 'text/plain', size: 10 }) ?? '', /image file/)

  assert.equal(validateCropSourceSize({ width: 10_000, height: 10_000 }), null)
  assert.match(validateCropSourceSize({ width: 10_001, height: 200 }) ?? '', /10,000 px/)
  assert.match(validateCropSourceSize({ width: 200, height: 12_000 }) ?? '', /10,000 px/)
})

test('limits the exported size per side and in total pixels', () => {
  assert.equal(validateOutputSize({ width: 4096, height: 4096 }), null)
  assert.match(validateOutputSize({ width: 4097, height: 4096 }) ?? '', /16,777,216 pixels/)
  assert.match(validateOutputSize({ width: 10_000, height: 2000 }) ?? '', /16,777,216 pixels/)
  for (const preset of OUTPUT_SIZE_PRESETS) assert.ok(preset.width * preset.height <= 16_777_216, preset.id)

  assert.equal(validateCropOutput({ width: 4000, height: 4000 }), null)
  assert.equal(validateCropOutput({ width: 4096.4, height: 4095.6 }), null)
  assert.match(validateCropOutput({ width: 10_001, height: 100 }) ?? '', /10001 × 100 px.*10,000 px per side/)
  assert.match(validateCropOutput({ width: 5000, height: 5000 }) ?? '', /5000 × 5000 px.*16,777,216 pixels in total/)
})
