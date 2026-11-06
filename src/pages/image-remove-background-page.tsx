import { Download, Eraser, ImagePlus, Wand2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { removeImageBackground } from '@/features/images/remove-background'
import { cn } from '@/lib/utils'

function download(href: string, filename: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function exportFileName(originalName: string) {
  const base = originalName.replace(/\.[^./]+$/, '') || 'image'
  return `${base}-no-bg.png`
}

interface ProgressState {
  key: string
  current: number
  total: number
}

export function ImageRemoveBackgroundPage() {
  const [file, setFile] = useState<File | null>(null)
  const [imageSrc, setImageSrc] = useState('')
  const [resultUrl, setResultUrl] = useState('')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const objectUrlsRef = useRef({ imageSrc: '', resultUrl: '' })

  useEffect(() => {
    objectUrlsRef.current = { imageSrc, resultUrl }
  }, [imageSrc, resultUrl])

  // Revoke the latest object URLs when leaving the page; replacements are revoked where they happen.
  useEffect(() => () => {
    const { imageSrc: latestImageSrc, resultUrl: latestResultUrl } = objectUrlsRef.current
    if (latestImageSrc) URL.revokeObjectURL(latestImageSrc)
    if (latestResultUrl) URL.revokeObjectURL(latestResultUrl)
  }, [])

  const handleFile = (nextFile: File) => {
    if (!nextFile.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setError('')
    setResultUrl('')
    setProgress(null)
    setFile(nextFile)
    setImageSrc(URL.createObjectURL(nextFile))
  }

  const handleClear = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    if (resultUrl) URL.revokeObjectURL(resultUrl)
    setFile(null)
    setImageSrc('')
    setResultUrl('')
    setError('')
    setProgress(null)
  }

  const runRemoveBackground = async () => {
    if (!file) return
    setIsProcessing(true)
    setError('')
    setProgress(null)
    try {
      const blob = await removeImageBackground(file, (key, current, total) => setProgress({ key, current, total }))
      if (resultUrl) URL.revokeObjectURL(resultUrl)
      setResultUrl(URL.createObjectURL(blob))
    } catch (cause) {
      console.error('[remove-background]', cause)
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(`Failed to remove the background: ${message}`)
    } finally {
      setIsProcessing(false)
      setProgress(null)
    }
  }

  const progressLabel = progress && progress.total > 0 ? `${progress.key} — ${Math.round((progress.current / progress.total) * 100)}%` : null

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader
        title="Remove Background"
        description="Remove image backgrounds entirely in your browser using a local AI model. First run downloads ~90MB and may take a while; cached afterward."
        showRememberInput={false}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
          <ImagePlus />
          {imageSrc ? 'Change image' : 'Choose image'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const nextFile = event.target.files?.[0]
            if (nextFile) handleFile(nextFile)
            event.target.value = ''
          }}
        />
        <Button type="button" onClick={() => void runRemoveBackground()} disabled={!file || isProcessing}>
          <Wand2 />
          {isProcessing ? 'Removing background…' : 'Remove background'}
        </Button>
        <Button type="button" variant="outline" onClick={handleClear} disabled={!imageSrc || isProcessing}>
          <Eraser />
          Clear
        </Button>
      </div>

      <ToolStatus state={error ? 'invalid' : 'idle'} message={error} />
      {progressLabel && <p className="text-xs text-muted-foreground">{progressLabel}</p>}

      <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        {!imageSrc ? (
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setIsDraggingFile(true)
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(event) => {
              event.preventDefault()
              setIsDraggingFile(false)
              const droppedFile = event.dataTransfer.files[0]
              if (droppedFile) handleFile(droppedFile)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex min-h-70 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center transition-colors',
              isDraggingFile && 'border-primary bg-primary/5',
            )}
          >
            <ImagePlus className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag and drop an image here, or click to browse.</p>
            <p className="text-xs text-muted-foreground/80">PNG, JPG, WebP, and more</p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex min-h-0 flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">Original</span>
              <div className="flex min-h-70 flex-1 items-center justify-center overflow-auto rounded-lg border border-border bg-muted/30 p-3">
                <img src={imageSrc} alt="Original" className="max-h-full max-w-full object-contain" />
              </div>
            </div>
            <div className="flex min-h-0 flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">Background removed</span>
              <div
                className="flex min-h-70 flex-1 items-center justify-center overflow-auto rounded-lg border border-border p-3"
                style={{ backgroundImage: 'repeating-conic-gradient(#8883 0% 25%, transparent 0% 50%)', backgroundSize: '16px 16px' }}
              >
                {resultUrl ? (
                  <img src={resultUrl} alt="Background removed" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-center text-sm text-muted-foreground">
                    {isProcessing ? 'Processing…' : 'Result will appear here.'}
                  </span>
                )}
              </div>
              {resultUrl && (
                <Button type="button" variant="outline" onClick={() => download(resultUrl, exportFileName(file?.name ?? 'image'))}>
                  <Download />
                  Download PNG
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
