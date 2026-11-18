/** Saves a blob as a file through a temporary link attached to the DOM. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadDataUrl(dataUrl: string, filename: string) {
  downloadBlob(await (await fetch(dataUrl)).blob(), filename)
}

/** Serializes an inline SVG element (with explicit size) and saves it. */
export function downloadSvgElement(svg: SVGSVGElement, filename: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const text = new XMLSerializer().serializeToString(clone)
  downloadBlob(new Blob([text], { type: 'image/svg+xml' }), filename)
}
