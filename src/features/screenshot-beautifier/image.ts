const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export const MAX_SCREENSHOT_FILE_SIZE = 20 * 1024 * 1024
export const MAX_SCREENSHOT_DIMENSION = 10_000

export function validateScreenshotFile(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) return 'Choose a PNG, JPEG, or WebP image.'
  if (file.size > MAX_SCREENSHOT_FILE_SIZE) return 'Images must be 20 MiB or smaller.'
  return null
}

export function validateScreenshotDimensions(size: { width: number; height: number }): string | null {
  if (size.width > MAX_SCREENSHOT_DIMENSION || size.height > MAX_SCREENSHOT_DIMENSION) {
    return `Images must be ${MAX_SCREENSHOT_DIMENSION.toLocaleString()} px or smaller on each side.`
  }
  return null
}

export function extractImageFileFromClipboard(items: readonly Pick<DataTransferItem, 'kind' | 'type' | 'getAsFile'>[]): File | null {
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
