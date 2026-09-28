import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_DESIGN,
  backgroundCss,
  clampPadding,
  clampPerspective,
  clampRadius,
  clampScale,
  mergePersistedPreferences,
  normalizeDesign,
  resetDesign,
  serializePersistedPreferences,
  type ScreenshotDesign,
} from '../src/features/screenshot-beautifier/model.ts'

test('clamps design values into their supported ranges', () => {
  assert.equal(clampPadding(-10), 0)
  assert.equal(clampPadding(500), 200)
  assert.equal(clampRadius(Number.NaN), 0)
  assert.equal(clampScale(10), 50)
  assert.equal(clampScale(999), 120)
  assert.equal(clampPerspective(-40), -15)
  assert.equal(clampPerspective(40), 15)
})

test('normalizeDesign clamps every numeric field without mutating the input', () => {
  const dirty: ScreenshotDesign = { ...DEFAULT_DESIGN, padding: -5, radius: 999, scale: 1, perspectiveX: 99, perspectiveY: -99 }
  const normalized = normalizeDesign(dirty)
  assert.deepEqual(normalized, { ...DEFAULT_DESIGN, padding: 0, radius: 48, scale: 50, perspectiveX: 15, perspectiveY: -15 })
  assert.equal(dirty.padding, -5)
})

test('resetDesign returns a fresh, independent copy of the defaults', () => {
  const a = resetDesign()
  const b = resetDesign()
  assert.deepEqual(a, DEFAULT_DESIGN)
  assert.notEqual(a, DEFAULT_DESIGN)
  assert.notEqual(a.background, b.background)
})

test('backgroundCss renders a solid color or a linear-gradient string', () => {
  assert.equal(backgroundCss({ type: 'solid', color: '#112233', gradientFrom: '#000', gradientTo: '#fff', gradientAngle: 90, gradientPresetId: null }), '#112233')
  assert.equal(
    backgroundCss({ type: 'gradient', color: '#000', gradientFrom: '#7C3AED', gradientTo: '#3B82F6', gradientAngle: 135, gradientPresetId: null }),
    'linear-gradient(135deg, #7C3AED, #3B82F6)',
  )
})

test('serializePersistedPreferences keeps only canvasPreset, gradientPresetId, and frame', () => {
  const json = serializePersistedPreferences({ ...DEFAULT_DESIGN, canvasPreset: '1:1', frame: 'browser-macos' })
  assert.deepEqual(JSON.parse(json), { canvasPreset: '1:1', gradientPresetId: DEFAULT_DESIGN.background.gradientPresetId, frame: 'browser-macos' })
})

test('mergePersistedPreferences ignores invalid or unparsable stored preferences', () => {
  assert.deepEqual(mergePersistedPreferences(DEFAULT_DESIGN, ''), DEFAULT_DESIGN)
  assert.deepEqual(mergePersistedPreferences(DEFAULT_DESIGN, 'not json'), DEFAULT_DESIGN)
  assert.deepEqual(mergePersistedPreferences(DEFAULT_DESIGN, '{"canvasPreset":123}'), DEFAULT_DESIGN)
})

test('mergePersistedPreferences applies a known canvas preset and frame', () => {
  const merged = mergePersistedPreferences(DEFAULT_DESIGN, JSON.stringify({ canvasPreset: '1:1', gradientPresetId: null, frame: 'device-laptop' }))
  assert.equal(merged.canvasPreset, '1:1')
  assert.equal(merged.frame, 'device-laptop')
})

import {
  CANVAS_SIZE_PRESETS,
  findCanvasSizePreset,
  findGradientPreset,
  FRAME_CHROME,
  GRADIENT_PRESETS,
  SHADOW_CSS,
} from '../src/features/screenshot-beautifier/presets.ts'

test('exposes 6 named gradient presets that resolve by id', () => {
  assert.equal(GRADIENT_PRESETS.length, 6)
  assert.equal(findGradientPreset('midnight-violet')?.from, '#4C1D95')
  assert.equal(findGradientPreset('unknown-id'), undefined)
})

test('canvas size presets: auto has no fixed size, named presets do', () => {
  assert.deepEqual(findCanvasSizePreset('auto'), { id: 'auto', label: 'Auto', width: null, height: null })
  assert.deepEqual(findCanvasSizePreset('1:1'), CANVAS_SIZE_PRESETS.find((preset) => preset.id === '1:1'))
  assert.equal(findCanvasSizePreset('1:1').width, 1200)
  assert.equal(findCanvasSizePreset('instagram-portrait').height, 1350)
})

test('shadow levels map to CSS box-shadow values, with none disabling it', () => {
  assert.equal(SHADOW_CSS.none, 'none')
  assert.notEqual(SHADOW_CSS.soft, 'none')
  assert.notEqual(SHADOW_CSS.medium, SHADOW_CSS.strong)
})

test('frame chrome geometry has zero inset for none and browser frames only add top height', () => {
  assert.deepEqual(FRAME_CHROME.none, { top: 0, right: 0, bottom: 0, left: 0 })
  assert.equal(FRAME_CHROME['browser-minimal'].right, 0)
  assert.ok(FRAME_CHROME['browser-minimal'].top > 0)
  assert.ok(FRAME_CHROME['device-laptop'].bottom > FRAME_CHROME['device-laptop'].top)
})

