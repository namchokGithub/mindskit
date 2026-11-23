/**
 * Passes one image from an image tool's result to another image tool ("Send to…").
 *
 * The image stays in this module's memory only: it is never written to storage, and a page reload drops it.
 * The receiving page reads it on mount and clears it once loaded (not on read, so React StrictMode's
 * mount → unmount → mount in development still finds it).
 */

export interface ImageHandoff {
  id: number
  file: File
  /** Name of the tool that produced the image, shown on the receiving page. */
  from: string
  /** Route path of the receiving tool. */
  to: string
}

let pending: ImageHandoff | null = null
let nextId = 1

/** Stores `file` for the tool at `to`, replacing anything not yet received. */
export function sendImage(file: File, from: string, to: string): ImageHandoff {
  pending = { id: nextId, file, from, to }
  nextId += 1
  return pending
}

/** The image waiting for the tool at `path`, if any. */
export function peekImageHandoff(path: string): ImageHandoff | null {
  return pending && pending.to === path ? pending : null
}

/** Clears the handoff if it is still the one with `id`. */
export function clearImageHandoff(id: number) {
  if (pending?.id === id) pending = null
}

/** Handed-off images are always PNG (lossless between steps): `photo-cropped.jpg` → `photo-cropped.png`. */
export function handoffFileName(name: string): string {
  const base = name.replace(/\.[^./]+$/, '') || 'image'
  return `${base}.png`
}

/** A PNG `File` for handing off; the type is forced so receiving pages accept it. */
export function toHandoffFile(blob: Blob, name: string): File {
  return new File([blob], handoffFileName(name), { type: 'image/png' })
}

/**
 * Validation input for a received image. Handed-off images skip the 20 MiB upload limit (a full-size PNG from
 * another tool can exceed it); type and pixel-dimension checks still apply.
 */
export function handoffValidationInput(file: File, received: boolean): { type: string; size: number } {
  return received ? { type: file.type, size: 0 } : file
}
