import type { CanvasPresetId, FramePreset, ScreenshotPosition, ShadowLevel } from './model.ts'

export interface GradientPreset {
  id: string
  name: string
  from: string
  to: string
  angle: number
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'midnight-violet', name: 'Midnight Violet', from: '#4C1D95', to: '#1E1B4B', angle: 135 },
  { id: 'aurora-blue', name: 'Aurora Blue', from: '#0EA5E9', to: '#6366F1', angle: 135 },
  { id: 'cyber-rose', name: 'Cyber Rose', from: '#F472B6', to: '#7C3AED', angle: 135 },
  { id: 'sunset-ember', name: 'Sunset Ember', from: '#F97316', to: '#DB2777', angle: 135 },
  { id: 'emerald', name: 'Emerald', from: '#10B981', to: '#047857', angle: 135 },
  { id: 'soft-peach', name: 'Soft Peach', from: '#FED7AA', to: '#FCA5A5', angle: 135 },
]

export function findGradientPreset(id: string): GradientPreset | undefined {
  return GRADIENT_PRESETS.find((preset) => preset.id === id)
}

export interface CanvasSizePreset {
  id: CanvasPresetId
  label: string
  width: number | null
  height: number | null
}

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { id: 'auto', label: 'Auto', width: null, height: null },
  { id: '16:9', label: '16:9', width: 1600, height: 900 },
  { id: '4:3', label: '4:3', width: 1600, height: 1200 },
  { id: '1:1', label: '1:1', width: 1200, height: 1200 },
  { id: '3:2', label: '3:2', width: 1500, height: 1000 },
  { id: '9:16', label: '9:16', width: 900, height: 1600 },
  { id: 'x-post', label: 'X / Twitter post', width: 1200, height: 675 },
  { id: 'instagram-square', label: 'Instagram square', width: 1080, height: 1080 },
  { id: 'instagram-portrait', label: 'Instagram portrait', width: 1080, height: 1350 },
]

export function findCanvasSizePreset(id: CanvasPresetId): CanvasSizePreset {
  return CANVAS_SIZE_PRESETS.find((preset) => preset.id === id) ?? CANVAS_SIZE_PRESETS[0]
}

export const SHADOW_CSS: Record<ShadowLevel, string> = {
  none: 'none',
  soft: '0 10px 30px -12px rgba(0,0,0,0.25)',
  medium: '0 20px 45px -15px rgba(0,0,0,0.35)',
  strong: '0 30px 60px -12px rgba(0,0,0,0.5)',
}

export interface FrameChrome {
  top: number
  right: number
  bottom: number
  left: number
}

export const FRAME_CHROME: Record<FramePreset, FrameChrome> = {
  none: { top: 0, right: 0, bottom: 0, left: 0 },
  'browser-minimal': { top: 28, right: 0, bottom: 0, left: 0 },
  'browser-macos': { top: 36, right: 0, bottom: 0, left: 0 },
  'device-phone-portrait': { top: 20, right: 10, bottom: 20, left: 10 },
  'device-phone-landscape': { top: 10, right: 20, bottom: 10, left: 20 },
  'device-laptop': { top: 14, right: 14, bottom: 34, left: 14 },
}

export interface FrameOption {
  id: FramePreset
  label: string
  group: 'none' | 'browser' | 'device'
}

export const FRAME_OPTIONS: FrameOption[] = [
  { id: 'none', label: 'None', group: 'none' },
  { id: 'browser-minimal', label: 'Minimal browser', group: 'browser' },
  { id: 'browser-macos', label: 'macOS-style browser', group: 'browser' },
  { id: 'device-phone-portrait', label: 'Phone (portrait)', group: 'device' },
  { id: 'device-phone-landscape', label: 'Phone (landscape)', group: 'device' },
  { id: 'device-laptop', label: 'Laptop / desktop', group: 'device' },
]

export const POSITION_OPTIONS: { id: ScreenshotPosition; label: string }[] = [
  { id: 'center', label: 'Center' },
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

export const POSITION_ALIGN: Record<ScreenshotPosition, { justify: string; align: string }> = {
  center: { justify: 'center', align: 'center' },
  top: { justify: 'center', align: 'flex-start' },
  bottom: { justify: 'center', align: 'flex-end' },
  left: { justify: 'flex-start', align: 'center' },
  right: { justify: 'flex-end', align: 'center' },
}

export interface PerspectivePreset {
  id: string
  label: string
  x: number
  y: number
}

export const PERSPECTIVE_PRESETS: PerspectivePreset[] = [
  { id: 'none', label: 'None', x: 0, y: 0 },
  { id: 'tilt-left', label: 'Tilt Left', x: 0, y: -10 },
  { id: 'tilt-right', label: 'Tilt Right', x: 0, y: 10 },
  { id: 'tilt-up', label: 'Tilt Up', x: 8, y: 0 },
  { id: 'tilt-down', label: 'Tilt Down', x: -8, y: 0 },
]
