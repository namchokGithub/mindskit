import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateResizeDimensions,
  exportResizeFileName,
  resolveResizeMimeType,
  validateImageForResize,
  validateResizeDimensions,
} from '../src/features/images/resize.ts'
import * as resize from '../src/features/images/resize.ts'

test('derives a locked height from an edited pixel width', () => {
  assert.deepEqual(
    calculateResizeDimensions(
      { width: 1_920, height: 1_080 },
      { mode: 'pixels', width: 1_280, height: 1_080, keepAspectRatio: true, changedDimension: 'width' },
    ),
    { width: 1_280, height: 720 },
  )
})

test('derives dimensions from a percentage', () => {
  assert.deepEqual(
    calculateResizeDimensions(
      { width: 1_920, height: 1_080 },
      { mode: 'percentage', percentage: 50 },
    ),
    { width: 960, height: 540 },
  )
})

test('keeps independent pixel dimensions when aspect ratio is disabled', () => {
  assert.deepEqual(
    calculateResizeDimensions(
      { width: 1_920, height: 1_080 },
      { mode: 'pixels', width: 1_280, height: 800, keepAspectRatio: false, changedDimension: 'width' },
    ),
    { width: 1_280, height: 800 },
  )
})

test('accepts a pixel width without a stored height when aspect ratio is locked', () => {
  assert.deepEqual(
    resize.resolvePixelResizeDimensions?.(
      { width: 1_920, height: 1_080 },
      { width: 32, height: Number.NaN, keepAspectRatio: true, changedDimension: 'width' },
    ),
    { width: 32, height: 18 },
  )
})

test('uses an exportable source type for keep-original and produces a per-size filename', () => {
  assert.equal(resolveResizeMimeType('image/png', 'original'), 'image/png')
  assert.equal(resolveResizeMimeType('image/heic', 'original'), 'image/png')
  assert.equal(exportResizeFileName('holiday.photo.png', { width: 1_280, height: 720 }, 'image/jpeg'), 'holiday.photo-1280x720.jpg')
})

test('rejects an oversized image before decoding it', () => {
  assert.equal(validateImageForResize({ type: 'image/png', size: 20 * 1024 * 1024 + 1 }), 'Images must be 20 MiB or smaller.')
})

test('rejects an output dimension beyond the canvas safety limit', () => {
  assert.equal(validateResizeDimensions({ width: 10_001, height: 500 }), 'Output dimensions must be 10,000 px or smaller.')
})

test('allows adding sizes only until the export list reaches ten items', () => {
  assert.equal(resize.canAddResizeJob?.(9), true)
  assert.equal(resize.canAddResizeJob?.(10), false)
})
