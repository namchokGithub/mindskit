import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyEdits,
  applySoftness,
  boxBlur,
  composeCutout,
  DEFAULT_REFINE_SETTINGS,
  edgeRefineParameters,
  estimateBackgroundColor,
  featherMask,
  fitWithin,
  fullRect,
  guidedFilter,
  rasterizeStrokes,
  refineMask,
  resizeAlpha,
  shiftEdge,
  toGray,
  type BrushStroke,
} from '../src/features/images/mask-refine.ts'

const near = (actual: number, expected: number, tolerance = 1e-4) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≈ ${expected}`)

/** width × height mask with a filled square [from, to) on both axes. */
function square(width: number, height: number, from: number, to: number, value = 1) {
  const alpha = new Float32Array(width * height)
  for (let y = from; y < to; y += 1) for (let x = from; x < to; x += 1) alpha[y * width + x] = value
  return alpha
}

test('fitWithin keeps the aspect ratio and never upscales', () => {
  assert.deepEqual(fitWithin(4000, 2000, 2048), { width: 2048, height: 1024, scale: 0.512 })
  assert.deepEqual(fitWithin(800, 600, 2048), { width: 800, height: 600, scale: 1 })
})

test('toGray uses luma weights', () => {
  const gray = toGray([255, 255, 255, 255, 255, 0, 0, 255], 2)
  near(gray[0], 1)
  near(gray[1], 0.299)
})

test('boxBlur keeps constants and averages only pixels inside the image', () => {
  const constant = new Float32Array(25).fill(0.4)
  for (const value of boxBlur(constant, 5, 5, 2)) near(value, 0.4)
  const line = Float32Array.from([1, 0, 0, 0])
  const blurred = boxBlur(line, 4, 1, 1)
  near(blurred[0], 0.5)
  near(blurred[1], 1 / 3)
  near(blurred[3], 0)
  assert.deepEqual([...boxBlur(line, 4, 1, 0)], [1, 0, 0, 0])
})

test('guidedFilter keeps a mask that already matches the guide edge and stays in 0–1', () => {
  const width = 20
  const guide = new Float32Array(width * width)
  for (let y = 0; y < width; y += 1) for (let x = 0; x < width; x += 1) guide[y * width + x] = x < 10 ? 0 : 1
  const out = guidedFilter(guide, guide.slice(), width, width, 3, 1e-4)
  near(out[5 * width + 2], 0, 0.01)
  near(out[5 * width + 17], 1, 0.01)
  near(out[5 * width + 9], 0, 0.05)
  near(out[5 * width + 10], 1, 0.05)
  for (const value of out) assert.ok(value >= 0 && value <= 1)
})

test('guidedFilter snaps a blurry mask edge to the guide edge', () => {
  const width = 24
  const guide = new Float32Array(width * width)
  const blurry = new Float32Array(width * width)
  for (let y = 0; y < width; y += 1) {
    for (let x = 0; x < width; x += 1) {
      guide[y * width + x] = x < 12 ? 0 : 1
      blurry[y * width + x] = Math.min(1, Math.max(0, (x - 8) / 8))
    }
  }
  const out = guidedFilter(guide, blurry, width, width, 4, 1e-4)
  const row = 12 * width
  // The step between x = 11 and x = 12 becomes much sharper than the input's.
  assert.ok(out[row + 12] - out[row + 11] > 2 * (blurry[row + 12] - blurry[row + 11]))
})

test('shiftEdge grows and shrinks the subject; the image border does not erode it', () => {
  const alpha = square(10, 10, 3, 7)
  const grown = shiftEdge(alpha, 10, 10, 1)
  assert.equal(grown[2 * 10 + 2], 1)
  assert.equal(grown[1 * 10 + 1], 0)
  const shrunk = shiftEdge(alpha, 10, 10, -1)
  assert.equal(shrunk[3 * 10 + 3], 0)
  assert.equal(shrunk[4 * 10 + 4], 1)
  assert.equal(shrunk[5 * 10 + 5], 1)
  assert.equal(shrunk[6 * 10 + 6], 0)
  const full = new Float32Array(16).fill(1)
  assert.ok(shiftEdge(full, 4, 4, -1).every((value) => value === 1))
  assert.deepEqual([...shiftEdge(alpha, 10, 10, 0)], [...alpha])
})

test('shiftEdge matches a brute-force min/max for larger radii', () => {
  const width = 17
  const height = 11
  const alpha = Float32Array.from({ length: width * height }, (_, i) => ((i * 7919) % 101) / 100)
  for (const pixels of [3, -3, 5]) {
    const out = shiftEdge(alpha, width, height, pixels)
    const r = Math.abs(pixels)
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let expected = pixels > 0 ? -Infinity : Infinity
        for (let dy = -r; dy <= r; dy += 1) {
          for (let dx = -r; dx <= r; dx += 1) {
            const sx = x + dx
            const sy = y + dy
            if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
            const value = alpha[sy * width + sx]
            expected = pixels > 0 ? Math.max(expected, value) : Math.min(expected, value)
          }
        }
        assert.equal(out[y * width + x], expected)
      }
    }
  }
})

test('applySoftness: 100 keeps the mask, 0 cuts at 50%, values between stretch the ramp', () => {
  const values = [0, 0.3, 0.5, 0.7, 1]
  assert.deepEqual([...applySoftness(Float32Array.from(values), 100)].map((v) => +v.toFixed(3)), values)
  assert.deepEqual([...applySoftness(Float32Array.from(values), 0)], [0, 0, 1, 1, 1])
  const half = applySoftness(Float32Array.from(values), 50)
  near(half[1], 0.1)
  near(half[2], 0.5)
  near(half[3], 0.9)
})

test('featherMask softens a hard edge and leaves it untouched at 0', () => {
  const alpha = square(12, 12, 4, 8)
  assert.equal(featherMask(alpha, 12, 12, 0), alpha)
  const feathered = featherMask(alpha, 12, 12, 4)
  const edge = feathered[6 * 12 + 4]
  assert.ok(edge > 0 && edge < 1)
  assert.ok(feathered[6 * 12 + 3] > 0)
})

test('edgeRefineParameters scale with strength and working size', () => {
  const weak = edgeRefineParameters(0, 1024, 1024)
  const strong = edgeRefineParameters(100, 1024, 1024)
  assert.equal(weak.radius, 2)
  assert.equal(strong.radius, 10)
  assert.ok(strong.epsilon < weak.epsilon)
  assert.equal(edgeRefineParameters(100, 2048, 1000).radius, 20)
})

test('refineMask with defaults off only rescales the model mask to 0–1', () => {
  const base = Uint8Array.from([0, 51, 255, 255])
  const refined = refineMask(base, null, 2, 2, { ...DEFAULT_REFINE_SETTINGS, edgeRefine: false })
  near(refined[0], 0)
  near(refined[1], 0.2)
  near(refined[2], 1)
  const hard = refineMask(base, null, 2, 2, { ...DEFAULT_REFINE_SETTINGS, edgeRefine: false, softness: 0 })
  assert.deepEqual([...hard], [0, 0, 1, 1])
})

test('estimateBackgroundColor averages clear-background pixels only', () => {
  const rgba = [10, 20, 30, 255, 30, 40, 50, 255, 200, 200, 200, 255]
  assert.deepEqual(estimateBackgroundColor(rgba, [0, 10, 255]), [20, 30, 40])
  assert.equal(estimateBackgroundColor(rgba, [255, 255, 255]), null)
})

test('brush strokes restore and erase over the refined mask; hardness controls the edge', () => {
  const width = 21
  const refined = new Float32Array(width * width).fill(0.5)
  const erase: BrushStroke = { mode: 'erase', radius: 4, hardness: 1, points: [10.5, 10.5] }
  const erased = applyEdits(refined, rasterizeStrokes([erase], width, width))
  near(erased[10 * width + 10], 0)
  near(erased[0], 0.5)
  const restored = applyEdits(refined, rasterizeStrokes([erase, { ...erase, mode: 'restore' }], width, width))
  near(restored[10 * width + 10], 1)
  const soft = applyEdits(refined, rasterizeStrokes([{ mode: 'restore', radius: 6, hardness: 0, points: [10.5, 10.5] }], width, width))
  near(soft[10 * width + 10], 1, 0.01)
  const ring = soft[10 * width + 14]
  assert.ok(ring > 0.5 && ring < 1, `soft edge ${ring}`)
})

test('a stroke covers the line between its points and does not build up where dabs overlap', () => {
  const width = 30
  const refined = new Float32Array(width * 10)
  const layer = rasterizeStrokes([{ mode: 'restore', radius: 2, hardness: 0.5, points: [2.5, 5.5, 27.5, 5.5] }], width, 10)
  const alpha = applyEdits(refined, layer)
  for (let x = 3; x < 27; x += 1) near(alpha[5 * width + x], 1, 0.01)
  for (const value of layer.weight) assert.ok(value <= 1)
  near(alpha[0], 0)
})

test('composeCutout applies alpha, edits, and despill', () => {
  const background: [number, number, number] = [0, 255, 0]
  // Edge pixel: 50% red foreground over green → (128, 128, 0).
  const rgba = new Uint8ClampedArray([128, 128, 0, 255, 50, 60, 70, 255])
  const refined = Float32Array.from([0.5, 1])
  const out = new Uint8ClampedArray(8)
  composeCutout(rgba, refined, null, background, 1, out, 2, fullRect(2, 1))
  assert.deepEqual([...out], [255, 1, 0, 128, 50, 60, 70, 255])
  composeCutout(rgba, refined, null, background, 0, out, 2, fullRect(2, 1))
  assert.deepEqual([...out.slice(0, 4)], [128, 128, 0, 128])
  const layer = { target: Float32Array.from([0, 0]), weight: Float32Array.from([0, 1]) }
  composeCutout(rgba, refined, layer, null, 0, out, 2, fullRect(2, 1))
  assert.equal(out[7], 0)
})

test('resizeAlpha keeps constants and interpolates between pixels', () => {
  const src = Float32Array.from([0, 1])
  assert.equal(resizeAlpha(src, 2, 1, 2, 1), src)
  const up = resizeAlpha(src, 2, 1, 4, 1)
  assert.deepEqual([...up].map((v) => +v.toFixed(2)), [0, 0.25, 0.75, 1])
  for (const value of resizeAlpha(new Float32Array(6).fill(0.7), 3, 2, 7, 5)) near(value, 0.7)
})
