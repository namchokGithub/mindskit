import { segmentForeground } from '@imgly/background-removal'

/**
 * Only the "isnet" (full, highest-quality) model and CPU-device WASM runtime
 * are self-hosted under /models/bg-removal/ (see scripts/fetch-bg-removal-assets.mjs) —
 * other models/devices are not available and would 404.
 *
 * On the CPU device the library always runs inference on the main thread
 * (it only proxies to a worker when device is "gpu"), so the tab can be
 * unresponsive for a few seconds while an image is processed.
 */

/**
 * Runs the model and returns the foreground mask (one byte per pixel, 0 = background, 255 = subject)
 * at the size of `image`. The model itself works at 1024 × 1024, so callers can pass a downscaled image.
 */
export async function segmentForegroundMask(image: Blob, onProgress?: (key: string, current: number, total: number) => void): Promise<Uint8Array> {
  const blob = await segmentForeground(image, {
    // @imgly builds `new URL(chunk.name, publicPath)` internally — publicPath must be an
    // absolute URL (a root-relative path throws "Failed to construct 'URL': Invalid base URL").
    publicPath: new URL('/models/bg-removal/', window.location.origin).toString(),
    device: 'cpu',
    model: 'isnet',
    // Raw RGBA bytes (white with the mask in alpha); "image/x-alpha8" returns the same RGBA buffer in 1.7.0.
    output: { format: 'image/x-rgba8' },
    progress: onProgress,
  })
  const rgba = new Uint8Array(await blob.arrayBuffer())
  const mask = new Uint8Array(rgba.length / 4)
  for (let i = 0; i < mask.length; i += 1) mask[i] = rgba[i * 4 + 3]
  return mask
}
