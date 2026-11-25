import assert from 'node:assert/strict'
import test from 'node:test'

import { commitHistory, createHistory, HISTORY_LIMIT, redoHistory, sealHistory, undoHistory } from '../src/features/thai-karaoke/history.ts'
import { DEFAULT_KARAOKE_IMAGE_DESIGN } from '../src/features/thai-karaoke/image-model.ts'
import { applyStyle, COLOR_PRESETS, normalizeStyle, pickStyle, SIZE_PRESETS, STYLE_KEYS, STYLE_PRESETS } from '../src/features/thai-karaoke/image-presets.ts'
import { createMemoryPresetStorage, createPresetStore, MAX_CUSTOM_PRESETS, normalizeCustomPreset } from '../src/features/thai-karaoke/preset-store.ts'

test('undo and redo walk the history and a new change clears redo', () => {
  let history = createHistory(1)
  history = commitHistory(history, 2, { now: 0 })
  history = commitHistory(history, 3, { now: 10_000 })
  assert.deepEqual([history.past, history.present], [[1, 2], 3])
  history = undoHistory(history)
  assert.deepEqual([history.past, history.present, history.future], [[1], 2, [3]])
  history = redoHistory(history)
  assert.equal(history.present, 3)
  history = undoHistory(undoHistory(history))
  history = commitHistory(history, 9, { now: 20_000 })
  assert.deepEqual([history.past, history.present, history.future], [[1], 9, []])
  assert.equal(undoHistory(createHistory(5)).present, 5)
  assert.equal(redoHistory(createHistory(5)).present, 5)
})

test('merges quick changes with the same key into one undo step', () => {
  let history = createHistory('a')
  history = commitHistory(history, 'b', { key: 'drag', now: 0 })
  history = commitHistory(history, 'c', { key: 'drag', now: 300 })
  history = commitHistory(history, 'd', { key: 'drag', now: 600 })
  assert.deepEqual(history.past, ['a'])
  history = commitHistory(history, 'e', { key: 'drag', now: 5_000 })
  assert.deepEqual(history.past, ['a', 'd'])
  history = sealHistory(history)
  history = commitHistory(history, 'f', { key: 'drag', now: 5_100 })
  assert.deepEqual(history.past, ['a', 'd', 'e'])
  history = commitHistory(history, 'g', { key: 'size', now: 5_200 })
  assert.deepEqual(history.past, ['a', 'd', 'e', 'f'])
  assert.equal(commitHistory(history, 'g'), history)
})

test('keeps at most the history limit', () => {
  let history = createHistory(0)
  for (let value = 1; value <= HISTORY_LIMIT + 20; value += 1) history = commitHistory(history, value, { now: value * 10_000 })
  assert.equal(history.past.length, HISTORY_LIMIT)
  assert.equal(history.past[0], 20)
})

test('presets set style only and keep framing and position', () => {
  const design = { ...DEFAULT_KARAOKE_IMAGE_DESIGN, aspect: '1:1' as const, position: 'custom' as const, offsetY: 0.2 }
  for (const preset of STYLE_PRESETS) {
    assert.deepEqual(Object.keys(preset.style).sort(), [...STYLE_KEYS].sort())
    const applied = applyStyle(design, preset.style)
    assert.equal(applied.aspect, '1:1')
    assert.equal(applied.position, 'custom')
    assert.equal(applied.offsetY, 0.2)
    assert.deepEqual(pickStyle(applied), preset.style)
  }
  for (const preset of [...COLOR_PRESETS, ...SIZE_PRESETS]) {
    for (const key of Object.keys(preset.style)) assert.ok((STYLE_KEYS as readonly string[]).includes(key), key)
  }
  const colorful = applyStyle(design, STYLE_PRESETS.find((preset) => preset.id === 'colorful')!.style)
  colorful.palette[0] = '#000000'
  assert.notEqual(STYLE_PRESETS.find((preset) => preset.id === 'colorful')!.style.palette[0], '#000000')
})

test('normalizes stored styles: bad fields fall back, numbers are clamped', () => {
  assert.equal(normalizeStyle(null), null)
  assert.equal(normalizeStyle('x'), null)
  const style = normalizeStyle({ thaiColor: '#abcdef', karaokeColor: 'red', thaiSize: 99, shadow: 'neon', palette: ['#111111'], showThai: false })
  assert.ok(style)
  assert.equal(style.thaiColor, '#ABCDEF')
  assert.equal(style.karaokeColor, DEFAULT_KARAOKE_IMAGE_DESIGN.karaokeColor)
  assert.equal(style.thaiSize, 15)
  assert.equal(style.shadow, 'soft')
  assert.deepEqual(style.palette, ['#111111', '#38BDF8', '#FACC15'])
  assert.equal(style.showThai, false)
})

test('custom preset store saves, replaces by name, lists newest first, and deletes', async () => {
  let id = 0
  const store = createPresetStore(createMemoryPresetStorage(), () => `p${++id}`)
  const style = pickStyle(DEFAULT_KARAOKE_IMAGE_DESIGN)
  await assert.rejects(store.savePreset('   ', style), /name/)

  const first = await store.savePreset('  Night ', style)
  assert.equal(first.name, 'Night')
  await new Promise((resolve) => setTimeout(resolve, 2))
  await store.savePreset('Day', { ...style, thaiColor: '#000000' })
  await new Promise((resolve) => setTimeout(resolve, 2))
  const replaced = await store.savePreset('night', { ...style, thaiColor: '#FF0000' })
  assert.equal(replaced.id, first.id)

  const listed = await store.listPresets()
  assert.deepEqual(listed.map((preset) => preset.name), ['night', 'Day'])
  assert.equal(listed[0].style.thaiColor, '#FF0000')

  await store.deletePreset(first.id)
  assert.deepEqual((await store.listPresets()).map((preset) => preset.name), ['Day'])
})

test('custom preset store enforces the limit and reports storage failures', async () => {
  const storage = createMemoryPresetStorage()
  let id = 0
  const store = createPresetStore(storage, () => `p${++id}`)
  const style = pickStyle(DEFAULT_KARAOKE_IMAGE_DESIGN)
  for (let index = 0; index < MAX_CUSTOM_PRESETS; index += 1) await store.savePreset(`Preset ${index}`, style)
  await assert.rejects(store.savePreset('One more', style), /up to 50/)
  await store.savePreset('Preset 3', style)

  const broken = createPresetStore({
    put: async () => {
      throw new Error('quota')
    },
    delete: async () => {},
    list: async () => [],
  })
  await assert.rejects(broken.savePreset('A', style), /unavailable/)
})

test('drops malformed stored presets', () => {
  assert.equal(normalizeCustomPreset('a', null), null)
  assert.equal(normalizeCustomPreset('a', { name: '', style: {} }), null)
  assert.equal(normalizeCustomPreset('a', { name: 'X', style: 'bad' }), null)
  assert.equal(normalizeCustomPreset('a', { name: 'X', style: {} })?.style.thaiColor, '#FFFFFF')
})
