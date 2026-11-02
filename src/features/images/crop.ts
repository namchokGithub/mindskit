export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageBounds {
  width: number
  height: number
}

export type CropCorner = 'nw' | 'ne' | 'sw' | 'se'

const MIN_CROP_SIZE = 1

const EXPORTABLE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

/** Keeps a crop rect fully inside the image bounds with a minimum usable size. */
export function clampCropRect(rect: CropRect, bounds: ImageBounds): CropRect {
  const width = Math.min(Math.max(rect.width, MIN_CROP_SIZE), bounds.width)
  const height = Math.min(Math.max(rect.height, MIN_CROP_SIZE), bounds.height)
  const x = Math.min(Math.max(rect.x, 0), bounds.width - width)
  const y = Math.min(Math.max(rect.y, 0), bounds.height - height)
  return { x, y, width, height }
}

/** Re-fits a rect to a locked aspect ratio (width / height), anchored on its center. Pass `ratio: null` for freeform. */
export function applyAspectRatio(rect: CropRect, ratio: number | null, bounds: ImageBounds): CropRect {
  if (!ratio) return clampCropRect(rect, bounds)

  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2

  let width = rect.width
  let height = width / ratio
  if (height > bounds.height) {
    height = bounds.height
    width = height * ratio
  }
  if (width > bounds.width) {
    width = bounds.width
    height = width / ratio
  }

  return clampCropRect({ x: centerX - width / 2, y: centerY - height / 2, width, height }, bounds)
}

/**
 * Re-fits a rect to a new aspect ratio while keeping its area and center, so a crop changes shape instead of
 * collapsing toward one dimension. Falls back to the largest fit when the bounds are too small.
 */
export function fitAspectRatioKeepingArea(rect: CropRect, ratio: number, bounds: ImageBounds): CropRect {
  const area = rect.width * rect.height
  let width = Math.sqrt(area * ratio)
  let height = width / ratio
  if (width > bounds.width) {
    width = bounds.width
    height = width / ratio
  }
  if (height > bounds.height) {
    height = bounds.height
    width = height * ratio
  }
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  return clampCropRect({ x: centerX - width / 2, y: centerY - height / 2, width, height }, bounds)
}

/** Moves a rect by a pointer delta (in natural image pixels), clamped to bounds. */
export function moveCropRect(startRect: CropRect, deltaX: number, deltaY: number, bounds: ImageBounds): CropRect {
  return clampCropRect({ ...startRect, x: startRect.x + deltaX, y: startRect.y + deltaY }, bounds)
}

/**
 * Resizes a rect by dragging one corner, anchored on the opposite corner.
 * If `ratio` is set, height always follows width. Bounded to stay inside the image.
 */
export function resizeCropRect(
  corner: CropCorner,
  startRect: CropRect,
  deltaX: number,
  deltaY: number,
  ratio: number | null,
  bounds: ImageBounds,
): CropRect {
  const anchorX = corner === 'nw' || corner === 'sw' ? startRect.x + startRect.width : startRect.x
  const anchorY = corner === 'nw' || corner === 'ne' ? startRect.y + startRect.height : startRect.y
  const freeX = corner === 'nw' || corner === 'sw' ? startRect.x + deltaX : startRect.x + startRect.width + deltaX
  const freeY = corner === 'nw' || corner === 'ne' ? startRect.y + deltaY : startRect.y + startRect.height + deltaY

  // Room between the anchor and the image edge; limiting to it keeps the anchor fixed and the ratio intact at the edges.
  const availableWidth = corner === 'nw' || corner === 'sw' ? anchorX : bounds.width - anchorX
  const availableHeight = corner === 'nw' || corner === 'ne' ? anchorY : bounds.height - anchorY

  let width = Math.min(availableWidth, Math.max(MIN_CROP_SIZE, corner === 'nw' || corner === 'sw' ? anchorX - freeX : freeX - anchorX))
  let height = Math.min(availableHeight, Math.max(MIN_CROP_SIZE, corner === 'nw' || corner === 'ne' ? anchorY - freeY : freeY - anchorY))
  if (ratio) {
    width = Math.min(width, availableHeight * ratio)
    height = width / ratio
  }

  const x = corner === 'nw' || corner === 'sw' ? anchorX - width : anchorX
  const y = corner === 'nw' || corner === 'ne' ? anchorY - height : anchorY

  return clampCropRect({ x, y, width, height }, bounds)
}

/** PNG/JPG/WebP round-trip as-is; anything canvas can decode but not re-encode (GIF, BMP, AVIF, …) falls back to PNG. */
export function resolveExportMimeType(inputType: string): string {
  return EXPORTABLE_MIME_TYPES.has(inputType) ? inputType : 'image/png'
}

export function exportFileName(originalName: string, mimeType: string): string {
  const base = originalName.replace(/\.[^./]+$/, '') || 'image'
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
  return `${base}-cropped.${extension}`
}

export interface ImageTransform {
  /** Clockwise 90° turns, 0–3. */
  quarterTurns: number
  /** Free rotation in degrees, −45 to 45, applied on top of the quarter turns. */
  angle: number
  flipH: boolean
  flipV: boolean
}

export const IDENTITY_TRANSFORM: ImageTransform = { quarterTurns: 0, angle: 0, flipH: false, flipV: false }

export const MAX_FREE_ANGLE = 45

export function normalizeQuarterTurns(turns: number): number {
  return ((Math.round(turns) % 4) + 4) % 4
}

export function clampFreeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  return Math.min(MAX_FREE_ANGLE, Math.max(-MAX_FREE_ANGLE, angle))
}

/** Total clockwise rotation in degrees. */
export function totalRotation(transform: ImageTransform): number {
  return normalizeQuarterTurns(transform.quarterTurns) * 90 + clampFreeAngle(transform.angle)
}

