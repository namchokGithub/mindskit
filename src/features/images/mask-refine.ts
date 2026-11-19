/**
 * Mask refinement and brush editing for Remove Background.
 *
 * The model returns an alpha mask (0–255 per pixel). The page refines it at a working resolution
 * (edge refine → softness → shift edge → feather), then applies the user's brush strokes on top, so a
 * refine change never discards painting. Despill removes the old background color from edge pixels when
 * the result is composed. Everything works on plain typed arrays, so it is testable without a browser.
 */

export interface RefineSettings {
  /** Snap mask edges to detail in the photo (guided filter). */
  edgeRefine: boolean
  /** 0–100: how closely the edge follows the photo. */
  edgeStrength: number
  /** 0 = hard cut-out edge, 100 = the model's soft edge. */
  softness: number
  /** Pixels at working resolution: positive grows the subject, negative shrinks it. */
  shiftEdge: number
  /** Blur radius in pixels at working resolution. */
  feather: number
  /** 0–100: how much of the estimated background color is removed from edge pixels. */
  despill: number
}

export const DEFAULT_REFINE_SETTINGS: RefineSettings = {
  edgeRefine: true,
  edgeStrength: 50,
  softness: 100,
  shiftEdge: 0,
  feather: 0,
  despill: 0,
}

export const MAX_SHIFT_EDGE = 20
export const MAX_FEATHER = 20

export type BrushMode = 'restore' | 'erase'

export interface BrushStroke {
  mode: BrushMode
  /** Brush radius in working pixels. */
  radius: number
  /** 0 = fully soft edge, 1 = hard edge. */
  hardness: number
  /** Flat list of x, y pairs in working pixels. */
  points: number[]
}

/** Brush edits as "target alpha" blended over the refined mask with "weight" (0 = untouched). */
export interface EditLayer {
  target: Float32Array
  weight: Float32Array
}

/** Pixel rectangle; x1/y1 are exclusive. */
export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export type Rgb = [number, number, number]

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

/** Size that fits inside `maxSide` on both sides while keeping the aspect ratio (never upscales). */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale }
}

/** Luma (0–1) of RGBA pixels, used as the guide image. */
export function toGray(rgba: ArrayLike<number>, pixelCount: number): Float32Array {
  const gray = new Float32Array(pixelCount)
  for (let i = 0; i < pixelCount; i += 1) gray[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255
  return gray
}

/** Mean over a (2r+1)² window, clamped at the borders (averages only pixels inside the image). */
export function boxBlur(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.floor(radius)
  if (r < 1) return src.slice()
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const sums = new Float64Array(Math.max(width, height) + 1)
  for (let y = 0; y < height; y += 1) {
    const row = y * width
    for (let x = 0; x < width; x += 1) sums[x + 1] = sums[x] + src[row + x]
    for (let x = 0; x < width; x += 1) {
      const lo = Math.max(0, x - r)
      const hi = Math.min(width, x + r + 1)
      tmp[row + x] = (sums[hi] - sums[lo]) / (hi - lo)
    }
  }
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) sums[y + 1] = sums[y] + tmp[y * width + x]
    for (let y = 0; y < height; y += 1) {
      const lo = Math.max(0, y - r)
      const hi = Math.min(height, y + r + 1)
      out[y * width + x] = (sums[hi] - sums[lo]) / (hi - lo)
    }
  }
  return out
}

/** Guided filter (He et al.): smooths `input` while keeping the edges present in `guide`. */
export function guidedFilter(guide: Float32Array, input: Float32Array, width: number, height: number, radius: number, epsilon: number): Float32Array {
  const n = guide.length
  const guideSquared = new Float32Array(n)
  const guideInput = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    guideSquared[i] = guide[i] * guide[i]
    guideInput[i] = guide[i] * input[i]
  }
  const meanGuide = boxBlur(guide, width, height, radius)
  const meanInput = boxBlur(input, width, height, radius)
  const meanGuideSquared = boxBlur(guideSquared, width, height, radius)
  const meanGuideInput = boxBlur(guideInput, width, height, radius)
  const a = guideSquared
  const b = guideInput
  for (let i = 0; i < n; i += 1) {
    const variance = meanGuideSquared[i] - meanGuide[i] * meanGuide[i]
    const covariance = meanGuideInput[i] - meanGuide[i] * meanInput[i]
    a[i] = covariance / (variance + epsilon)
    b[i] = meanInput[i] - a[i] * meanGuide[i]
  }
  const meanA = boxBlur(a, width, height, radius)
  const meanB = boxBlur(b, width, height, radius)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i += 1) out[i] = clamp01(meanA[i] * guide[i] + meanB[i])
  return out
}

