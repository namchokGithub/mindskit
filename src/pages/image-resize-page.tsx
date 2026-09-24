import { Download, Eraser, ImagePlus, Plus, Shrink, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  calculateResizeDimensions,
  canAddResizeJob,
  exportResizeFileName,
  resolveResizeMimeType,
  resolvePixelResizeDimensions,
  resizeToBlob,
  validateImageForResize,
  validateResizeDimensions,
  type ImageSize,
  type ResizeFormat,
} from '@/features/images/resize'
import { cn } from '@/lib/utils'

type ResizeMode = 'pixels' | 'percentage'
type ChangedDimension = 'width' | 'height'

interface ResizeJob {
  id: number
  mode: ResizeMode
  width: string
  height: string
  percentage: string
  changedDimension: ChangedDimension
}

interface ResizeResult {
  id: number
  size: ImageSize
  filename: string
  url: string
  bytes: number
}

const fieldClass = 'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

function newJob(id: number): ResizeJob {
  return { id, mode: 'percentage', width: '', height: '', percentage: '50', changedDimension: 'width' }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function download(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
}

export function ImageResizePage() {
  const [file, setFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [originalSize, setOriginalSize] = useState<ImageSize | null>(null)
  const [jobs, setJobs] = useState<ResizeJob[]>([newJob(1)])
  const [nextJobId, setNextJobId] = useState(2)
  const [keepAspectRatio, setKeepAspectRatio] = useState(true)
  const [format, setFormat] = useState<ResizeFormat>('original')
  const [quality, setQuality] = useState('90')
  const [results, setResults] = useState<ResizeResult[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const imageRef = useRef<HTMLImageElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const clearResults = () => {
    results.forEach((result) => URL.revokeObjectURL(result.url))
    setResults([])
  }

  const handleFile = (nextFile: File) => {
    const validationError = validateImageForResize(nextFile)
    if (validationError) {
      setError(validationError)
      return
    }
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    clearResults()
    setFile(nextFile)
    setImageUrl(URL.createObjectURL(nextFile))
    setOriginalSize(null)
    setError('')
    setProgress(null)
  }

  const clear = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    clearResults()
    setFile(null)
    setImageUrl('')
    setOriginalSize(null)
    setError('')
    setProgress(null)
  }

  const updateJob = (id: number, patch: Partial<ResizeJob>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)))
    clearResults()
    setError('')
  }

  const resolveJobSize = (job: ResizeJob): ImageSize | null => {
    if (!originalSize) return null
    if (job.mode === 'percentage') {
      const percentage = Number(job.percentage)
      if (!Number.isFinite(percentage) || percentage <= 0) return null
      return calculateResizeDimensions(originalSize, { mode: 'percentage', percentage })
    }
    const width = Number(job.width)
    const height = Number(job.height)
    return resolvePixelResizeDimensions(originalSize, { width, height, keepAspectRatio, changedDimension: job.changedDimension })
  }

  const runExport = async () => {
    if (!file || !originalSize || !imageRef.current) return
    const planned = jobs.map((job) => ({ job, size: resolveJobSize(job) }))
    const invalid = planned.find((item) => !item.size || validateResizeDimensions(item.size))
    if (invalid) {
      setError(invalid.size ? validateResizeDimensions(invalid.size) ?? 'Enter a valid size for every row.' : 'Enter a valid size for every row.')
      return
    }

    clearResults()
    setError('')
    setProgress(0)
    const mimeType = resolveResizeMimeType(file.type, format)
    const exportQuality = mimeType === 'image/png' ? undefined : Number(quality) / 100

    try {
      for (let index = 0; index < planned.length; index += 1) {
        const item = planned[index]
        if (!item.size) continue
        const blob = await resizeToBlob(imageRef.current, item.size, mimeType, exportQuality)
        const result = { id: item.job.id, size: item.size, filename: exportResizeFileName(file.name, item.size, mimeType), url: URL.createObjectURL(blob), bytes: blob.size }
        setResults((current) => [...current, result])
        setProgress(index + 1)
      }
    } catch {
      setError('Failed to resize this image.')
    } finally {
      setProgress(null)
    }
  }

  const qualityEnabled = format === 'jpeg' || format === 'webp' || (format === 'original' && file?.type !== 'image/png')
  const exportDisabled = !file || !originalSize || progress !== null

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title="Image Resize" description="Export one PNG, JPEG, or WebP image at multiple sizes entirely in your browser." showRememberInput={false} />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
          <ImagePlus />
          {file ? 'Change image' : 'Choose image'}
        </Button>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) handleFile(selected); event.target.value = '' }} />
        <Button type="button" variant="outline" onClick={clear} disabled={!file || progress !== null}><Eraser />Clear</Button>
      </div>

      <ToolStatus state={error ? 'invalid' : results.length ? 'valid' : 'idle'} message={error || undefined} validLabel={`Exported ${results.length} size${results.length === 1 ? '' : 's'} successfully`} />

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
          <span className="text-xs text-muted-foreground/80">PNG, JPEG, or WebP · up to 20 MiB</span>
        </button>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(22rem,1.2fr)]">
          <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium">Original</h2>{originalSize && <span className="text-xs text-muted-foreground">{originalSize.width} × {originalSize.height} · {formatBytes(file.size)}</span>}</div>
            <div className="flex min-h-52 flex-1 items-center justify-center rounded-lg bg-muted/30 p-3">
              <img ref={imageRef} src={imageUrl} alt="Selected to resize" onLoad={(event) => { const image = event.currentTarget; const size = { width: image.naturalWidth, height: image.naturalHeight }; if (size.width > 10_000 || size.height > 10_000) { setError('Images must be 10,000 px or smaller on each side.'); return }; setOriginalSize(size); setError('') }} onError={() => setError('Could not read this image file.')} className="max-h-80 max-w-full object-contain" />
            </div>
            <p className="text-xs text-muted-foreground">Each export is processed locally, one size at a time. JPEG exports use a white background because JPEG does not support transparency.</p>
          </section>

          <section className="flex min-h-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-muted-foreground">Format<select value={format} onChange={(event) => { setFormat(event.target.value as ResizeFormat); clearResults() }} disabled={progress !== null} className={`${fieldClass} mt-1 block w-36`}><option value="original">Keep original</option><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select></label>
              <label className="text-xs text-muted-foreground">Quality {quality}%<input type="range" min="1" max="100" value={quality} onChange={(event) => { setQuality(event.target.value); clearResults() }} disabled={!qualityEnabled || progress !== null} className="mt-2 block w-32 accent-primary" /></label>
              <label className="flex items-center gap-2 pb-1 text-xs text-muted-foreground"><Checkbox checked={keepAspectRatio} onCheckedChange={(value) => { setKeepAspectRatio(value === true); clearResults() }} disabled={progress !== null} />Keep aspect ratio</label>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <div className="min-w-[38rem] divide-y divide-border">
                <div className="grid grid-cols-[2rem_8rem_1fr_1fr_auto] items-center gap-2 bg-secondary/50 p-2 text-xs font-medium text-muted-foreground"><span>#</span><span>Resize by</span><span>Width / percent</span><span>Height</span><span /></div>
                {jobs.map((job, index) => {
                  const preview = resolveJobSize(job)
                  return <div key={job.id} className="grid grid-cols-[2rem_8rem_1fr_1fr_auto] items-center gap-2 p-2"><span className="text-center text-xs text-muted-foreground">{index + 1}</span><select aria-label={`Resize mode ${index + 1}`} value={job.mode} onChange={(event) => updateJob(job.id, { mode: event.target.value as ResizeMode })} disabled={progress !== null} className={fieldClass}><option value="percentage">Percentage</option><option value="pixels">Pixels</option></select>{job.mode === 'percentage' ? <input aria-label={`Percentage ${index + 1}`} type="number" min="1" step="any" value={job.percentage} onChange={(event) => updateJob(job.id, { percentage: event.target.value })} disabled={progress !== null} className={fieldClass} /> : <input aria-label={`Width ${index + 1}`} type="number" min="1" value={job.width} onChange={(event) => updateJob(job.id, { width: event.target.value, changedDimension: 'width' })} disabled={progress !== null} className={fieldClass} />}{job.mode === 'percentage' ? <span className="text-xs text-muted-foreground">{preview ? `${preview.width} × ${preview.height}px` : 'Enter a value'}</span> : <input aria-label={`Height ${index + 1}`} type="number" min="1" value={keepAspectRatio && preview ? preview.height : job.height} onChange={(event) => updateJob(job.id, { height: event.target.value, changedDimension: 'height' })} disabled={keepAspectRatio || progress !== null} className={fieldClass} />}<Button type="button" size="icon" variant="ghost" aria-label={`Remove size ${index + 1}`} disabled={jobs.length === 1 || progress !== null} onClick={() => { setJobs((current) => current.filter((item) => item.id !== job.id)); clearResults() }}><Trash2 /></Button></div>
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setJobs((current) => (canAddResizeJob(current.length) ? [...current, newJob(nextJobId)] : current)); setNextJobId((current) => current + 1); clearResults() }} disabled={progress !== null || !canAddResizeJob(jobs.length)}><Plus />Add size</Button><Button type="button" onClick={() => void runExport()} disabled={exportDisabled}><Shrink />{progress === null ? `Export ${jobs.length} size${jobs.length === 1 ? '' : 's'}` : `Exporting ${progress}/${jobs.length}…`}</Button></div>

            {results.length > 0 && <div className="min-h-0 overflow-auto rounded-lg border border-border"><div className="border-b border-border bg-secondary/50 px-3 py-2 text-sm font-medium">Downloads</div>{results.map((result) => <div key={result.id} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0"><span className="min-w-0 flex-1 truncate text-sm">{result.filename}</span><span className="shrink-0 text-xs text-muted-foreground">{result.size.width} × {result.size.height} · {formatBytes(result.bytes)}</span><Button type="button" size="sm" variant="outline" onClick={() => download(result.url, result.filename)}><Download />Download</Button></div>)}</div>}
          </section>
        </div>
      )}
    </div>
  )
}
