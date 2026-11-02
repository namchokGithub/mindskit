import { Download, Eraser, Eye, FlipHorizontal2, FlipVertical2, Grid3x3, ImagePlus, RotateCcw, RotateCw, Undo2 } from 'lucide-react'
import { useRef, useState, type CSSProperties } from 'react'

import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  IDENTITY_TRANSFORM,
  MAX_FREE_ANGLE,
  OUTPUT_SIZE_PRESETS,
  applyAspectRatio,
  clampCropRect,
  clampFreeAngle,
  exportFileName,
  fitAspectRatioKeepingArea,
  moveCropRect,
  normalizeQuarterTurns,
  renderCropToBlob,
  resizeCropRect,
  resizeCropToDimensions,
  resolveExportMimeType,
  rotatedBoundingSize,
  totalRotation,
  validateOutputSize,
  type CropCorner,
  type CropRect,
  type ImageBounds,
  type ImageTransform,
} from '@/features/images/crop'
import { resolveExportedMimeType } from '@/features/images/resize'
import { cn } from '@/lib/utils'

const RATIO_OPTIONS: { value: string; label: string; ratio: number | null }[] = [
  { value: 'free', label: 'Freeform', ratio: null },
  { value: '1:1', label: '1:1 (square)', ratio: 1 },
  { value: '4:3', label: '4:3', ratio: 4 / 3 },
  { value: '3:2', label: '3:2', ratio: 3 / 2 },
  { value: '16:9', label: '16:9', ratio: 16 / 9 },
  { value: '9:16', label: '9:16', ratio: 9 / 16 },
]

const PRESET_GROUPS = [...new Set(OUTPUT_SIZE_PRESETS.map((preset) => preset.group))]

const fieldClass = 'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive'

type DragMode = 'move' | CropCorner

interface DragState {
  mode: DragMode
  startPointer: { x: number; y: number }
  startRect: CropRect
}

interface CropResult {
  url: string
  filename: string
  size: ImageBounds
  bytes: number
}

