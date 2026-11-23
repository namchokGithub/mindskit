import assert from 'node:assert/strict'
import { test } from 'node:test'

import { clearImageHandoff, handoffFileName, handoffValidationInput, peekImageHandoff, sendImage, toHandoffFile } from '../src/features/images/handoff.ts'
import { hasTransparentPixel, validateImageForResize } from '../src/features/images/resize.ts'

test('a handed-off image is only visible to its target tool and stays until cleared', () => {
  const file = new File(['x'], 'cut.png', { type: 'image/png' })
  const handoff = sendImage(file, 'Remove Background', '/images/crop')
  assert.equal(peekImageHandoff('/images/resize'), null)
  // Reading does not consume it (StrictMode mounts the page twice in development).
  assert.equal(peekImageHandoff('/images/crop')?.file, file)
  assert.equal(peekImageHandoff('/images/crop')?.from, 'Remove Background')
  clearImageHandoff(handoff.id)
  assert.equal(peekImageHandoff('/images/crop'), null)
})

test('a newer handoff replaces an older one, and clearing the old id keeps the new one', () => {
  const first = sendImage(new File(['a'], 'a.png', { type: 'image/png' }), 'Image Crop', '/images/resize')
  const second = sendImage(new File(['b'], 'b.png', { type: 'image/png' }), 'Image Crop', '/images/favicon-generator')
  assert.notEqual(first.id, second.id)
  assert.equal(peekImageHandoff('/images/resize'), null)
  clearImageHandoff(first.id)
  assert.equal(peekImageHandoff('/images/favicon-generator')?.id, second.id)
  clearImageHandoff(second.id)
})

test('handed-off files are PNG with a .png name', () => {
  assert.equal(handoffFileName('photo-cropped.jpg'), 'photo-cropped.png')
  assert.equal(handoffFileName('logo'), 'logo.png')
  assert.equal(handoffFileName('.png'), 'image.png')
  const file = toHandoffFile(new Blob(['x'], { type: 'image/jpeg' }), 'photo.webp')
  assert.equal(file.name, 'photo.png')
  assert.equal(file.type, 'image/png')
})

test('handed-off files skip the 20 MiB upload limit but keep the type check', () => {
  const large = { type: 'image/png', size: 25 * 1024 * 1024 }
  const file = large as unknown as File
  assert.equal(validateImageForResize(handoffValidationInput(file, false)), 'Images must be 20 MiB or smaller.')
  assert.equal(validateImageForResize(handoffValidationInput(file, true)), null)
  const gif = { type: 'image/gif', size: 10 } as unknown as File
  assert.equal(validateImageForResize(handoffValidationInput(gif, true)), 'Choose a PNG, JPEG, or WebP image.')
})

test('hasTransparentPixel finds any pixel below full opacity', () => {
  assert.equal(hasTransparentPixel([0, 0, 0, 255, 10, 10, 10, 255]), false)
  assert.equal(hasTransparentPixel([0, 0, 0, 255, 10, 10, 10, 254]), true)
  assert.equal(hasTransparentPixel([]), false)
})
