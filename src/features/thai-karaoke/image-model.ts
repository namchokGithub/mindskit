/**
 * Karaoke Image Maker: design model and layout math (no DOM), shared by the preview and the export
 * so both are drawn from the same numbers.
 */

export type KaraokeAspect = 'original' | '16:9' | '4:3' | '1:1' | '9:16'
export type KaraokeResolution = 'original' | '1920' | '1280' | '720'
/** `custom` is set by dragging the text block; it uses `offsetX` / `offsetY`. */
export type KaraokePosition = 'top' | 'center' | 'bottom' | 'custom'
export type KaraokeAlign = 'left' | 'center' | 'right'
export type KaraokeShadow = 'none' | 'soft' | 'strong' | 'glow'
export type KaraokeOverlay = 'none' | 'band' | 'full'
export type KaraokeSyllableColoring = 'single' | 'alternate'

export interface KaraokeImageDesign {
  aspect: KaraokeAspect
  resolution: KaraokeResolution
  position: KaraokePosition
  /** Custom position: horizontal shift of the text anchor, as a fraction of the width. */
  offsetX: number
  /** Custom position: top of the text block, as a fraction of the height. */
  offsetY: number
  align: KaraokeAlign
  showThai: boolean
  showKaraoke: boolean
  /** Font sizes as a percentage of the output height. */
  thaiSize: number
  karaokeSize: number
  thaiColor: string
  karaokeColor: string
  strokeColor: string
  /** Stroke width as a percentage of each font size (0 = no stroke). */
  strokeWidth: number
  shadow: KaraokeShadow
  shadowColor: string
  /** Text opacity, 0–100. */
  textOpacity: number
  /** Space between line pairs as a multiple of the larger font size. */
  lineSpacing: number
  overlay: KaraokeOverlay
  overlayColor: string
  /** Overlay opacity, 0–100. */
  overlayOpacity: number
  /** Reading syllables in one color, or cycling through `palette`. */
  syllableColoring: KaraokeSyllableColoring
  palette: [string, string, string]
  /** Color of highlighted reading syllables. */
  highlightColor: string
}

export const DEFAULT_KARAOKE_IMAGE_DESIGN: KaraokeImageDesign = {
  aspect: 'original',
  resolution: 'original',
  position: 'bottom',
  offsetX: 0,
  offsetY: 0.7,
  align: 'center',
  showThai: true,
  showKaraoke: true,
  thaiSize: 6,
  karaokeSize: 4,
  thaiColor: '#FFFFFF',
  karaokeColor: '#FDE68A',
  strokeColor: '#000000',
  strokeWidth: 12,
  shadow: 'soft',
  shadowColor: '#000000',
  textOpacity: 100,
  lineSpacing: 0.6,
  overlay: 'none',
  overlayColor: '#000000',
  overlayOpacity: 45,
  syllableColoring: 'single',
  palette: ['#F472B6', '#38BDF8', '#FACC15'],
  highlightColor: '#F87171',
}

export const SIZE_RANGE = { thai: { min: 2, max: 15 }, karaoke: { min: 2, max: 12 } }
export const STROKE_RANGE = { min: 0, max: 25 }
export const LINE_SPACING_RANGE = { min: 0, max: 2 }
export const OFFSET_X_RANGE = { min: -0.5, max: 0.5 }
export const OFFSET_Y_RANGE = { min: -0.25, max: 1 }

export const ASPECT_OPTIONS: Array<{ id: KaraokeAspect; label: string; ratio: number | null }> = [
  { id: 'original', label: 'Original', ratio: null },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
]

export const RESOLUTION_OPTIONS: Array<{ id: KaraokeResolution; label: string; longEdge: number | null }> = [
  { id: 'original', label: 'Original size', longEdge: null },
  { id: '1920', label: '1920 px (Full HD)', longEdge: 1920 },
  { id: '1280', label: '1280 px (HD)', longEdge: 1280 },
  { id: '720', label: '720 px (small)', longEdge: 720 },
]

/** Largest output side, matching the other image tools. */
export const MAX_OUTPUT_SIDE = 10_000
/** Largest canvas area Safari on iOS can allocate (4096 × 4096). */
export const MAX_OUTPUT_AREA = 16_777_216

