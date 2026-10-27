import { Download, Eraser, ImagePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { FAVICON_SIZES, buildFaviconIco, renderFaviconPng } from '@/features/images/favicon'
import { MAX_IMAGE_DIMENSION, validateImageForResize, type ImageSize } from '@/features/images/resize'
import { cn } from '@/lib/utils'

interface FaviconPreview {
  size: number
  blob: Blob
  url: string
}

function download(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function FaviconGeneratorPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [previews, setPreviews] = useState<FaviconPreview[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const previewsRef = useRef<FaviconPreview[]>([])

  const replacePreviews = (next: FaviconPreview[]) => {
    previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url))
    previewsRef.current = next
    setPreviews(next)
  }

  useEffect(() => () => previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview.url)), [])

  const handleFile = (nextFile: File) => {
    const validationError = validateImageForResize(nextFile)
    if (validationError) {
      setError(validationError)
      return
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    replacePreviews([])
    setFile(nextFile)
    setImageUrl(URL.createObjectURL(nextFile))
    setError('')
    setDownloaded(false)
  }

  const clear = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    replacePreviews([])
    setFile(null)
    setImageUrl('')
    setError('')
    setDownloaded(false)
  }

  const renderPreviews = async (image: HTMLImageElement) => {
    const size: ImageSize = { width: image.naturalWidth, height: image.naturalHeight }
    if (size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) {
      setError(`Images must be ${MAX_IMAGE_DIMENSION.toLocaleString()} px or smaller on each side.`)
      return
    }
    setBusy(true)
    try {
      const next = await Promise.all(
        FAVICON_SIZES.map(async (iconSize) => {
          const blob = await renderFaviconPng(image, size, iconSize)
          return { size: iconSize, blob, url: URL.createObjectURL(blob) }
        }),
      )
      replacePreviews(next)
      setError('')
    } catch {
      setError('Could not create favicons from this image.')
    } finally {
      setBusy(false)
    }
  }

  const downloadIco = async () => {
    if (previews.length === 0) return
    setBusy(true)
    try {
      const ico = await buildFaviconIco(previews)
      const url = URL.createObjectURL(ico)
      download(url, 'favicon.ico')
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setDownloaded(true)
    } catch {
      setError('Could not build favicon.ico.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title="Favicon Generator" description="Create a favicon.ico with 16, 32, and 48 px icons from a PNG, JPEG, or WebP image, entirely in your browser." showRememberInput={false} />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          <ImagePlus />
          {file ? 'Change image' : 'Choose image'}
        </Button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) handleFile(selected); event.target.value = '' }} />
        <Button type="button" variant="outline" onClick={clear} disabled={!file || busy}><Eraser />Clear</Button>
      </div>

      <ToolStatus state={error ? 'invalid' : downloaded ? 'valid' : 'idle'} message={error || undefined} validLabel="favicon.ico downloaded" />

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => { event.preventDefault(); setIsDraggingFile(true) }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(event) => { event.preventDefault(); setIsDraggingFile(false); const dropped = event.dataTransfer.files[0]; if (dropped) handleFile(dropped) }}
          className={cn('flex min-h-70 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm transition-colors', isDraggingFile && 'border-primary bg-primary/5')}
        >
          <ImagePlus className="size-7 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Drag and drop an image here, or click to browse.</span>
          <span className="text-xs text-muted-foreground/80">PNG, JPEG, or WebP · up to 20 MiB · a square image of 512 px or larger works best</span>
        </button>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(22rem,1.2fr)]">
          <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-medium">Original</h2>
            <div className="flex min-h-52 flex-1 items-center justify-center rounded-lg bg-muted/30 p-3">
              <img src={imageUrl} alt="Selected for favicon" onLoad={(event) => void renderPreviews(event.currentTarget)} onError={() => setError('Could not read this image file.')} className="max-h-80 max-w-full object-contain" />
            </div>
            <p className="text-xs text-muted-foreground">Non-square images are centered and padded with transparency. Processing stays in this browser.</p>
          </section>

          <section className="flex min-h-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-medium">Favicon preview</h2>
            {(['bg-background', 'bg-foreground'] as const).map((background) => (
              <div key={background} className={cn('flex flex-wrap items-end gap-6 rounded-lg border border-border p-4', background)}>
                {previews.length === 0 ? (
                  <span className={cn('text-sm', background === 'bg-foreground' ? 'text-background' : 'text-muted-foreground')}>{busy ? 'Rendering…' : 'Waiting for the image…'}</span>
                ) : previews.map((preview) => (
                  <figure key={preview.size} className="flex flex-col items-center gap-2">
                    <img src={preview.url} alt={`${preview.size} × ${preview.size} favicon`} width={preview.size} height={preview.size} className="[image-rendering:pixelated]" />
                    <figcaption className={cn('text-xs', background === 'bg-foreground' ? 'text-background' : 'text-muted-foreground')}>{preview.size} px</figcaption>
                  </figure>
                ))}
              </div>
            ))}
            <div>
              <Button type="button" onClick={() => void downloadIco()} disabled={previews.length === 0 || busy}>
                <Download />
                Download favicon.ico
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
