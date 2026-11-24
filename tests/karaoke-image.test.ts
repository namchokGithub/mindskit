import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_KARAOKE_FORMAT } from '../src/features/thai-karaoke/formatter.ts'
import {
  clearKaraokeLinesHandoff,
  pairConverterLines,
  parseKaraokeLines,
  peekKaraokeLinesHandoff,
  resolveKaraokeLines,
  sendKaraokeLines,
  serializeKaraokeLines,
} from '../src/features/thai-karaoke/image-lines.ts'
import {
  DEFAULT_KARAOKE_IMAGE_DESIGN,
  MAX_OUTPUT_AREA,
  karaokeImageFileName,
  layoutKaraokeText,
  resolveOutputSize,
  resolveSourceCrop,
  type KaraokeImageDesign,
} from '../src/features/thai-karaoke/image-model.ts'

const design = (patch: Partial<KaraokeImageDesign> = {}): KaraokeImageDesign => ({ ...DEFAULT_KARAOKE_IMAGE_DESIGN, ...patch })
// Fake measurement: every character is half the font size wide.
const measure = (text: string, fontPx: number) => text.length * fontPx * 0.5

test('crops the source to the aspect ratio around the center', () => {
  assert.deepEqual(resolveSourceCrop({ width: 4000, height: 3000 }, 'original'), { x: 0, y: 0, width: 4000, height: 3000 })
  assert.deepEqual(resolveSourceCrop({ width: 4000, height: 3000 }, '1:1'), { x: 500, y: 0, width: 3000, height: 3000 })
  assert.deepEqual(resolveSourceCrop({ width: 1600, height: 1600 }, '16:9'), { x: 0, y: 350, width: 1600, height: 900 })
  assert.deepEqual(resolveSourceCrop({ width: 1600, height: 1600 }, '9:16'), { x: 350, y: 0, width: 900, height: 1600 })
})

test('scales the output down to the resolution and canvas limits, never up', () => {
  assert.deepEqual(resolveOutputSize({ width: 4000, height: 3000 }, '1920'), { width: 1920, height: 1440 })
  assert.deepEqual(resolveOutputSize({ width: 800, height: 600 }, '1920'), { width: 800, height: 600 })
  assert.deepEqual(resolveOutputSize({ width: 3000, height: 4000 }, '720'), { width: 540, height: 720 })
  const large = resolveOutputSize({ width: 9000, height: 6000 }, 'original')
  assert.ok(large.width * large.height <= MAX_OUTPUT_AREA)
  assert.ok(Math.abs(large.width / large.height - 1.5) < 0.01)
})

test('stacks Thai above its reading and anchors the block to the chosen position', () => {
  const canvas = { width: 1000, height: 1000 }
  const lines = [{ thai: 'รัก', karaoke: 'rak' }]
  const bottom = layoutKaraokeText(lines, design({ position: 'bottom', thaiSize: 10, karaokeSize: 5, lineSpacing: 0 }), canvas, measure)
  assert.deepEqual(bottom.items.map((item) => item.kind), ['thai', 'karaoke'])
  // Thai row 100 × 1.5 = 150, karaoke row 50 × 1.3 = 65, bottom margin 50.
  assert.equal(bottom.block?.y, 1000 - 50 - 215)
  assert.equal(bottom.items[0].y, 735 + 75)
  assert.equal(bottom.items[1].y, 735 + 150 + 32.5)
  assert.equal(bottom.items[0].x, 500)

  const top = layoutKaraokeText(lines, design({ position: 'top', align: 'left' }), canvas, measure)
  assert.equal(top.block?.y, 50)
  assert.equal(top.items[0].x, 50)
  const right = layoutKaraokeText(lines, design({ align: 'right' }), canvas, measure)
  assert.equal(right.items[0].x, 950)
})

