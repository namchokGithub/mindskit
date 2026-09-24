export interface ImageSize {
  width: number
  height: number
}

export type ResizeFormat = 'original' | 'png' | 'jpeg' | 'webp'

export type ResizeInput =
  | {
      mode: 'pixels'
      width: number
      height: number
      keepAspectRatio: boolean
      changedDimension: 'width' | 'height'
    }
  | { mode: 'percentage'; percentage: number }

export interface PixelResizeInput {
  width: number
  height: number
  keepAspectRatio: boolean
  changedDimension: 'width' | 'height'
}

interface ImageFileMetadata {
  type: string
  size: number
}

const MAX_FILE_SIZE = 20 * 1024 * 1024
export const MAX_IMAGE_DIMENSION = 10_000
export const MAX_RESIZE_JOBS = 10
const EXPORTABLE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function toDimension(value: number): number {
  return Math.max(1, Math.round(value))
}

export function canAddResizeJob(jobCount: number): boolean {
  return jobCount < MAX_RESIZE_JOBS
}

export function calculateResizeDimensions(original: ImageSize, input: ResizeInput): ImageSize {
  if (input.mode === 'percentage') {
    return { width: toDimension((original.width * input.percentage) / 100), height: toDimension((original.height * input.percentage) / 100) }
  }

  if (!input.keepAspectRatio) return { width: toDimension(input.width), height: toDimension(input.height) }

  if (input.changedDimension === 'width') {
    return { width: toDimension(input.width), height: toDimension((input.width * original.height) / original.width) }
  }

  return { width: toDimension((input.height * original.width) / original.height), height: toDimension(input.height) }
}

/** Returns null when the dimension that controls this resize is not a positive finite number. */
export function resolvePixelResizeDimensions(original: ImageSize, input: PixelResizeInput): ImageSize | null {
  if (input.keepAspectRatio) {
    if (input.changedDimension === 'width') {
      if (!Number.isFinite(input.width) || input.width <= 0) return null
    } else if (!Number.isFinite(input.height) || input.height <= 0) {
      return null
    }
  } else if (!Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) {
    return null
  }

  return calculateResizeDimensions(original, { mode: 'pixels', ...input })
}

export function validateImageForResize(file: ImageFileMetadata): string | null {
  if (!EXPORTABLE_MIME_TYPES.has(file.type)) return 'Choose a PNG, JPEG, or WebP image.'
  if (file.size > MAX_FILE_SIZE) return 'Images must be 20 MiB or smaller.'
  return null
}

export function validateResizeDimensions(size: ImageSize): string | null {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width < 1 || size.height < 1) return 'Enter a valid image size.'
  if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) return `Output dimensions must be ${MAX_IMAGE_DIMENSION.toLocaleString()} px or smaller.`
  return null
}

export function resolveResizeMimeType(inputType: string, format: ResizeFormat): string {
  if (format === 'original') return EXPORTABLE_MIME_TYPES.has(inputType) ? inputType : 'image/png'
  return `image/${format}`
}

export function exportResizeFileName(originalName: string, size: ImageSize, mimeType: string): string {
  const base = originalName.replace(/\.[^./]+$/, '') || 'image'
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
  return `${base}-${size.width}x${size.height}.${extension}`
}

export function resizeToBlob(source: CanvasImageSource, size: ImageSize, mimeType: string, quality?: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Canvas 2D context is unavailable.'))

  if (mimeType === 'image/jpeg') {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, size.width, size.height)
  }
  context.drawImage(source, 0, 0, size.width, size.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to export the resized image.'))), mimeType, quality)
  })
}