/**
 * Running min or max over a (2r+1)-wide window along one line (van Herk / Gil-Werman, O(n)).
 * Pixels outside the image count as `identity`, so they never win.
 */
function minMaxLine(src: Float32Array, out: Float32Array, offset: number, stride: number, n: number, r: number, isMax: boolean, padded: Float32Array, g: Float32Array, h: Float32Array) {
  const k = 2 * r + 1
  const identity = isMax ? -Infinity : Infinity
  const length = n + 2 * r
  for (let j = 0; j < length; j += 1) padded[j] = j < r || j >= n + r ? identity : src[offset + (j - r) * stride]
  for (let j = 0; j < length; j += 1) {
    const value = padded[j]
    g[j] = j % k === 0 ? value : isMax ? Math.max(g[j - 1], value) : Math.min(g[j - 1], value)
  }
  for (let j = length - 1; j >= 0; j -= 1) {
    const value = padded[j]
    h[j] = j === length - 1 || (j + 1) % k === 0 ? value : isMax ? Math.max(h[j + 1], value) : Math.min(h[j + 1], value)
  }
  for (let i = 0; i < n; i += 1) {
    const left = h[i]
    const right = g[i + 2 * r]
    out[offset + i * stride] = isMax ? Math.max(left, right) : Math.min(left, right)
  }
}

/** Grows (positive) or shrinks (negative) the mask by `pixels` with a square window. */
export function shiftEdge(alpha: Float32Array, width: number, height: number, pixels: number): Float32Array {
  const r = Math.round(Math.abs(pixels))
  if (r < 1) return alpha.slice()
  const isMax = pixels > 0
  const longest = Math.max(width, height) + 2 * r
  const padded = new Float32Array(longest)
  const g = new Float32Array(longest)
  const h = new Float32Array(longest)
  const tmp = new Float32Array(alpha.length)
  const out = new Float32Array(alpha.length)
  for (let y = 0; y < height; y += 1) minMaxLine(alpha, tmp, y * width, 1, width, r, isMax, padded, g, h)
  for (let x = 0; x < width; x += 1) minMaxLine(tmp, out, x, width, height, r, isMax, padded, g, h)
  return out
}

/** Remaps alpha through a ramp centred on 0.5: softness 100 keeps it, 0 makes a hard 0/1 cut. Mutates `alpha`. */
export function applySoftness(alpha: Float32Array, softness: number): Float32Array {
  if (softness >= 100) return alpha
  const half = Math.max(0, softness) / 200
  const lo = 0.5 - half
  const hi = 0.5 + half
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = hi - lo <= 0 ? (alpha[i] >= 0.5 ? 1 : 0) : clamp01((alpha[i] - lo) / (hi - lo))
  return alpha
}

/** Two box-blur passes approximate a Gaussian feather of about `pixels`. */
export function featherMask(alpha: Float32Array, width: number, height: number, pixels: number): Float32Array {
  if (pixels < 1) return alpha
  const radius = Math.max(1, Math.round(pixels / 2))
  return boxBlur(boxBlur(alpha, width, height, radius), width, height, radius)
}

/** Edge-refine radius and epsilon for a strength, scaled to the working size (tuned at 1024 px). */
export function edgeRefineParameters(strength: number, width: number, height: number): { radius: number; epsilon: number } {
  const t = clamp01(strength / 100)
  const scale = Math.max(width, height) / 1024
  return { radius: Math.max(1, Math.round((2 + 8 * t) * scale)), epsilon: 10 ** (-2 - 2.5 * t) }
}