function download(href: string, filename: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Places the image inside a parent box sized like the rotated bounding box and applies rotation/flips with CSS. */
function rotatedImageStyle(natural: ImageBounds, bounding: ImageBounds, transform: ImageTransform): CSSProperties {
  return {
    position: 'absolute',
    width: `${(natural.width / bounding.width) * 100}%`,
    height: `${(natural.height / bounding.height) * 100}%`,
    left: `${((bounding.width - natural.width) / 2 / bounding.width) * 100}%`,
    top: `${((bounding.height - natural.height) / 2 / bounding.height) * 100}%`,
    maxWidth: 'none',
    transform: `rotate(${totalRotation(transform)}deg) scale(${transform.flipH ? -1 : 1}, ${transform.flipV ? -1 : 1})`,
  }
}

/** Maps a crop proportionally into new bounds (after a rotation change) and re-applies the ratio lock. */
function rescaleCrop(rect: CropRect, from: ImageBounds, to: ImageBounds, ratio: number | null): CropRect {
  const scaleX = to.width / from.width
  const scaleY = to.height / from.height
  const scaled = { x: rect.x * scaleX, y: rect.y * scaleY, width: rect.width * scaleX, height: rect.height * scaleY }
  return ratio ? applyAspectRatio(scaled, ratio, to) : clampCropRect(scaled, to)
}

export function ImageCropPage() {
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState('')
  const [imageSrc, setImageSrc] = useState('')
  const [naturalSize, setNaturalSize] = useState<ImageBounds | null>(null)
  const [transform, setTransform] = useState<ImageTransform>(IDENTITY_TRANSFORM)
  const [cropRect, setCropRect] = useState<CropRect | null>(null)
  const [ratioKey, setRatioKey] = useState('free')
  const [outputMode, setOutputMode] = useState('original')
  const [customWidth, setCustomWidth] = useState('1200')
  const [customHeight, setCustomHeight] = useState('630')
  const [showGrid, setShowGrid] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [preview, setPreview] = useState<CropResult | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const customEditStartRef = useRef<CropRect | null>(null)

  // The crop may cover the whole rotated bounding box; empty corners export transparent (PNG/WebP) or white (JPEG).
  const boundsFor = (size: ImageBounds, nextTransform: ImageTransform): CropRect => ({ x: 0, y: 0, ...rotatedBoundingSize(size, totalRotation(nextTransform)) })
  const bounding = naturalSize ? rotatedBoundingSize(naturalSize, totalRotation(transform)) : null
  const safeRect = naturalSize ? boundsFor(naturalSize, transform) : null
  const cropBounds: ImageBounds | null = safeRect ? { width: safeRect.width, height: safeRect.height } : null

  const preset = OUTPUT_SIZE_PRESETS.find((item) => item.id === outputMode)
  const customSize = { width: Number(customWidth), height: Number(customHeight) }
  const customError = outputMode === 'custom' ? validateOutputSize(customSize) : null
  const fixedOutput = preset ? { width: preset.width, height: preset.height } : outputMode === 'custom' && !customError ? customSize : null
  const ratio = fixedOutput ? fixedOutput.width / fixedOutput.height : RATIO_OPTIONS.find((option) => option.value === ratioKey)?.ratio ?? null
  const outputSize: ImageBounds | null = fixedOutput ?? (cropRect ? { width: Math.max(1, Math.round(cropRect.width)), height: Math.max(1, Math.round(cropRect.height)) } : null)

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const initialCrop = (bounds: ImageBounds, nextRatio: number | null) => {
    const inset: CropRect = { x: bounds.width * 0.1, y: bounds.height * 0.1, width: bounds.width * 0.8, height: bounds.height * 0.8 }
    return nextRatio ? applyAspectRatio(inset, nextRatio, bounds) : clampCropRect(inset, bounds)
  }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    clearPreview()
    setError('')
    setFileName(file.name)
    setFileType(file.type)
    setNaturalSize(null)
    setCropRect(null)
    setTransform(IDENTITY_TRANSFORM)
    setImageSrc(URL.createObjectURL(file))
  }

  const handleImageLoad = () => {
    const img = imgRef.current
    if (!img || naturalSize) return
    const size: ImageBounds = { width: img.naturalWidth, height: img.naturalHeight }
    const safe = boundsFor(size, IDENTITY_TRANSFORM)
    setNaturalSize(size)
    setCropRect(initialCrop({ width: safe.width, height: safe.height }, ratio))
  }

  const handleImageError = () => {
    setError('Could not read this image file.')
    setNaturalSize(null)
    setCropRect(null)
  }

  const handleClear = () => {
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    clearPreview()
    setImageSrc('')
    setFileName('')
    setFileType('')
    setNaturalSize(null)
    setCropRect(null)
    setTransform(IDENTITY_TRANSFORM)
    setError('')
  }

  const applyRatio = (nextRatio: number | null) => {
    if (cropRect && cropBounds) setCropRect(applyAspectRatio(cropRect, nextRatio, cropBounds))
  }

  const handleRatioChange = (value: string) => {
    setRatioKey(value)
    applyRatio(RATIO_OPTIONS.find((option) => option.value === value)?.ratio ?? null)
  }

  const handleOutputChange = (value: string) => {
    setOutputMode(value)
    const nextPreset = OUTPUT_SIZE_PRESETS.find((item) => item.id === value)
    if (nextPreset) applyRatio(nextPreset.width / nextPreset.height)
    else if (value === 'custom' && !validateOutputSize(customSize)) applyRatio(customSize.width / customSize.height)
    else applyRatio(RATIO_OPTIONS.find((option) => option.value === ratioKey)?.ratio ?? null)
  }

  const handleCustomSizeFocus = () => {
    customEditStartRef.current = cropRect
  }

  const handleCustomSizeChange = (dimension: 'width' | 'height', value: string) => {
    const next = dimension === 'width' ? { ...customSize, width: Number(value) } : { ...customSize, height: Number(value) }
    if (dimension === 'width') setCustomWidth(value)
    else setCustomHeight(value)
    // Re-fit from the crop as it was when editing started, so intermediate values (typing "8" on the way to "800")
    // never shrink the crop cumulatively.
    const start = customEditStartRef.current ?? cropRect
    if (!validateOutputSize(next) && start && cropBounds) setCropRect(fitAspectRatioKeepingArea(start, next.width / next.height, cropBounds))
  }

  const updateTransform = (next: ImageTransform) => {
    if (!naturalSize || !cropBounds) return
    const nextSafe = boundsFor(naturalSize, next)
    const nextBounds = { width: nextSafe.width, height: nextSafe.height }
    setTransform(next)
    if (cropRect) setCropRect(rescaleCrop(cropRect, cropBounds, nextBounds, ratio))
  }

  const handleCropDimension = (dimension: 'width' | 'height', value: string) => {
    const parsed = Number(value)
    if (!cropRect || !cropBounds || !Number.isFinite(parsed) || parsed < 1) return
    setCropRect(resizeCropToDimensions(cropRect, dimension === 'width' ? { width: parsed } : { height: parsed }, ratio, cropBounds))
  }

  const pointToBounding = (clientX: number, clientY: number) => {
    const wrapper = wrapperRef.current
    if (!wrapper || !bounding) return null
    const rect = wrapper.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    return { x: ((clientX - rect.left) / rect.width) * bounding.width, y: ((clientY - rect.top) / rect.height) * bounding.height }
  }

  const startDrag = (event: React.PointerEvent<HTMLDivElement>, mode: DragMode) => {
    if (!cropRect) return
    event.preventDefault()
    event.stopPropagation()
    const point = pointToBounding(event.clientX, event.clientY)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { mode, startPointer: point, startRect: cropRect }
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || !cropBounds) return
    const point = pointToBounding(event.clientX, event.clientY)
    if (!point) return
    const deltaX = point.x - drag.startPointer.x
    const deltaY = point.y - drag.startPointer.y
    setCropRect(
      drag.mode === 'move'
        ? moveCropRect(drag.startRect, deltaX, deltaY, cropBounds)
        : resizeCropRect(drag.mode, drag.startRect, deltaX, deltaY, ratio, cropBounds),
    )
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const renderResult = async (): Promise<CropResult | null> => {
    if (!imgRef.current || !cropRect || !naturalSize || !safeRect || !outputSize) return null
    if (customError) {
      setError(customError)
      return null
    }
    const mimeType = resolveExportMimeType(fileType)
    const rectInBounding = { ...cropRect, x: safeRect.x + cropRect.x, y: safeRect.y + cropRect.y }
    const blob = await renderCropToBlob(imgRef.current, naturalSize, transform, rectInBounding, outputSize, mimeType, mimeType === 'image/png' ? undefined : 0.92)
    return { url: URL.createObjectURL(blob), filename: exportFileName(fileName, resolveExportedMimeType(mimeType, blob.type)), size: outputSize, bytes: blob.size }
  }

  const runExport = async (mode: 'preview' | 'download') => {
    setBusy(true)
    try {
      const result = await renderResult()
      if (!result) return
      setError('')
      if (mode === 'download') {
        download(result.url, result.filename)
        setTimeout(() => URL.revokeObjectURL(result.url), 1000)
        return
      }
      clearPreview()
      setPreview(result)
      setPreviewOpen(true)
    } catch {
      setError('Failed to crop this image.')
    } finally {
      setBusy(false)
    }
  }

  const ready = Boolean(cropRect && naturalSize && bounding && safeRect)

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <ToolPageHeader
        title="Image Crop"
        description="Crop, rotate, flip, and resize PNG, JPG, and WebP images entirely in your browser."
        showRememberInput={false}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus />
          {imageSrc ? 'Change image' : 'Choose image'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFile(file)
            event.target.value = ''
          }}
        />
        <Button type="button" variant="outline" onClick={handleClear} disabled={!imageSrc}>
          <Eraser />
          Clear
        </Button>
      </div>

      <ToolStatus state={error ? 'invalid' : 'idle'} message={error} />

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
            const file = event.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex min-h-70 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm transition-colors',
            isDraggingFile && 'border-primary bg-primary/5',
          )}
        >
          <ImagePlus className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Drag and drop an image here, or click to browse.</p>
          <p className="text-xs text-muted-foreground/80">PNG, JPG, WebP, GIF, BMP, and more</p>
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div
              ref={wrapperRef}
              className="relative mx-auto w-full max-w-2xl touch-none overflow-hidden rounded-lg bg-black/5 select-none"
              style={bounding ? { aspectRatio: `${bounding.width} / ${bounding.height}` } : undefined}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                onLoad={handleImageLoad}
                onError={handleImageError}
                alt=""
                draggable={false}
                className="block h-auto w-full"
                style={naturalSize && bounding ? rotatedImageStyle(naturalSize, bounding, transform) : undefined}
              />
              {cropRect && bounding && safeRect && (
                <div
                  onPointerDown={(event) => startDrag(event, 'move')}
                  onPointerMove={handlePointerMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  className="absolute cursor-move touch-none border-2 border-white/90"
                  style={{
                    left: `${((safeRect.x + cropRect.x) / bounding.width) * 100}%`,
                    top: `${((safeRect.y + cropRect.y) / bounding.height) * 100}%`,
                    width: `${(cropRect.width / bounding.width) * 100}%`,
                    height: `${(cropRect.height / bounding.height) * 100}%`,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  }}
                >
                  {showGrid && (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-y-0 left-1/3 w-px bg-white/60" />
                      <div className="absolute inset-y-0 left-2/3 w-px bg-white/60" />
                      <div className="absolute inset-x-0 top-1/3 h-px bg-white/60" />
                      <div className="absolute inset-x-0 top-2/3 h-px bg-white/60" />
                    </div>
                  )}
                  {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                    <div
                      key={corner}
                      onPointerDown={(event) => startDrag(event, corner)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      className={cn(
                        'absolute size-4 touch-none rounded-full border-2 border-white bg-primary',
                        corner === 'nw' && '-top-2 -left-2 cursor-nwse-resize',
                        corner === 'se' && '-right-2 -bottom-2 cursor-nwse-resize',
                        corner === 'ne' && '-top-2 -right-2 cursor-nesw-resize',
                        corner === 'sw' && '-bottom-2 -left-2 cursor-nesw-resize',
                      )}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => updateTransform({ ...transform, quarterTurns: normalizeQuarterTurns(transform.quarterTurns - 1) })} disabled={!ready} aria-label="Rotate 90° counterclockwise"><RotateCcw />90°</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => updateTransform({ ...transform, quarterTurns: normalizeQuarterTurns(transform.quarterTurns + 1) })} disabled={!ready} aria-label="Rotate 90° clockwise"><RotateCw />90°</Button>
              <Button type="button" size="sm" variant="outline" aria-pressed={transform.flipH} onClick={() => updateTransform({ ...transform, flipH: !transform.flipH })} disabled={!ready} className={cn(transform.flipH && 'bg-accent text-accent-foreground')}><FlipHorizontal2 />Flip H</Button>
              <Button type="button" size="sm" variant="outline" aria-pressed={transform.flipV} onClick={() => updateTransform({ ...transform, flipV: !transform.flipV })} disabled={!ready} className={cn(transform.flipV && 'bg-accent text-accent-foreground')}><FlipVertical2 />Flip V</Button>
              <Button type="button" size="sm" variant="outline" aria-pressed={showGrid} onClick={() => setShowGrid((value) => !value)} className={cn(showGrid && 'bg-accent text-accent-foreground')}><Grid3x3 />Grid</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
                <span className="shrink-0">Straighten</span>
                <input type="range" min={-MAX_FREE_ANGLE} max={MAX_FREE_ANGLE} step={0.5} value={transform.angle} onChange={(event) => updateTransform({ ...transform, angle: clampFreeAngle(Number(event.target.value)) })} disabled={!ready} aria-label="Rotation angle" className="min-w-0 flex-1 accent-primary" />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="number" min={-MAX_FREE_ANGLE} max={MAX_FREE_ANGLE} step={0.1} value={transform.angle} onChange={(event) => updateTransform({ ...transform, angle: clampFreeAngle(Number(event.target.value)) })} disabled={!ready} aria-label="Rotation angle in degrees" className={cn(fieldClass, 'w-20')} />°
              </label>
              <Button type="button" size="sm" variant="ghost" onClick={() => updateTransform(IDENTITY_TRANSFORM)} disabled={!ready || (transform.angle === 0 && transform.quarterTurns === 0 && !transform.flipH && !transform.flipV)}><Undo2 />Reset</Button>
            </div>
          </section>

          <aside className="flex min-w-0 flex-col gap-4">
            <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-medium">Size</h2>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Aspect ratio
                <Select value={ratioKey} onValueChange={handleRatioChange} disabled={Boolean(fixedOutput)}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RATIO_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {fixedOutput && <span className="text-[0.7rem]">Locked to the output size.</span>}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Crop width (px)<input type="number" min={1} value={cropRect ? Math.round(cropRect.width) : ''} onChange={(event) => handleCropDimension('width', event.target.value)} disabled={!ready} className={fieldClass} /></label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">Crop height (px)<input type="number" min={1} value={cropRect ? Math.round(cropRect.height) : ''} onChange={(event) => handleCropDimension('height', event.target.value)} disabled={!ready} className={fieldClass} /></label>
              </div>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Output size
                <Select value={outputMode} onValueChange={handleOutputChange}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original (crop size)</SelectItem>
                    <SelectItem value="custom">Custom…</SelectItem>
                    {PRESET_GROUPS.map((group) => (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {OUTPUT_SIZE_PRESETS.filter((item) => item.group === group).map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.label} · {item.width} × {item.height}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              {outputMode === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">Output width<input type="number" min={1} value={customWidth} onFocus={handleCustomSizeFocus} onChange={(event) => handleCustomSizeChange('width', event.target.value)} aria-invalid={Boolean(customError)} className={fieldClass} /></label>
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">Output height<input type="number" min={1} value={customHeight} onFocus={handleCustomSizeFocus} onChange={(event) => handleCustomSizeChange('height', event.target.value)} aria-invalid={Boolean(customError)} className={fieldClass} /></label>
                  {customError && <p className="col-span-2 text-xs text-destructive">{customError}</p>}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Preview</h2>
                {outputSize && <span className="text-xs text-muted-foreground">{outputSize.width} × {outputSize.height} px</span>}
              </div>
              <div className="flex justify-center rounded-lg bg-muted/30 p-3">
                {cropRect && naturalSize && bounding && safeRect ? (
                  <div
                    className="relative overflow-hidden rounded-md border border-border"
                    style={{ aspectRatio: `${cropRect.width} / ${cropRect.height}`, width: `min(100%, calc(18rem * ${cropRect.width / cropRect.height}))` }}
                  >
                    <div
                      className="absolute"
                      style={{
                        width: `${(bounding.width / cropRect.width) * 100}%`,
                        height: `${(bounding.height / cropRect.height) * 100}%`,
                        left: `${(-(safeRect.x + cropRect.x) / cropRect.width) * 100}%`,
                        top: `${(-(safeRect.y + cropRect.y) / cropRect.height) * 100}%`,
                      }}
                    >
                      <img src={imageSrc} alt="Crop preview" draggable={false} style={rotatedImageStyle(naturalSize, bounding, transform)} />
                    </div>
                  </div>
                ) : (
                  <span className="py-10 text-sm text-muted-foreground">Loading image…</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void runExport('preview')} disabled={!ready || busy || Boolean(customError)}><Eye />Preview</Button>
                <Button type="button" onClick={() => void runExport('download')} disabled={!ready || busy || Boolean(customError)}><Download />Download</Button>
              </div>
            </section>
          </aside>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crop preview</DialogTitle>
            <DialogDescription>{preview ? `${preview.filename} · ${preview.size.width} × ${preview.size.height} px · ${formatBytes(preview.bytes)}` : ''}</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="flex justify-center rounded-lg bg-muted/30 p-3">
              <img src={preview.url} alt="Rendered crop" className="max-h-[65dvh] max-w-full rounded-md object-contain" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => preview && download(preview.url, preview.filename)} disabled={!preview}><Download />Download {preview?.filename}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
