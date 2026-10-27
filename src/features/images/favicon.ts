import type { ImageSize } from './resize.ts'

export const FAVICON_SIZES = [16, 32, 48] as const

/** Longest side of the intermediate square canvas; enough for crisp downscaling without huge memory use. */
const MAX_WORKING_SIZE = 1024

export interface DrawRect {
  x: number
  y: number
  width: number
  height: number
}

/** Fits the whole image inside a `side` × `side` square, centered, leaving transparent padding. */
export function fitInSquare(source: ImageSize, side: number): DrawRect {
  const scale = side / Math.max(source.width, source.height)
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  return { x: Math.floor((side - width) / 2), y: Math.floor((side - height) / 2), width, height }
}

/** Sizes to step through, halving each time, so a large image is not downscaled to 16 px in one aliased draw. */
export function downscaleSteps(from: number, to: number): number[] {
  const steps: number[] = []
  let current = from
  while (current / 2 > to) {
    current = Math.round(current / 2)
    steps.push(current)
  }
  steps.push(to)
  return steps
}

/**
 * Packs PNG images into an ICO container. Each entry stores PNG data directly, which every current browser and
 * Windows Vista+ supports. Sizes must be 1–256 px.
 */
export function encodeIco(images: { size: number; png: Uint8Array }[]): Uint8Array {
  if (images.length === 0) throw new Error('An ICO file needs at least one image.')
  const headerSize = 6
  const entrySize = 16
  const dataOffset = headerSize + entrySize * images.length
  const totalSize = dataOffset + images.reduce((sum, image) => sum + image.png.byteLength, 0)
  const bytes = new Uint8Array(totalSize)
  const view = new DataView(bytes.buffer)

  view.setUint16(0, 0, true) // reserved
  view.setUint16(2, 1, true) // type: icon
  view.setUint16(4, images.length, true)

  let offset = dataOffset
  images.forEach((image, index) => {
    if (!Number.isInteger(image.size) || image.size < 1 || image.size > 256) throw new Error(`Icon size ${image.size} must be 1–256 px.`)
    const entry = headerSize + entrySize * index
    view.setUint8(entry, image.size === 256 ? 0 : image.size) // width (0 means 256)
    view.setUint8(entry + 1, image.size === 256 ? 0 : image.size) // height
    view.setUint8(entry + 2, 0) // palette colors
    view.setUint8(entry + 3, 0) // reserved
    view.setUint16(entry + 4, 1, true) // color planes
    view.setUint16(entry + 6, 32, true) // bits per pixel
    view.setUint32(entry + 8, image.png.byteLength, true)
    view.setUint32(entry + 12, offset, true)
    bytes.set(image.png, offset)
    offset += image.png.byteLength
  })

  return bytes
}

function createCanvas(side: number) {
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context is unavailable.')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  return { canvas, context }
}

/** Renders one square PNG favicon from a decoded image (browser only). */
export async function renderFaviconPng(source: CanvasImageSource, sourceSize: ImageSize, size: number): Promise<Blob> {
  const workingSide = Math.min(Math.max(sourceSize.width, sourceSize.height), MAX_WORKING_SIZE)
  let current = createCanvas(workingSide)
  const rect = fitInSquare(sourceSize, workingSide)
  current.context.drawImage(source, rect.x, rect.y, rect.width, rect.height)

  for (const step of downscaleSteps(workingSide, size)) {
    const next = createCanvas(step)
    next.context.drawImage(current.canvas, 0, 0, step, step)
    current = next
  }

  return new Promise((resolve, reject) => {
    current.canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to render the favicon.'))), 'image/png')
  })
}

export async function buildFaviconIco(pngs: { size: number; blob: Blob }[]): Promise<Blob> {
  const images = await Promise.all(pngs.map(async ({ size, blob }) => ({ size, png: new Uint8Array(await blob.arrayBuffer()) })))
  return new Blob([encodeIco(images)], { type: 'image/x-icon' })
}