/** Model mask (0–255) → refined alpha (0–1) at the same size. `gray` is only needed for edge refine. */
export function refineMask(baseAlpha: ArrayLike<number>, gray: Float32Array | null, width: number, height: number, settings: RefineSettings): Float32Array {
  let alpha = new Float32Array(width * height)
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = baseAlpha[i] / 255
  if (settings.edgeRefine && gray) {
    const { radius, epsilon } = edgeRefineParameters(settings.edgeStrength, width, height)
    alpha = guidedFilter(gray, alpha, width, height, radius, epsilon)
  }
  applySoftness(alpha, settings.softness)
  if (settings.shiftEdge) alpha = shiftEdge(alpha, width, height, Math.max(-MAX_SHIFT_EDGE, Math.min(MAX_SHIFT_EDGE, settings.shiftEdge)))
  if (settings.feather) alpha = featherMask(alpha, width, height, Math.min(MAX_FEATHER, settings.feather))
  return alpha
}

/** Average color of pixels the model marked as clear background (alpha < 10%), or null if there are none. */
export function estimateBackgroundColor(rgba: ArrayLike<number>, baseAlpha: ArrayLike<number>): Rgb | null {
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < baseAlpha.length; i += 1) {
    if (baseAlpha[i] >= 26) continue
    r += rgba[i * 4]
    g += rgba[i * 4 + 1]
    b += rgba[i * 4 + 2]
    count += 1
  }
  return count ? [r / count, g / count, b / count] : null
}

// ---- brush ----

export function createEditLayer(pixelCount: number): EditLayer {
  return { target: new Float32Array(pixelCount), weight: new Float32Array(pixelCount) }
}

export function cloneEditLayer(layer: EditLayer): EditLayer {
  return { target: layer.target.slice(), weight: layer.weight.slice() }
}

export const emptyRect = (): Rect => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity })
export const isEmptyRect = (rect: Rect) => rect.x1 <= rect.x0 || rect.y1 <= rect.y0

function unionRect(rect: Rect, other: Rect) {
  rect.x0 = Math.min(rect.x0, other.x0)
  rect.y0 = Math.min(rect.y0, other.y0)
  rect.x1 = Math.max(rect.x1, other.x1)
  rect.y1 = Math.max(rect.y1, other.y1)
}

/** Stamps one round dab into `coverage` (keeping the maximum, so a stroke never builds up). Returns its rect. */
function stampDab(coverage: Float32Array, width: number, height: number, cx: number, cy: number, radius: number, hardness: number): Rect {
  const r = Math.max(0.5, radius)
  const x0 = Math.max(0, Math.floor(cx - r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const x1 = Math.min(width, Math.ceil(cx + r) + 1)
  const y1 = Math.min(height, Math.ceil(cy + r) + 1)
  const solid = r * clamp01(hardness)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (distance > r) continue
      let value = distance <= solid ? 1 : 1 - (distance - solid) / (r - solid)
      value = value * value * (3 - 2 * value)
      const index = y * width + x
      if (value > coverage[index]) coverage[index] = value
    }
  }
  return { x0, y0, x1, y1 }
}

/**
 * Adds the dabs of a stroke's points from `fromPoint` (a point index) onward, spaced along each segment.
 * Returns the changed rect.
 */
export function stampStrokeCoverage(coverage: Float32Array, width: number, height: number, stroke: BrushStroke, fromPoint = 0): Rect {
  const dirty = emptyRect()
  const { points, radius, hardness } = stroke
  const count = points.length / 2
  const spacing = Math.max(0.5, radius * 0.25)
  for (let p = Math.max(0, fromPoint); p < count; p += 1) {
    const x = points[p * 2]
    const y = points[p * 2 + 1]
    if (p === 0) {
      unionRect(dirty, stampDab(coverage, width, height, x, y, radius, hardness))
      continue
    }
    const px = points[p * 2 - 2]
    const py = points[p * 2 - 1]
    const steps = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / spacing))
    for (let s = 1; s <= steps; s += 1) unionRect(dirty, stampDab(coverage, width, height, px + ((x - px) * s) / steps, py + ((y - py) * s) / steps, radius, hardness))
  }
  return dirty
}

