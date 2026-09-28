export function exportScreenshotFileName(originalFileName: string | null, extension: 'png' | 'jpg'): string {
  if (!originalFileName) return `mindskit-screenshot.${extension}`
  const base = originalFileName.replace(/\.[^./]+$/, '') || 'screenshot'
  return `${base}-beautified.${extension}`
}

export function isClipboardImageCopySupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.write) && typeof ClipboardItem !== 'undefined'
}

export async function exportCanvasToBlob(node: HTMLElement, format: 'png' | 'jpg', pixelRatio: number, backgroundColor: string): Promise<Blob> {
  const { toCanvas } = await import('html-to-image')
  const canvas = await toCanvas(node, { pixelRatio, backgroundColor })
  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpg' ? 0.9 : undefined
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to export the composed image.'))), mimeType, quality)
  })
}

export async function copyBlobToClipboard(blob: Blob): Promise<void> {
  if (!isClipboardImageCopySupported()) throw new Error('Copying images is not supported in this browser. Use Download instead.')
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
}