test('hides rows that are turned off or empty and shrinks only lines that are too wide', () => {
  const canvas = { width: 1000, height: 1000 }
  const lines = [
    { thai: 'ก'.repeat(100), karaoke: 'short' },
    { thai: '', karaoke: '' },
  ]
  const layout = layoutKaraokeText(lines, design({ thaiSize: 10, karaokeSize: 5 }), canvas, measure)
  assert.equal(layout.items.length, 2)
  // 100 chars × 100 px × 0.5 = 5000 px wide; available width 900 → font shrinks to 18 px.
  assert.equal(layout.items[0].fontPx, 18)
  assert.equal(layout.items[1].fontPx, 50)

  const noThai = layoutKaraokeText(lines, design({ showThai: false }), canvas, measure)
  assert.deepEqual(noThai.items.map((item) => item.kind), ['karaoke'])
  const empty = layoutKaraokeText(lines, design({ showThai: false, showKaraoke: false }), canvas, measure)
  assert.deepEqual(empty, { items: [], block: null, overlay: null })
})

test('places the overlay as a padded band or the full image', () => {
  const canvas = { width: 1000, height: 1000 }
  const lines = [{ thai: 'รัก', karaoke: 'rak' }]
  const band = layoutKaraokeText(lines, design({ overlay: 'band', position: 'top' }), canvas, measure)
  assert.equal(band.overlay?.x, 0)
  assert.equal(band.overlay?.width, 1000)
  assert.equal(band.overlay?.y, 50 - 30)
  const full = layoutKaraokeText(lines, design({ overlay: 'full' }), canvas, measure)
  assert.deepEqual(full.overlay, { x: 0, y: 0, width: 1000, height: 1000 })
  assert.equal(layoutKaraokeText(lines, design({ overlay: 'none' }), canvas, measure).overlay, null)
})

test('generates readings for lines without a typed reading', () => {
  const resolved = resolveKaraokeLines(
    [
      { id: 1, thai: 'ฉันรักเธอ', karaoke: null },
      { id: 2, thai: 'เธอ', karaoke: 'TER' },
      { id: 3, thai: '  ', karaoke: null },
    ],
    { ...DEFAULT_KARAOKE_FORMAT, style: 'casual', syllableSeparator: '-' },
  )
  assert.deepEqual(resolved, [
    { thai: 'ฉันรักเธอ', karaoke: 'chan rak ther' },
    { thai: 'เธอ', karaoke: 'TER' },
    { thai: '  ', karaoke: '' },
  ])
})

test('stores only line text and ignores malformed stored values', () => {
  const stored = serializeKaraokeLines([{ id: 7, thai: 'รัก', karaoke: null }])
  assert.equal(stored, '[{"thai":"รัก","karaoke":null}]')
  assert.deepEqual(parseKaraokeLines(stored), [{ thai: 'รัก', karaoke: null }])
  assert.deepEqual(parseKaraokeLines('not json'), [])
  assert.deepEqual(parseKaraokeLines('[{"thai":1},{"thai":"ดี","karaoke":"di"}]'), [{ thai: 'ดี', karaoke: 'di' }])
})

test('pairs converter input and output lines and hands them off in memory', () => {
  assert.deepEqual(pairConverterLines('รัก\n\nเธอ ', 'rak\n\nthoe'), [
    { thai: 'รัก', karaoke: 'rak' },
    { thai: 'เธอ', karaoke: 'thoe' },
  ])
  const handoff = sendKaraokeLines([{ thai: 'รัก', karaoke: 'rak' }])
  assert.equal(peekKaraokeLinesHandoff(), handoff)
  clearKaraokeLinesHandoff(handoff.id + 1)
  assert.equal(peekKaraokeLinesHandoff(), handoff)
  clearKaraokeLinesHandoff(handoff.id)
  assert.equal(peekKaraokeLinesHandoff(), null)
})

test('names exported files after the source image', () => {
  assert.equal(karaokeImageFileName('beach.photo.jpg', 'png'), 'beach.photo-karaoke.png')
  assert.equal(karaokeImageFileName(null, 'jpg'), 'mindskit-karaoke.jpg')
})