/** Writes `base` blended with a stroke's coverage into `out` inside `rect` (base and out may be the same layer). */
export function compositeStroke(base: EditLayer, coverage: Float32Array, mode: BrushMode, width: number, rect: Rect, out: EditLayer = base) {
  const target = mode === 'restore' ? 1 : 0
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      const index = y * width + x
      const amount = coverage[index]
      const weight = base.weight[index]
      if (amount <= 0) {
        out.weight[index] = weight
        out.target[index] = base.target[index]
        continue
      }
      const nextWeight = weight + amount * (1 - weight)
      out.target[index] = (base.target[index] * weight * (1 - amount) + target * amount) / nextWeight
      out.weight[index] = nextWeight
    }
  }
}

/** Rebuilds the edit layer from every stroke (used after undo, redo, or reset). */
export function rasterizeStrokes(strokes: readonly BrushStroke[], width: number, height: number): EditLayer {
  const layer = createEditLayer(width * height)
  const coverage = new Float32Array(width * height)
  for (const stroke of strokes) {
    const rect = stampStrokeCoverage(coverage, width, height, stroke)
    if (isEmptyRect(rect)) continue
    compositeStroke(layer, coverage, stroke.mode, width, rect)
    for (let y = rect.y0; y < rect.y1; y += 1) coverage.fill(0, y * width + rect.x0, y * width + rect.x1)
  }
  return layer
}

/** Refined alpha with the brush edits applied on top. */
export function applyEdits(refined: Float32Array, layer: EditLayer | null): Float32Array {
  if (!layer) return refined
  const out = new Float32Array(refined.length)
  for (let i = 0; i < refined.length; i += 1) out[i] = refined[i] + (layer.target[i] - refined[i]) * layer.weight[i]
  return out
}

/** Bilinear resize of an alpha mask (used to apply the working-size mask to the full-size image). */
export function resizeAlpha(src: Float32Array, width: number, height: number, outWidth: number, outHeight: number): Float32Array {
  if (width === outWidth && height === outHeight) return src
  const out = new Float32Array(outWidth * outHeight)
  const scaleX = width / outWidth
  const scaleY = height / outHeight
  for (let y = 0; y < outHeight; y += 1) {
    const sy = Math.min(height - 1, Math.max(0, (y + 0.5) * scaleY - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(height - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < outWidth; x += 1) {
      const sx = Math.min(width - 1, Math.max(0, (x + 0.5) * scaleX - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(width - 1, x0 + 1)
      const fx = sx - x0
      const top = src[y0 * width + x0] + (src[y0 * width + x1] - src[y0 * width + x0]) * fx
      const bottom = src[y1 * width + x0] + (src[y1 * width + x1] - src[y1 * width + x0]) * fx
      out[y * outWidth + x] = top + (bottom - top) * fy
    }
  }
  return out
}

/**
 * Writes the cut-out (RGBA) into `out` inside `rect`: alpha from the refined mask plus brush edits, and for
 * partly transparent pixels the background color `background` removed by `despill` (0–1),
 * from I = αF + (1 − α)B → F = (I − (1 − α)B) / α.
 */
export function composeCutout(
  rgba: ArrayLike<number>,
  refined: Float32Array,
  layer: EditLayer | null,
  background: Rgb | null,
  despill: number,
  out: Uint8ClampedArray,
  width: number,
  rect: Rect,
) {
  const amount = background ? clamp01(despill) : 0
  for (let y = rect.y0; y < rect.y1; y += 1) {
    for (let x = rect.x0; x < rect.x1; x += 1) {
      const index = y * width + x
      const alpha = layer ? clamp01(refined[index] + (layer.target[index] - refined[index]) * layer.weight[index]) : clamp01(refined[index])
      const o = index * 4
      if (amount > 0 && background && alpha > 0 && alpha < 1) {
        const safeAlpha = Math.max(alpha, 0.05)
        for (let c = 0; c < 3; c += 1) {
          const source = rgba[o + c]
          const foreground = (source - (1 - alpha) * background[c]) / safeAlpha
          out[o + c] = source + (foreground - source) * amount
        }
      } else {
        out[o] = rgba[o]
        out[o + 1] = rgba[o + 1]
        out[o + 2] = rgba[o + 2]
      }
      out[o + 3] = Math.round(alpha * 255)
    }
  }
}

export const fullRect = (width: number, height: number): Rect => ({ x0: 0, y0: 0, x1: width, y1: height })
