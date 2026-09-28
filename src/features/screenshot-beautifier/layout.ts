import type { FramePreset, ScreenshotDesign } from './model.ts'
import { FRAME_CHROME, findCanvasSizePreset, type FrameChrome } from './presets.ts'

export interface CanvasSize {
  width: number
  height: number
}

export interface NaturalSize {
  width: number
  height: number
}

export function resolveCanvasSize(
  design: Pick<ScreenshotDesign, 'canvasPreset' | 'padding' | 'scale' | 'frame'>,
  screenshot: NaturalSize,
): CanvasSize {
  const preset = findCanvasSizePreset(design.canvasPreset)
  if (preset.width !== null && preset.height !== null) return { width: preset.width, height: preset.height }

  const chrome = FRAME_CHROME[design.frame]
  const displayWidth = (screenshot.width * design.scale) / 100
  const displayHeight = (screenshot.height * design.scale) / 100

  return {
    width: Math.max(1, Math.round(displayWidth + chrome.left + chrome.right + design.padding * 2)),
    height: Math.max(1, Math.round(displayHeight + chrome.top + chrome.bottom + design.padding * 2)),
  }
}

export function resolveFittedScreenshotSize(
  canvas: CanvasSize,
  padding: number,
  chrome: FrameChrome,
  screenshot: NaturalSize,
  scale: number,
): CanvasSize {
  const availableWidth = Math.max(1, canvas.width - padding * 2 - chrome.left - chrome.right)
  const availableHeight = Math.max(1, canvas.height - padding * 2 - chrome.top - chrome.bottom)
  const desiredWidth = Math.max(1, (screenshot.width * scale) / 100)
  const desiredHeight = Math.max(1, (screenshot.height * scale) / 100)
  const fitRatio = Math.min(1, availableWidth / desiredWidth, availableHeight / desiredHeight)

  return {
    width: Math.max(1, Math.round(desiredWidth * fitRatio)),
    height: Math.max(1, Math.round(desiredHeight * fitRatio)),
  }
}

export function resolveExportPixelRatio(canvas: CanvasSize, targetRatio = 2, maxEdge = 4096): number {
  const safeWidth = Math.max(1, canvas.width)
  const safeHeight = Math.max(1, canvas.height)
  const widthLimit = maxEdge / safeWidth
  const heightLimit = maxEdge / safeHeight
  return Math.min(targetRatio, widthLimit, heightLimit)
}

export const UNFRAMED_CHROME: FrameChrome = { top: 0, right: 0, bottom: 0, left: 0 }
export type { FramePreset }
