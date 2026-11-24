import '@fontsource/sarabun/700.css'

import { layoutKaraokeText, type KaraokeImageDesign, type KaraokeTextLine, type Rect, type Size } from './image-model.ts'

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

const SHADOW_BLUR: Record<KaraokeImageDesign['shadow'], number> = { none: 0, soft: 0.12, strong: 0.28 }

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

/** Draws the composed karaoke image onto `canvas` (resized to output × scale). */
export function renderKaraokeImage(canvas: HTMLCanvasElement, options: RenderKaraokeImageOptions) {
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

  context.textAlign = design.align
  context.textBaseline = 'middle'
  context.lineJoin = 'round'
  context.miterLimit = 2
  context.globalAlpha = design.textOpacity / 100

  for (const item of layout.items) {
    context.font = karaokeFont(item.fontPx)
    const strokeWidth = (item.fontPx * design.strokeWidth) / 100
    const blur = item.fontPx * SHADOW_BLUR[design.shadow]
    const applyShadow = (on: boolean) => {
      context.shadowColor = on && blur > 0 ? 'rgba(0, 0, 0, 0.6)' : 'transparent'
      context.shadowBlur = on ? blur : 0
      context.shadowOffsetY = on ? item.fontPx * 0.04 : 0
    }

    // The stroke is drawn first at double width so the fill covers its inner half; the shadow is cast once.
    if (strokeWidth > 0) {
      applyShadow(true)
      context.strokeStyle = design.strokeColor
      context.lineWidth = strokeWidth * 2
      context.strokeText(item.text, item.x, item.y)
    }
    applyShadow(strokeWidth === 0)
    context.fillStyle = item.kind === 'thai' ? design.thaiColor : design.karaokeColor
    context.fillText(item.text, item.x, item.y)
  }
  applyReset(context)
}

function applyReset(context: CanvasRenderingContext2D) {
  context.globalAlpha = 1
  context.shadowColor = 'transparent'
  context.shadowBlur = 0
  context.shadowOffsetY = 0
  context.setTransform(1, 0, 0, 1, 0, 0)
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
