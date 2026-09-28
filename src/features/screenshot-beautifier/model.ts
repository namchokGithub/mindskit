export type BackgroundType = 'solid' | 'gradient'
export type ShadowLevel = 'none' | 'soft' | 'medium' | 'strong'
export type ScreenshotPosition = 'center' | 'top' | 'bottom' | 'left' | 'right'
export type FramePreset =
  | 'none'
  | 'browser-minimal'
  | 'browser-macos'
  | 'device-phone-portrait'
  | 'device-phone-landscape'
  | 'device-laptop'
export type CanvasPresetId =
  | 'auto'
  | '16:9'
  | '4:3'
  | '1:1'
  | '3:2'
  | '9:16'
  | 'x-post'
  | 'instagram-square'
  | 'instagram-portrait'

export interface ScreenshotBackground {
  type: BackgroundType
  color: string
  gradientFrom: string
  gradientTo: string
  gradientAngle: number
  gradientPresetId: string | null
}

export interface ScreenshotDesign {
  canvasPreset: CanvasPresetId
  background: ScreenshotBackground
  padding: number
  radius: number
  shadow: ShadowLevel
  scale: number
  position: ScreenshotPosition
  frame: FramePreset
  perspectiveX: number
  perspectiveY: number
}

export const PADDING_RANGE = { min: 0, max: 200 }
export const RADIUS_RANGE = { min: 0, max: 48 }
export const SCALE_RANGE = { min: 50, max: 120 }
export const PERSPECTIVE_RANGE = { min: -15, max: 15 }

export const DEFAULT_DESIGN: ScreenshotDesign = {
  canvasPreset: 'auto',
  background: {
    type: 'gradient',
    color: '#111827',
    gradientFrom: '#4C1D95',
    gradientTo: '#1E1B4B',
    gradientAngle: 135,
    gradientPresetId: 'midnight-violet',
  },
  padding: 64,
  radius: 14,
  shadow: 'medium',
  scale: 100,
  position: 'center',
  frame: 'none',
  perspectiveX: 0,
  perspectiveY: 0,
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function clampPadding(value: number): number {
  return clamp(value, PADDING_RANGE.min, PADDING_RANGE.max)
}
export function clampRadius(value: number): number {
  return clamp(value, RADIUS_RANGE.min, RADIUS_RANGE.max)
}
export function clampScale(value: number): number {
  return clamp(value, SCALE_RANGE.min, SCALE_RANGE.max)
}
export function clampPerspective(value: number): number {
  return clamp(value, PERSPECTIVE_RANGE.min, PERSPECTIVE_RANGE.max)
}

export function normalizeDesign(design: ScreenshotDesign): ScreenshotDesign {
  return {
    ...design,
    background: { ...design.background },
    padding: clampPadding(design.padding),
    radius: clampRadius(design.radius),
    scale: clampScale(design.scale),
    perspectiveX: clampPerspective(design.perspectiveX),
    perspectiveY: clampPerspective(design.perspectiveY),
  }
}

export function resetDesign(): ScreenshotDesign {
  return { ...DEFAULT_DESIGN, background: { ...DEFAULT_DESIGN.background } }
}

export function backgroundCss(background: ScreenshotBackground): string {
  if (background.type === 'solid') return background.color
  return `linear-gradient(${background.gradientAngle}deg, ${background.gradientFrom}, ${background.gradientTo})`
}

export interface PersistedScreenshotPrefs {
  canvasPreset: CanvasPresetId
  gradientPresetId: string | null
  frame: FramePreset
}

const CANVAS_PRESET_IDS: readonly CanvasPresetId[] = ['auto', '16:9', '4:3', '1:1', '3:2', '9:16', 'x-post', 'instagram-square', 'instagram-portrait']
const FRAME_PRESET_IDS: readonly FramePreset[] = ['none', 'browser-minimal', 'browser-macos', 'device-phone-portrait', 'device-phone-landscape', 'device-laptop']

export function serializePersistedPreferences(design: ScreenshotDesign): string {
  const prefs: PersistedScreenshotPrefs = {
    canvasPreset: design.canvasPreset,
    gradientPresetId: design.background.gradientPresetId,
    frame: design.frame,
  }
  return JSON.stringify(prefs)
}

/** `resolveGradientPreset` looks up a gradient preset by id (see `presets.ts`); passed in so this module has no import-order dependency on `presets.ts`. */
export function mergePersistedPreferences(
  base: ScreenshotDesign,
  raw: string,
  resolveGradientPreset?: (id: string) => { from: string; to: string; angle: number } | undefined,
): ScreenshotDesign {
  if (!raw) return base
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return base
  }
  if (typeof parsed !== 'object' || parsed === null) return base
  const candidate = parsed as Partial<PersistedScreenshotPrefs>

  const next = normalizeDesign(base)
  if (typeof candidate.canvasPreset === 'string' && CANVAS_PRESET_IDS.includes(candidate.canvasPreset as CanvasPresetId)) {
    next.canvasPreset = candidate.canvasPreset as CanvasPresetId
  }
  if (typeof candidate.frame === 'string' && FRAME_PRESET_IDS.includes(candidate.frame as FramePreset)) {
    next.frame = candidate.frame as FramePreset
  }
  if (typeof candidate.gradientPresetId === 'string' && resolveGradientPreset) {
    const preset = resolveGradientPreset(candidate.gradientPresetId)
    if (preset) {
      next.background = { ...next.background, type: 'gradient', gradientFrom: preset.from, gradientTo: preset.to, gradientAngle: preset.angle, gradientPresetId: candidate.gradientPresetId }
    }
  }
  return next
}
