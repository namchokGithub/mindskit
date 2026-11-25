import { clampNumber, LINE_SPACING_RANGE, SIZE_RANGE, STROKE_RANGE, type KaraokeImageDesign } from './image-model.ts'

/**
 * The part of a design that presets set: typography, colors, effects, and overlay. Image framing
 * (aspect ratio, export size) and text position stay as they are when a preset is applied.
 */
export const STYLE_KEYS = [
  'showThai',
  'showKaraoke',
  'thaiSize',
  'karaokeSize',
  'thaiColor',
  'karaokeColor',
  'strokeColor',
  'strokeWidth',
  'shadow',
  'shadowColor',
  'textOpacity',
  'lineSpacing',
  'overlay',
  'overlayColor',
  'overlayOpacity',
  'syllableColoring',
  'palette',
  'highlightColor',
] as const satisfies ReadonlyArray<keyof KaraokeImageDesign>

export type KaraokeStyleSettings = Pick<KaraokeImageDesign, (typeof STYLE_KEYS)[number]>

export function pickStyle(design: KaraokeImageDesign): KaraokeStyleSettings {
  return Object.fromEntries(STYLE_KEYS.map((key) => [key, key === 'palette' ? [...design.palette] : design[key]])) as KaraokeStyleSettings
}

export function applyStyle(design: KaraokeImageDesign, style: Partial<KaraokeStyleSettings>): KaraokeImageDesign {
  return { ...design, ...style, palette: style.palette ? [...style.palette] : design.palette }
}

export interface StylePreset {
  id: string
  name: string
  style: KaraokeStyleSettings
}

const base: KaraokeStyleSettings = {
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

export const STYLE_PRESETS: StylePreset[] = [
  { id: 'classic', name: 'Classic Karaoke', style: { ...base, karaokeColor: '#FFFFFF', strokeWidth: 14 } },
  { id: 'thai-karaoke', name: 'Thai Karaoke', style: { ...base } },
  {
    id: 'colorful',
    name: 'Colorful Syllables',
    style: { ...base, strokeColor: '#1F2937', syllableColoring: 'alternate', palette: ['#F472B6', '#38BDF8', '#FACC15'], highlightColor: '#FFFFFF' },
  },
  {
    id: 'minimal',
    name: 'Minimal Subtitle',
    style: { ...base, thaiSize: 4.5, karaokeSize: 3, karaokeColor: '#E5E7EB', strokeWidth: 0, shadow: 'none', overlay: 'band', overlayOpacity: 50 },
  },
  {
    id: 'neon',
    name: 'Neon Karaoke',
    style: { ...base, thaiColor: '#FFFFFF', karaokeColor: '#A5F3FC', strokeWidth: 0, shadow: 'glow', shadowColor: '#E879F9', highlightColor: '#FDE047' },
  },
  {
    id: 'soft',
    name: 'Soft Aesthetic',
    style: { ...base, thaiColor: '#FDF2F8', karaokeColor: '#FBCFE8', strokeColor: '#831843', strokeWidth: 6, shadowColor: '#831843', highlightColor: '#C4B5FD' },
  },
]

export interface PartialPreset {
  id: string
  name: string
  style: Partial<KaraokeStyleSettings>
}

/** Colors only. */
export const COLOR_PRESETS: PartialPreset[] = [
  { id: 'white-gold', name: 'White & gold', style: { thaiColor: '#FFFFFF', karaokeColor: '#FDE68A', strokeColor: '#000000', highlightColor: '#F87171' } },
  { id: 'ocean', name: 'Ocean', style: { thaiColor: '#E0F2FE', karaokeColor: '#7DD3FC', strokeColor: '#0C4A6E', highlightColor: '#FDE047', palette: ['#7DD3FC', '#A7F3D0', '#C4B5FD'] } },
  { id: 'sunset', name: 'Sunset', style: { thaiColor: '#FFF7ED', karaokeColor: '#FDBA74', strokeColor: '#7C2D12', highlightColor: '#F9A8D4', palette: ['#FDBA74', '#F9A8D4', '#FDE68A'] } },
  { id: 'mono', name: 'Mono', style: { thaiColor: '#FFFFFF', karaokeColor: '#D4D4D4', strokeColor: '#171717', highlightColor: '#FFFFFF', palette: ['#FFFFFF', '#D4D4D4', '#A3A3A3'] } },
  { id: 'pastel', name: 'Pastel', style: { thaiColor: '#FDF2F8', karaokeColor: '#DDD6FE', strokeColor: '#6B21A8', highlightColor: '#FBCFE8', palette: ['#FBCFE8', '#DDD6FE', '#BAE6FD'] } },
]

/** Font sizes and spacing only. */
export const SIZE_PRESETS: PartialPreset[] = [
  { id: 'small', name: 'Small', style: { thaiSize: 4.5, karaokeSize: 3, lineSpacing: 0.5 } },
  { id: 'medium', name: 'Medium', style: { thaiSize: 6, karaokeSize: 4, lineSpacing: 0.6 } },
  { id: 'large', name: 'Large', style: { thaiSize: 8, karaokeSize: 5.5, lineSpacing: 0.6 } },
  { id: 'reading-first', name: 'Reading first', style: { thaiSize: 4.5, karaokeSize: 6.5, lineSpacing: 0.7 } },
]

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toUpperCase() : fallback
}

function number(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clampNumber(value, min, max) : fallback
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback
}

/** Validates a stored custom style; missing or invalid fields fall back to the defaults. */
export function normalizeStyle(value: unknown): KaraokeStyleSettings | null {
  if (typeof value !== 'object' || value === null) return null
  const input = value as Record<string, unknown>
  const palette = Array.isArray(input.palette) ? input.palette : []
  return {
    showThai: typeof input.showThai === 'boolean' ? input.showThai : base.showThai,
    showKaraoke: typeof input.showKaraoke === 'boolean' ? input.showKaraoke : base.showKaraoke,
    thaiSize: number(input.thaiSize, SIZE_RANGE.thai.min, SIZE_RANGE.thai.max, base.thaiSize),
    karaokeSize: number(input.karaokeSize, SIZE_RANGE.karaoke.min, SIZE_RANGE.karaoke.max, base.karaokeSize),
    thaiColor: color(input.thaiColor, base.thaiColor),
    karaokeColor: color(input.karaokeColor, base.karaokeColor),
    strokeColor: color(input.strokeColor, base.strokeColor),
    strokeWidth: number(input.strokeWidth, STROKE_RANGE.min, STROKE_RANGE.max, base.strokeWidth),
    shadow: oneOf(input.shadow, ['none', 'soft', 'strong', 'glow'] as const, base.shadow),
    shadowColor: color(input.shadowColor, base.shadowColor),
    textOpacity: number(input.textOpacity, 10, 100, base.textOpacity),
    lineSpacing: number(input.lineSpacing, LINE_SPACING_RANGE.min, LINE_SPACING_RANGE.max, base.lineSpacing),
    overlay: oneOf(input.overlay, ['none', 'band', 'full'] as const, base.overlay),
    overlayColor: color(input.overlayColor, base.overlayColor),
    overlayOpacity: number(input.overlayOpacity, 0, 100, base.overlayOpacity),
    syllableColoring: oneOf(input.syllableColoring, ['single', 'alternate'] as const, base.syllableColoring),
    palette: [color(palette[0], base.palette[0]), color(palette[1], base.palette[1]), color(palette[2], base.palette[2])],
    highlightColor: color(input.highlightColor, base.highlightColor),
  }
}