export interface Size {
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Centered crop of the source image to the chosen aspect ratio ("cover"); the whole image for Original. */
export function resolveSourceCrop(image: Size, aspect: KaraokeAspect): Rect {
  const ratio = ASPECT_OPTIONS.find((option) => option.id === aspect)?.ratio ?? null
  if (!ratio) return { x: 0, y: 0, width: image.width, height: image.height }
  const imageRatio = image.width / image.height
  if (imageRatio > ratio) {
    const width = Math.round(image.height * ratio)
    return { x: Math.round((image.width - width) / 2), y: 0, width, height: image.height }
  }
  const height = Math.round(image.width / ratio)
  return { x: 0, y: Math.round((image.height - height) / 2), width: image.width, height }
}

/**
 * Output size for a crop: scaled down (never up) so the long edge fits the chosen resolution, then
 * further down if needed to stay within the maximum side and canvas area.
 */
export function resolveOutputSize(crop: Size, resolution: KaraokeResolution): Size {
  const longEdge = RESOLUTION_OPTIONS.find((option) => option.id === resolution)?.longEdge ?? null
  const longest = Math.max(crop.width, crop.height)
  let scale = Math.min(1, longEdge ? longEdge / longest : 1, MAX_OUTPUT_SIDE / longest)
  const area = crop.width * scale * crop.height * scale
  if (area > MAX_OUTPUT_AREA) scale *= Math.sqrt(MAX_OUTPUT_AREA / area)
  return { width: Math.max(1, Math.floor(crop.width * scale)), height: Math.max(1, Math.floor(crop.height * scale)) }
}

export interface KaraokeTextLine {
  thai: string
  karaoke: string
  /** Indexes of highlighted reading syllables (see `splitReadingRuns`). */
  highlights?: readonly number[]
}

export interface KaraokeTextItem {
  kind: 'thai' | 'karaoke'
  text: string
  /** Index of the line pair this row belongs to. */
  lineIndex: number
  /** Anchor x for `textAlign` = design.align. */
  x: number
  /** Vertical center (draw with `textBaseline = 'middle'`). */
  y: number
  fontPx: number
  /** Measured width at `fontPx`. */
  width: number
}

export interface KaraokeTextLayout {
  items: KaraokeTextItem[]
  /** Area covered by the text block, or null when there is no text. */
  block: Rect | null
  /** Overlay rectangle, or null when the overlay is off or there is no text. */
  overlay: Rect | null
}

/** Measures `text` at `fontPx` (Sarabun 700) and returns its width in pixels. */
export type MeasureText = (text: string, fontPx: number) => number

// Thai needs room for marks above and below the line; Latin readings need less.
const THAI_LINE_HEIGHT = 1.5
const KARAOKE_LINE_HEIGHT = 1.3
const MARGIN_RATIO = 0.05
const OVERLAY_PADDING_RATIO = 0.03

/**
 * Lays out the visible line pairs (Thai above its reading). Each line keeps its size unless it is too
 * wide, in which case only that line shrinks to fit between the side margins.
 */
export function layoutKaraokeText(lines: KaraokeTextLine[], design: KaraokeImageDesign, canvas: Size, measure: MeasureText): KaraokeTextLayout {
  const marginX = canvas.width * MARGIN_RATIO
  const marginY = canvas.height * MARGIN_RATIO
  const maxWidth = Math.max(1, canvas.width - marginX * 2)
  const thaiPx = (canvas.height * design.thaiSize) / 100
  const karaokePx = (canvas.height * design.karaokeSize) / 100
  const pairGap = Math.max(thaiPx, karaokePx) * design.lineSpacing

  const fit = (text: string, fontPx: number) => {
    const width = measure(text, fontPx)
    return width > maxWidth ? { fontPx: fontPx * (maxWidth / width), width: maxWidth } : { fontPx, width }
  }

  type Row = { kind: 'thai' | 'karaoke'; text: string; lineIndex: number; fontPx: number; width: number; height: number }
  const pairs: Row[][] = []
  lines.forEach((line, lineIndex) => {
    const rows: Row[] = []
    const thai = line.thai.trim()
    const karaoke = line.karaoke.trim()
    if (design.showThai && thai) {
      const fitted = fit(thai, thaiPx)
      rows.push({ kind: 'thai', text: thai, lineIndex, ...fitted, height: fitted.fontPx * THAI_LINE_HEIGHT })
    }
    if (design.showKaraoke && karaoke) {
      const fitted = fit(karaoke, karaokePx)
      rows.push({ kind: 'karaoke', text: karaoke, lineIndex, ...fitted, height: fitted.fontPx * KARAOKE_LINE_HEIGHT })
    }
    if (rows.length > 0) pairs.push(rows)
  })
  if (pairs.length === 0) return { items: [], block: null, overlay: null }

  const blockHeight = pairs.reduce((total, rows) => total + rows.reduce((sum, row) => sum + row.height, 0), 0) + pairGap * (pairs.length - 1)
  const top =
    design.position === 'custom'
      ? canvas.height * design.offsetY
      : design.position === 'top'
        ? marginY
        : design.position === 'center'
          ? (canvas.height - blockHeight) / 2
          : canvas.height - marginY - blockHeight
  const baseX = design.align === 'left' ? marginX : design.align === 'right' ? canvas.width - marginX : canvas.width / 2
  const x = design.position === 'custom' ? baseX + canvas.width * design.offsetX : baseX

  const items: KaraokeTextItem[] = []
  let cursor = top
  pairs.forEach((rows, index) => {
    if (index > 0) cursor += pairGap
    for (const row of rows) {
      items.push({ kind: row.kind, text: row.text, lineIndex: row.lineIndex, x, y: cursor + row.height / 2, fontPx: row.fontPx, width: row.width })
      cursor += row.height
    }
  })

  const block = { x: marginX, y: top, width: maxWidth, height: blockHeight }
  let overlay: Rect | null = null
  if (design.overlay === 'full') overlay = { x: 0, y: 0, width: canvas.width, height: canvas.height }
  else if (design.overlay === 'band') {
    const padding = canvas.height * OVERLAY_PADDING_RATIO
    const bandTop = Math.max(0, top - padding)
    const bandBottom = Math.min(canvas.height, top + blockHeight + padding)
    if (bandBottom > bandTop) overlay = { x: 0, y: bandTop, width: canvas.width, height: bandBottom - bandTop }
  }
  return { items, block, overlay }
}

/** Left edge of an item for its alignment. */
export function itemLeft(item: Pick<KaraokeTextItem, 'x' | 'width'>, align: KaraokeAlign): number {
  return align === 'left' ? item.x : align === 'right' ? item.x - item.width : item.x - item.width / 2
}

/** Whether `point` (output pixels) is on the text, with a little slack around each row. */
export function hitTestText(layout: KaraokeTextLayout, align: KaraokeAlign, point: { x: number; y: number }, canvas: Size): boolean {
  const slack = Math.min(canvas.width, canvas.height) * 0.02
  return layout.items.some((item) => {
    const left = itemLeft(item, align)
    const halfHeight = item.fontPx * 0.75
    return point.x >= left - slack && point.x <= left + item.width + slack && point.y >= item.y - halfHeight - slack && point.y <= item.y + halfHeight + slack
  })
}

/**
 * Design patch for dragging the text block by (dx, dy) output pixels from where the drag started.
 * A preset position is first converted to the equivalent custom offsets.
 */
export function dragTextBlock(start: KaraokeImageDesign, startBlockTop: number, delta: { dx: number; dy: number }, canvas: Size): Pick<KaraokeImageDesign, 'position' | 'offsetX' | 'offsetY'> {
  const originX = start.position === 'custom' ? start.offsetX : 0
  const originY = start.position === 'custom' ? start.offsetY : startBlockTop / canvas.height
  return {
    position: 'custom',
    offsetX: clampNumber(originX + delta.dx / canvas.width, OFFSET_X_RANGE.min, OFFSET_X_RANGE.max),
    offsetY: clampNumber(originY + delta.dy / canvas.height, OFFSET_Y_RANGE.min, OFFSET_Y_RANGE.max),
  }
}

export interface ReadingRun {
  text: string
  /** Syllable number within the reading, or null for separators and spaces. */
  syllable: number | null
}

const SYLLABLE_PATTERN = /[\p{L}\p{N}']+/gu

/** Splits a reading into syllables (runs of letters and digits) and the separators between them. */
export function splitReadingRuns(text: string): ReadingRun[] {
  const runs: ReadingRun[] = []
  let last = 0
  let syllable = 0
  for (const match of text.matchAll(SYLLABLE_PATTERN)) {
    const start = match.index ?? 0
    if (start > last) runs.push({ text: text.slice(last, start), syllable: null })
    runs.push({ text: match[0], syllable })
    syllable += 1
    last = start + match[0].length
  }
  if (last < text.length) runs.push({ text: text.slice(last), syllable: null })
  return runs
}

export function readingSyllables(text: string): string[] {
  return splitReadingRuns(text)
    .filter((run) => run.syllable !== null)
    .map((run) => run.text)
}

/**
 * Colored pieces of a reading: highlighted syllables use the highlight color; otherwise syllables use
 * the reading color or cycle through the palette. Separators take the previous syllable's color, and
 * neighbouring pieces with the same color are merged.
 */
export function readingColorRuns(text: string, design: Pick<KaraokeImageDesign, 'karaokeColor' | 'syllableColoring' | 'palette' | 'highlightColor'>, highlights: readonly number[] = []): Array<{ text: string; color: string }> {
  const highlighted = new Set(highlights)
  const pieces: Array<{ text: string; color: string }> = []
  let color = design.syllableColoring === 'alternate' ? design.palette[0] : design.karaokeColor
  for (const run of splitReadingRuns(text)) {
    if (run.syllable !== null) {
      color = highlighted.has(run.syllable)
        ? design.highlightColor
        : design.syllableColoring === 'alternate'
          ? design.palette[run.syllable % design.palette.length]
          : design.karaokeColor
    }
    const last = pieces.at(-1)
    if (last && last.color === color) last.text += run.text
    else pieces.push({ text: run.text, color })
  }
  return pieces
}

export function karaokeImageFileName(originalFileName: string | null, extension: 'png' | 'jpg'): string {
  const base = originalFileName?.replace(/\.[^./]+$/, '') || 'mindskit'
  return `${base}-karaoke.${extension}`
}

export function clampNumber(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min
}