/** Size of the axis-aligned box that holds the whole rotated image. */
export function rotatedBoundingSize(size: ImageBounds, degrees: number): ImageBounds {
  const radians = (degrees * Math.PI) / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  return {
    width: Math.max(1, Math.round(size.width * cos + size.height * sin)),
    height: Math.max(1, Math.round(size.width * sin + size.height * cos)),
  }
}

/**
 * Largest axis-aligned rectangle that fits inside the rotated image, centered in its bounding box. Crops are limited to
 * this area so an export never contains empty corners.
 */
export function maxInscribedRect(size: ImageBounds, degrees: number): CropRect {
  const bounding = rotatedBoundingSize(size, degrees)
  const radians = (degrees * Math.PI) / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  const widthIsLonger = size.width >= size.height
  const longSide = widthIsLonger ? size.width : size.height
  const shortSide = widthIsLonger ? size.height : size.width
  let width: number
  let height: number

  if (shortSide <= 2 * sin * cos * longSide || Math.abs(sin - cos) < 1e-10) {
    const half = shortSide / 2
    width = widthIsLonger ? half / sin : half / cos
    height = widthIsLonger ? half / cos : half / sin
  } else {
    const cos2 = cos * cos - sin * sin
    width = (size.width * cos - size.height * sin) / cos2
    height = (size.height * cos - size.width * sin) / cos2
  }

  const roundedWidth = Math.max(1, Math.min(bounding.width, Math.floor(width + 1e-6)))
  const roundedHeight = Math.max(1, Math.min(bounding.height, Math.floor(height + 1e-6)))
  return {
    x: Math.ceil((bounding.width - roundedWidth) / 2),
    y: Math.ceil((bounding.height - roundedHeight) / 2),
    width: Math.min(roundedWidth, bounding.width - Math.ceil((bounding.width - roundedWidth) / 2)),
    height: Math.min(roundedHeight, bounding.height - Math.ceil((bounding.height - roundedHeight) / 2)),
  }
}

/** Sets the crop box to an exact width × height (pixels), keeping its center, then clamps it to the bounds. */
export function resizeCropToDimensions(
  rect: CropRect,
  dimensions: { width?: number; height?: number },
  ratio: number | null,
  bounds: ImageBounds,
): CropRect {
  let width = dimensions.width ?? rect.width
  let height = dimensions.height ?? rect.height
  if (ratio) {
    if (dimensions.height !== undefined && dimensions.width === undefined) width = height * ratio
    else height = width / ratio
  }
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  return applyAspectRatio({ x: centerX - width / 2, y: centerY - height / 2, width, height }, ratio, bounds)
}

export interface OutputSizePreset {
  id: string
  group: string
  label: string
  width: number
  height: number
}

export const OUTPUT_SIZE_PRESETS: OutputSizePreset[] = [
  { id: 'instagram-post', group: 'Social', label: 'Instagram post', width: 1080, height: 1080 },
  { id: 'instagram-portrait', group: 'Social', label: 'Instagram portrait', width: 1080, height: 1350 },
  { id: 'story', group: 'Social', label: 'Story / Reel', width: 1080, height: 1920 },
  { id: 'og-image', group: 'Social', label: 'Facebook / LinkedIn / OG image', width: 1200, height: 630 },
  { id: 'x-post', group: 'Social', label: 'X post', width: 1600, height: 900 },
  { id: 'hd', group: 'Screen / video', label: 'HD', width: 1280, height: 720 },
  { id: 'full-hd', group: 'Screen / video', label: 'Full HD', width: 1920, height: 1080 },
  { id: '4k', group: 'Screen / video', label: '4K', width: 3840, height: 2160 },
  { id: 'avatar', group: 'Avatar / icon', label: 'Avatar', width: 400, height: 400 },
  { id: 'youtube-thumbnail', group: 'Avatar / icon', label: 'YouTube thumbnail', width: 1280, height: 720 },
  { id: 'app-icon', group: 'Avatar / icon', label: 'App icon', width: 1024, height: 1024 },
  { id: 'a4', group: 'Print (300 dpi)', label: 'A4', width: 2480, height: 3508 },
  { id: '4x6', group: 'Print (300 dpi)', label: '4 × 6 in', width: 1200, height: 1800 },
]

export const MAX_OUTPUT_DIMENSION = 10_000

export function validateOutputSize(size: ImageBounds): string | null {
  if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 1 || size.height < 1) return 'Enter a whole-number output size.'
  if (size.width > MAX_OUTPUT_DIMENSION || size.height > MAX_OUTPUT_DIMENSION) return `Output size must be ${MAX_OUTPUT_DIMENSION.toLocaleString()} px or smaller per side.`
  return null
}

/**
 * Renders the crop straight from the source image: rotation, flips, crop, and output scaling happen in one draw, so no
 * full-size rotated intermediate canvas is needed. `rect` is in rotated (bounding-box) pixel coordinates.
 */
export function renderCropToBlob(
  source: CanvasImageSource,
  sourceSize: ImageBounds,
  transform: ImageTransform,
  rect: CropRect,
  output: ImageBounds,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(output.width))
  canvas.height = Math.max(1, Math.round(output.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas 2D context is unavailable.'))

  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const degrees = totalRotation(transform)
  const bounding = rotatedBoundingSize(sourceSize, degrees)
  ctx.scale(canvas.width / rect.width, canvas.height / rect.height)
  ctx.translate(-rect.x + bounding.width / 2, -rect.y + bounding.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1)
  ctx.drawImage(source, -sourceSize.width / 2, -sourceSize.height / 2, sourceSize.width, sourceSize.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to export the cropped image.'))), mimeType, quality)
  })
}
