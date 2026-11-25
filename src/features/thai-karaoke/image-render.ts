import '@fontsource/sarabun/700.css'

import {
  itemLeft,
  layoutKaraokeText,
  readingColorRuns,
  type KaraokeImageDesign,
  type KaraokeTextLayout,
  type KaraokeTextLine,
  type Rect,
  type Size,
} from './image-model.ts'

/** Bundled, same-origin font (see public/_headers: font-src 'self'). */
export const KARAOKE_FONT_FAMILY = 'Sarabun'
const FONT_WEIGHT = 700

export function karaokeFont(fontPx: number): string {
  return `${FONT_WEIGHT} ${fontPx}px ${KARAOKE_FONT_FAMILY}, sans-serif`
}

/**
 * Waits until the Thai and Latin faces of Sarabun are ready, so the first preview and every export
 * use the real font instead of a fallback. Resolves even if loading fails (the fallback is used).
 */
export async function loadKaraokeFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await Promise.all([document.fonts.load(karaokeFont(32), 'กขคไทย'), document.fonts.load(karaokeFont(32), 'Karaoke')])
  } catch {
    // Fall back to the system font.
  }
}

const SHADOW: Record<KaraokeImageDesign['shadow'], { blur: number; offset: number; alpha: number }> = {
  none: { blur: 0, offset: 0, alpha: 0 },
  soft: { blur: 0.12, offset: 0.04, alpha: 0.6 },
  strong: { blur: 0.28, offset: 0.06, alpha: 0.75 },
  glow: { blur: 0.35, offset: 0, alpha: 0.95 },
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((char) => char + char).join('') : value.padEnd(6, '0').slice(0, 6)
  const number = Number.parseInt(full, 16)
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`
}

export interface RenderKaraokeImageOptions {
  image: CanvasImageSource
  crop: Rect
  output: Size
  lines: KaraokeTextLine[]
  design: KaraokeImageDesign
  /** Draw scale: 1 for export, smaller for the preview canvas. */
  scale?: number
  /** Paint white first (JPEG has no transparency). */
  opaque?: boolean
}

/**
 * Draws the composed karaoke image onto `canvas` (resized to output × scale) and returns the text
 * layout in output pixels, which the preview uses for dragging.
 */
export function renderKaraokeImage(canvas: HTMLCanvasElement, options: RenderKaraokeImageOptions): KaraokeTextLayout {
  const { image, crop, output, lines, design, scale = 1, opaque = false } = options
  canvas.width = Math.max(1, Math.round(output.width * scale))
  canvas.height = Math.max(1, Math.round(output.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')

  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.imageSmoothingQuality = 'high'
  if (opaque) {
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, output.width, output.height)
  }
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, output.width, output.height)

  const layout = layoutKaraokeText(lines, design, output, (text, fontPx) => {
    context.font = karaokeFont(fontPx)
    return context.measureText(text).width
  })

  if (layout.overlay && design.overlayOpacity > 0) {
    context.fillStyle = hexToRgba(design.overlayColor, design.overlayOpacity / 100)
    context.fillRect(layout.overlay.x, layout.overlay.y, layout.overlay.width, layout.overlay.height)
  }

  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.lineJoin = 'round'
  context.miterLimit = 2
  context.globalAlpha = design.textOpacity / 100
  const shadow = SHADOW[design.shadow]

  for (const item of layout.items) {
    context.font = karaokeFont(item.fontPx)
    const runs =
      item.kind === 'thai'
        ? [{ text: item.text, color: design.thaiColor }]
        : readingColorRuns(item.text, design, lines[item.lineIndex]?.highlights ?? [])

    // Runs are placed left to right from the item's aligned left edge, scaled so their measured widths
    // add up to the item width (kerning between runs can differ slightly from the whole string).
    const widths = runs.map((run) => context.measureText(run.text).width)
    const total = widths.reduce((sum, width) => sum + width, 0) || 1
    const factor = item.width / total
    const positions: number[] = []
    let cursor = itemLeft(item, design.align)
    for (const width of widths) {
      positions.push(cursor)
      cursor += width * factor
    }

    const strokeWidth = (item.fontPx * design.strokeWidth) / 100
    const setShadow = (on: boolean) => {
      const active = on && shadow.blur > 0
      context.shadowColor = active ? hexToRgba(design.shadowColor, shadow.alpha) : 'transparent'
      context.shadowBlur = active ? item.fontPx * shadow.blur : 0
      context.shadowOffsetY = active ? item.fontPx * shadow.offset : 0
    }

    // Strokes first at double width so fills cover their inner half; the shadow is cast once per run.
    if (strokeWidth > 0) {
      setShadow(true)
      context.strokeStyle = design.strokeColor
      context.lineWidth = strokeWidth * 2
      runs.forEach((run, index) => context.strokeText(run.text, positions[index], item.y))
    }
    setShadow(strokeWidth === 0)
    runs.forEach((run, index) => {
      context.fillStyle = run.color
      context.fillText(run.text, positions[index], item.y)
    })
  }

  context.globalAlpha = 1
  context.shadowColor = 'transparent'
  context.shadowBlur = 0
  context.shadowOffsetY = 0
  context.setTransform(1, 0, 0, 1, 0, 0)
  return layout
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: 'png' | 'jpg'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to export the karaoke image.'))),
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      format === 'jpg' ? 0.92 : undefined,
    )
  })
}

/** A generated 1600 × 900 PNG background for trying the tool without an image of your own. */
export async function createSampleBackground(): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 1600
  canvas.height = 900
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')

  const sky = context.createLinearGradient(0, 0, 0, 900)
  sky.addColorStop(0, '#1E1B4B')
  sky.addColorStop(0.55, '#7C3AED')
  sky.addColorStop(1, '#F472B6')
  context.fillStyle = sky
  context.fillRect(0, 0, 1600, 900)

  const glow = context.createRadialGradient(1180, 300, 20, 1180, 300, 260)
  glow.addColorStop(0, 'rgba(253, 230, 138, 0.95)')
  glow.addColorStop(0.35, 'rgba(253, 230, 138, 0.35)')
  glow.addColorStop(1, 'rgba(253, 230, 138, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, 1600, 900)

  // Two layers of soft hills.
  const hills: Array<{ color: string; base: number; amplitude: number; phase: number }> = [
    { color: 'rgba(76, 29, 149, 0.75)', base: 640, amplitude: 60, phase: 0 },
    { color: 'rgba(30, 27, 75, 0.9)', base: 730, amplitude: 45, phase: 1.7 },
  ]
  for (const hill of hills) {
    context.beginPath()
    context.moveTo(0, 900)
    for (let x = 0; x <= 1600; x += 20) context.lineTo(x, hill.base + Math.sin(x / 210 + hill.phase) * hill.amplitude)
    context.lineTo(1600, 900)
    context.closePath()
    context.fillStyle = hill.color
    context.fill()
  }

  const blob = await canvasToBlob(canvas, 'png')
  canvas.width = 0
  canvas.height = 0
  return new File([blob], 'karaoke-sample.png', { type: 'image/png' })
}
