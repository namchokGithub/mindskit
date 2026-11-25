import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_KARAOKE_FORMAT } from '../src/features/thai-karaoke/formatter.ts'
import {
  clearKaraokeLinesHandoff,
  editKaraokeLine,
  pairConverterLines,
  parseKaraokeLines,
  peekKaraokeLinesHandoff,
  resolveKaraokeLines,
  sendKaraokeLines,
  serializeKaraokeLines,
  toggleHighlight,
} from '../src/features/thai-karaoke/image-lines.ts'
import {
  DEFAULT_KARAOKE_IMAGE_DESIGN,
  MAX_OUTPUT_AREA,
  dragTextBlock,
  hitTestText,
  itemLeft,
  karaokeImageFileName,
  layoutKaraokeText,
  readingColorRuns,
  readingSyllables,
  splitReadingRuns,
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
      { thai: 'ฉันรักเธอ', karaoke: null, highlights: [1] },
      { thai: 'เธอ', karaoke: 'TER', highlights: [] },
      { thai: '  ', karaoke: null, highlights: [] },
    ],
    { ...DEFAULT_KARAOKE_FORMAT, style: 'casual', syllableSeparator: '-' },
  )
  assert.deepEqual(resolved, [
    { thai: 'ฉันรักเธอ', karaoke: 'chan rak ther', highlights: [1] },
    { thai: 'เธอ', karaoke: 'TER', highlights: [] },
    { thai: '  ', karaoke: '', highlights: [] },
  ])
})

test('clears highlights when a line text changes and toggles highlight indexes', () => {
  const line = { id: 1, thai: 'รัก', karaoke: null, highlights: [0] }
  assert.equal(editKaraokeLine(line, { thai: 'รัก' }), line)
  assert.deepEqual(editKaraokeLine(line, { thai: 'รักเธอ' }).highlights, [])
  assert.deepEqual(editKaraokeLine(line, { karaoke: 'rak' }).highlights, [])
  assert.deepEqual(toggleHighlight([2], 0), [0, 2])
  assert.deepEqual(toggleHighlight([0, 2], 2), [0])
})

test('splits readings into syllables and colors them by mode and highlight', () => {
  assert.deepEqual(splitReadingRuns('khwam-rak  thoe!'), [
    { text: 'khwam', syllable: 0 },
    { text: '-', syllable: null },
    { text: 'rak', syllable: 1 },
    { text: '  ', syllable: null },
    { text: 'thoe', syllable: 2 },
    { text: '!', syllable: null },
  ])
  assert.deepEqual(readingSyllables('KA-RA-O-KE'), ['KA', 'RA', 'O', 'KE'])

  const colors = { karaokeColor: '#111111', syllableColoring: 'single' as const, palette: ['#AA0000', '#00AA00', '#0000AA'] as [string, string, string], highlightColor: '#FFFF00' }
  assert.deepEqual(readingColorRuns('ka-ra o', colors), [{ text: 'ka-ra o', color: '#111111' }])
  assert.deepEqual(readingColorRuns('ka-ra o', colors, [1]), [
    { text: 'ka-', color: '#111111' },
    { text: 'ra ', color: '#FFFF00' },
    { text: 'o', color: '#111111' },
  ])
  assert.deepEqual(readingColorRuns('ka-ra-o-ke', { ...colors, syllableColoring: 'alternate' }), [
    { text: 'ka-', color: '#AA0000' },
    { text: 'ra-', color: '#00AA00' },
    { text: 'o-', color: '#0000AA' },
    { text: 'ke', color: '#AA0000' },
  ])
})

test('hit-tests text rows and drags the block into a clamped custom position', () => {
  const canvas = { width: 1000, height: 1000 }
  const layout = layoutKaraokeText([{ thai: 'รัก', karaoke: 'rak' }], design({ position: 'top', thaiSize: 10, karaokeSize: 5 }), canvas, measure)
  // Thai row: 3 chars × 100 px × 0.5 = 150 px wide, centered at x 500, y 50 + 75.
  assert.equal(hitTestText(layout, 'center', { x: 500, y: 125 }, canvas), true)
  assert.equal(hitTestText(layout, 'center', { x: 900, y: 125 }, canvas), false)
  assert.equal(hitTestText(layout, 'center', { x: 500, y: 900 }, canvas), false)

  const start = design({ position: 'top' })
  assert.deepEqual(dragTextBlock(start, 50, { dx: 100, dy: 200 }, canvas), { position: 'custom', offsetX: 0.1, offsetY: 0.25 })
  const custom = design({ position: 'custom', offsetX: 0.4, offsetY: 0.9 })
  assert.deepEqual(dragTextBlock(custom, 900, { dx: 500, dy: 500 }, canvas), { position: 'custom', offsetX: 0.5, offsetY: 1 })

  const moved = layoutKaraokeText([{ thai: 'รัก', karaoke: '' }], design({ position: 'custom', offsetX: -0.1, offsetY: 0.3 }), canvas, measure)
  assert.equal(moved.block?.y, 300)
  assert.equal(moved.items[0].x, 400)
  assert.equal(itemLeft(moved.items[0], 'center'), 400 - moved.items[0].width / 2)
})

test('stores only line text and ignores malformed stored values', () => {
  const stored = serializeKaraokeLines([{ id: 7, thai: 'รัก', karaoke: null, highlights: [0] }])
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