import { resolveCanvasSize, resolveExportPixelRatio, resolveFittedScreenshotSize } from '../src/features/screenshot-beautifier/layout.ts'

test('resolveCanvasSize uses the fixed preset size regardless of the screenshot', () => {
  const size = resolveCanvasSize({ canvasPreset: '1:1', padding: 64, scale: 100, frame: 'none' }, { width: 3000, height: 500 })
  assert.deepEqual(size, { width: 1200, height: 1200 })
})

test('resolveCanvasSize computes an Auto canvas from the scaled screenshot, padding, and frame chrome', () => {
  const size = resolveCanvasSize({ canvasPreset: 'auto', padding: 64, scale: 50, frame: 'browser-minimal' }, { width: 2000, height: 1000 })
  assert.deepEqual(size, { width: 1000 + 128, height: 500 + 28 + 128 })
})

test('resolveFittedScreenshotSize preserves aspect ratio and never overflows the available area', () => {
  const canvas = { width: 800, height: 800 }
  const fitted = resolveFittedScreenshotSize(canvas, 64, { top: 0, right: 0, bottom: 0, left: 0 }, { width: 2000, height: 1000 }, 100)
  assert.ok(fitted.width <= canvas.width - 128)
  assert.ok(fitted.height <= canvas.height - 128)
  assert.equal(Math.round((fitted.width / fitted.height) * 100) / 100, 2)
})

test('resolveFittedScreenshotSize never returns zero or negative size for a degenerate canvas', () => {
  const fitted = resolveFittedScreenshotSize({ width: 10, height: 10 }, 64, { top: 0, right: 0, bottom: 0, left: 0 }, { width: 2000, height: 1000 }, 100)
  assert.ok(fitted.width > 0)
  assert.ok(fitted.height > 0)
})

test('resolveExportPixelRatio targets 2x but caps the longest exported edge', () => {
  assert.equal(resolveExportPixelRatio({ width: 1200, height: 675 }), 2)
  assert.equal(resolveExportPixelRatio({ width: 3000, height: 3000 }, 2, 4096), Math.min(2, 4096 / 3000))
  assert.ok(resolveExportPixelRatio({ width: 3000, height: 3000 }, 2, 4096) >= 1)
})

test('resolveExportPixelRatio never divides by zero for a degenerate canvas', () => {
  const ratio = resolveExportPixelRatio({ width: 0, height: 0 })
  assert.ok(Number.isFinite(ratio))
  assert.ok(ratio >= 1)
})

test('resolveExportPixelRatio downscales below 1x when the canvas itself exceeds maxEdge', () => {
  const ratio = resolveExportPixelRatio({ width: 12000, height: 2000 }, 2, 4096)
  assert.ok(ratio < 1)
  assert.ok(12000 * ratio <= 4096 + 0.001)
})

import { extractImageFileFromClipboard, formatFileSize, validateScreenshotDimensions, validateScreenshotFile } from '../src/features/screenshot-beautifier/image.ts'

test('validateScreenshotFile accepts PNG/JPEG/WebP under the size limit', () => {
  assert.equal(validateScreenshotFile({ type: 'image/png', size: 1024 }), null)
  assert.equal(validateScreenshotFile({ type: 'image/heic', size: 1024 }), 'Choose a PNG, JPEG, or WebP image.')
  assert.equal(validateScreenshotFile({ type: 'image/png', size: 20 * 1024 * 1024 + 1 }), 'Images must be 20 MiB or smaller.')
})

test('validateScreenshotDimensions rejects images over the safety limit', () => {
  assert.equal(validateScreenshotDimensions({ width: 500, height: 500 }), null)
  assert.equal(validateScreenshotDimensions({ width: 10_001, height: 500 }), 'Images must be 10,000 px or smaller on each side.')
})

test('extractImageFileFromClipboard returns the first image file, or null when none is present', () => {
  const imageFile = new File(['x'], 'shot.png', { type: 'image/png' })
  const withImage = [
    { kind: 'string', type: 'text/plain', getAsFile: () => null },
    { kind: 'file', type: 'image/png', getAsFile: () => imageFile },
  ]
  assert.equal(extractImageFileFromClipboard(withImage), imageFile)

  const textOnly = [{ kind: 'string', type: 'text/plain', getAsFile: () => null }]
  assert.equal(extractImageFileFromClipboard(textOnly), null)
  assert.equal(extractImageFileFromClipboard([]), null)
})

test('formatFileSize renders bytes, KB, and MB', () => {
  assert.equal(formatFileSize(512), '512 B')
  assert.equal(formatFileSize(2048), '2.0 KB')
  assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 MB')
})

import { exportScreenshotFileName } from '../src/features/screenshot-beautifier/export.ts'

test('exportScreenshotFileName falls back to a generic name, or derives one from the original file', () => {
  assert.equal(exportScreenshotFileName(null, 'png'), 'mindskit-screenshot.png')
  assert.equal(exportScreenshotFileName('my-dashboard.png', 'jpg'), 'my-dashboard-beautified.jpg')
  assert.equal(exportScreenshotFileName('archive.tar.png', 'png'), 'archive.tar-beautified.png')
})
