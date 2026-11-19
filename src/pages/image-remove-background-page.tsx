import { Brush, Download, Eraser, Eye, Hand, ImagePlus, Maximize, Minus, Plus, Redo2, RotateCcw, Trash2, Undo2, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { EmptyState, ToolPage, WorkspaceCanvas } from '@/components/tool/workspace'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  applyEdits,
  cloneEditLayer,
  composeCutout,
  compositeStroke,
  createEditLayer,
  DEFAULT_REFINE_SETTINGS,
  emptyRect,
  estimateBackgroundColor,
  fitWithin,
  fullRect,
  isEmptyRect,
  MAX_FEATHER,
  MAX_SHIFT_EDGE,
  rasterizeStrokes,
  refineMask,
  resizeAlpha,
  stampStrokeCoverage,
  toGray,
  type BrushMode,
  type BrushStroke,
  type EditLayer,
  type Rect,
  type RefineSettings,
} from '@/features/images/mask-refine'
import { segmentForegroundMask } from '@/features/images/remove-background'
import { MAX_IMAGE_DIMENSION, validateImageForResize } from '@/features/images/resize'
import { cn } from '@/lib/utils'

/** Refinement and painting run at this size; the model itself works at 1024 px. Export uses the original size. */
const WORKING_MAX_SIDE = 2048
const MIN_ZOOM = 0.05
const MAX_ZOOM = 16
const MAX_BRUSH_SIZE = 400
const EMPTY_STROKES: BrushStroke[] = []

type Tool = BrushMode | 'pan'

interface WorkingImage {
  name: string
  width: number
  height: number
  fullWidth: number
  fullHeight: number
  rgba: Uint8ClampedArray
  gray: Float32Array
}

interface StrokeHistory {
  strokes: BrushStroke[]
  undo: BrushStroke[][]
  redo: BrushStroke[][]
}

interface ProgressState {
  key: string
  current: number
  total: number
}

interface View {
  zoom: number
  x: number
  y: number
}

type Drag =
  | { kind: 'pan'; startX: number; startY: number; viewX: number; viewY: number }
  | { kind: 'paint'; stroke: BrushStroke; base: EditLayer; dirty: Rect }

const EMPTY_HISTORY: StrokeHistory = { strokes: EMPTY_STROKES, undo: [], redo: [] }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function exportFileName(originalName: string) {
  const base = originalName.replace(/\.[^./]+$/, '') || 'image'
  return `${base}-no-bg.png`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))), 'image/png'))
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')
  return { canvas, context }
}

/** Error whose message can be shown to the user as-is. */
class ImageLoadError extends Error {}

async function loadWorkingImage(file: File): Promise<{ working: WorkingImage; bitmap: ImageBitmap }> {
  const bitmap = await createImageBitmap(file)
  if (bitmap.width > MAX_IMAGE_DIMENSION || bitmap.height > MAX_IMAGE_DIMENSION) {
    bitmap.close()
    throw new ImageLoadError(`Images must be ${MAX_IMAGE_DIMENSION.toLocaleString()} px or smaller on each side.`)
  }
  const size = fitWithin(bitmap.width, bitmap.height, WORKING_MAX_SIDE)
  const { context } = createCanvas(size.width, size.height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, size.width, size.height)
  const rgba = context.getImageData(0, 0, size.width, size.height).data
  return {
    bitmap,
    working: { name: file.name, width: size.width, height: size.height, fullWidth: bitmap.width, fullHeight: bitmap.height, rgba, gray: toGray(rgba, size.width * size.height) },
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)
}

function RangeField({ label, value, min, max, step = 1, unit = '', disabled, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label className={cn('flex flex-col gap-1 text-xs text-muted-foreground', disabled && 'opacity-60')}>
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-primary" />
    </label>
  )
}

function ControlGroup({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ImageRemoveBackgroundPage() {
  const [working, setWorking] = useState<WorkingImage | null>(null)
  const [baseAlpha, setBaseAlpha] = useState<Uint8Array | null>(null)
  const [refined, setRefined] = useState<Float32Array | null>(null)
  const [settings, setSettings] = useState<RefineSettings>(DEFAULT_REFINE_SETTINGS)
  const [history, setHistory] = useState<StrokeHistory>(EMPTY_HISTORY)
  const [tool, setTool] = useState<Tool>('erase')
  const [brushSize, setBrushSize] = useState(40)
  const [hardness, setHardness] = useState(60)
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [showOriginal, setShowOriginal] = useState(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const bitmapRef = useRef<ImageBitmap | null>(null)
  const layerRef = useRef<EditLayer | null>(null)
  const layerStrokesRef = useRef<BrushStroke[]>(EMPTY_STROKES)
  const coverageRef = useRef<Float32Array | null>(null)
  const dragRef = useRef<Drag | null>(null)
  // Bumped whenever the image changes or the page unmounts, so late async results are ignored.
  const sessionRef = useRef(0)

  useEffect(() => () => {
    sessionRef.current += 1
    bitmapRef.current?.close()
  }, [])

  const background = useMemo(() => (working && baseAlpha ? estimateBackgroundColor(working.rgba, baseAlpha) : null), [working, baseAlpha])
  const hasMask = refined !== null
  const canPaint = hasMask && !showOriginal
  const busy = isLoading || isProcessing || isExporting

  // ---- image lifecycle ----

  const resetImageState = () => {
    sessionRef.current += 1
    bitmapRef.current?.close()
    bitmapRef.current = null
    layerRef.current = null
    layerStrokesRef.current = EMPTY_STROKES
    coverageRef.current = null
    imageDataRef.current = null
    setWorking(null)
    setBaseAlpha(null)
    setRefined(null)
    setHistory(EMPTY_HISTORY)
    setShowOriginal(false)
    setProgress(null)
    setError('')
  }

  const handleFile = async (file: File) => {
    const validationError = validateImageForResize(file)
    if (validationError) {
      setError(validationError)
      return
    }
    resetImageState()
    const session = sessionRef.current
    setIsLoading(true)
    try {
      const { working: next, bitmap } = await loadWorkingImage(file)
      if (session !== sessionRef.current) {
        bitmap.close()
        return
      }
      bitmapRef.current = bitmap
      setWorking(next)
    } catch (cause) {
      if (session === sessionRef.current) setError(cause instanceof ImageLoadError ? cause.message : 'Could not read this image file.')
    } finally {
      if (session === sessionRef.current) setIsLoading(false)
    }
  }

  const runRemoveBackground = async () => {
    if (!working) return
    const session = sessionRef.current
    setIsProcessing(true)
    setError('')
    setProgress(null)
    try {
      const { canvas, context } = createCanvas(working.width, working.height)
      context.putImageData(new ImageData(new Uint8ClampedArray(working.rgba), working.width, working.height), 0, 0)
      const mask = await segmentForegroundMask(await canvasToBlob(canvas), (key, current, total) => {
        if (session === sessionRef.current) setProgress({ key, current, total })
      })
      if (session !== sessionRef.current) return
      if (mask.length !== working.width * working.height) throw new Error('The model returned a mask of an unexpected size.')
      setBaseAlpha(mask)
    } catch (cause) {
      if (session !== sessionRef.current) return
      console.error('[remove-background]', cause)
      setError(`Failed to remove the background: ${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      if (session === sessionRef.current) {
        setIsProcessing(false)
        setProgress(null)
      }
    }
  }

  // ---- refinement (debounced; despill is applied while composing) ----

  const { edgeRefine, edgeStrength, softness, shiftEdge, feather } = settings
  useEffect(() => {
    if (!working || !baseAlpha) {
      setRefined(null)
      setIsRefining(false)
      return
    }
    setIsRefining(true)
    const timer = window.setTimeout(() => {
      setRefined(refineMask(baseAlpha, working.gray, working.width, working.height, { ...DEFAULT_REFINE_SETTINGS, edgeRefine, edgeStrength, softness, shiftEdge, feather }))
      setIsRefining(false)
    }, 120)
    return () => window.clearTimeout(timer)
  }, [working, baseAlpha, edgeRefine, edgeStrength, softness, shiftEdge, feather])

  // ---- rendering ----

  const render = useCallback(
    (rect?: Rect) => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      if (!canvas || !context || !working) return
      if (canvas.width !== working.width || canvas.height !== working.height) {
        canvas.width = working.width
        canvas.height = working.height
      }
      let imageData = imageDataRef.current
      if (!imageData || imageData.width !== working.width || imageData.height !== working.height) {
        imageData = context.createImageData(working.width, working.height)
        imageDataRef.current = imageData
      }
      if (!refined || showOriginal) {
        imageData.data.set(working.rgba)
        context.putImageData(imageData, 0, 0)
        return
      }
      const area = rect ?? fullRect(working.width, working.height)
      if (isEmptyRect(area)) return
      composeCutout(working.rgba, refined, layerRef.current, background, settings.despill / 100, imageData.data, working.width, area)
      context.putImageData(imageData, 0, 0, area.x0, area.y0, area.x1 - area.x0, area.y1 - area.y0)
    },
    [working, refined, showOriginal, background, settings.despill],
  )

  // Rebuild the brush layer after undo/redo/reset (a finished stroke already updated it), then redraw.
  useEffect(() => {
    if (working && layerStrokesRef.current !== history.strokes) {
      layerRef.current = history.strokes.length ? rasterizeStrokes(history.strokes, working.width, working.height) : null
      layerStrokesRef.current = history.strokes
    }
    render()
  }, [render, history.strokes, working])

  // ---- view (zoom / pan) ----

  const fitView = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || !working) return
    const padding = 16
    const zoom = clamp(Math.min((viewport.clientWidth - padding * 2) / working.width, (viewport.clientHeight - padding * 2) / working.height), MIN_ZOOM, MAX_ZOOM)
    setView({ zoom, x: (viewport.clientWidth - working.width * zoom) / 2, y: (viewport.clientHeight - working.height * zoom) / 2 })
  }, [working])

  useEffect(() => {
    if (working) fitView()
  }, [working, fitView])

  const zoomAt = useCallback((factor: number, pointX?: number, pointY?: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const px = pointX ?? viewport.clientWidth / 2
    const py = pointY ?? viewport.clientHeight / 2
    setView((current) => {
      const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const ratio = zoom / current.zoom
      return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio }
    })
  }, [])

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !working) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [working, zoomAt])

  // ---- history ----

  const undo = useCallback(() => setHistory((current) => (current.undo.length ? { strokes: current.undo[current.undo.length - 1], undo: current.undo.slice(0, -1), redo: [...current.redo, current.strokes] } : current)), [])
  const redo = useCallback(() => setHistory((current) => (current.redo.length ? { strokes: current.redo[current.redo.length - 1], undo: [...current.undo, current.strokes], redo: current.redo.slice(0, -1) } : current)), [])
  const resetEdits = () => setHistory((current) => (current.strokes.length ? { strokes: EMPTY_STROKES, undo: [...current.undo, current.strokes], redo: [] } : current))

  useEffect(() => {
    if (!working) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      } else if (event.key === ' ') {
        event.preventDefault()
        setSpaceDown(true)
      } else if (event.key === '[') {
        setBrushSize((size) => clamp(Math.round(size / 1.2), 1, MAX_BRUSH_SIZE))
      } else if (event.key === ']') {
        setBrushSize((size) => clamp(Math.round(size * 1.2) + 1, 1, MAX_BRUSH_SIZE))
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') setSpaceDown(false)
    }
    const onBlur = () => setSpaceDown(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [working, undo, redo])

  // ---- pointer: paint and pan ----

  const isPanning = tool === 'pan' || spaceDown

  const toImagePoint = (event: ReactPointerEvent) => {
    const rect = viewportRef.current!.getBoundingClientRect()
    return [(event.clientX - rect.left - view.x) / view.zoom, (event.clientY - rect.top - view.y) / view.zoom] as const
  }

  const moveCursor = (event: ReactPointerEvent) => {
    const cursor = cursorRef.current
    const viewport = viewportRef.current
    if (!cursor || !viewport) return
    const rect = viewport.getBoundingClientRect()
    const diameter = brushSize * view.zoom
    cursor.style.width = `${diameter}px`
    cursor.style.height = `${diameter}px`
    cursor.style.transform = `translate(${event.clientX - rect.left - diameter / 2}px, ${event.clientY - rect.top - diameter / 2}px)`
    cursor.style.opacity = canPaint && !isPanning ? '1' : '0'
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!working || (event.button !== 0 && event.button !== 1)) return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (isPanning || event.button === 1) {
      dragRef.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, viewX: view.x, viewY: view.y }
      return
    }
    if (!canPaint || tool === 'pan') return
    const [x, y] = toImagePoint(event)
    const pixelCount = working.width * working.height
    if (!layerRef.current) layerRef.current = createEditLayer(pixelCount)
    if (!coverageRef.current || coverageRef.current.length !== pixelCount) coverageRef.current = new Float32Array(pixelCount)
    const stroke: BrushStroke = { mode: tool, radius: brushSize / 2, hardness: hardness / 100, points: [x, y] }
    const drag: Drag = { kind: 'paint', stroke, base: cloneEditLayer(layerRef.current), dirty: emptyRect() }
    dragRef.current = drag
    paintFrom(drag, 0)
  }

  const paintFrom = (drag: Extract<Drag, { kind: 'paint' }>, fromPoint: number) => {
    if (!working || !layerRef.current || !coverageRef.current) return
    const rect = stampStrokeCoverage(coverageRef.current, working.width, working.height, drag.stroke, fromPoint)
    if (isEmptyRect(rect)) return
    compositeStroke(drag.base, coverageRef.current, drag.stroke.mode, working.width, rect, layerRef.current)
    drag.dirty = { x0: Math.min(drag.dirty.x0, rect.x0), y0: Math.min(drag.dirty.y0, rect.y0), x1: Math.max(drag.dirty.x1, rect.x1), y1: Math.max(drag.dirty.y1, rect.y1) }
    render(rect)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    moveCursor(event)
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'pan') {
      setView((current) => ({ ...current, x: drag.viewX + event.clientX - drag.startX, y: drag.viewY + event.clientY - drag.startY }))
      return
    }
    const [x, y] = toImagePoint(event)
    drag.stroke.points.push(x, y)
    paintFrom(drag, drag.stroke.points.length / 2 - 1)
  }

  const finishDrag = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || drag.kind !== 'paint' || !working) return
    const coverage = coverageRef.current
    if (coverage && !isEmptyRect(drag.dirty)) {
      for (let y = drag.dirty.y0; y < drag.dirty.y1; y += 1) coverage.fill(0, y * working.width + drag.dirty.x0, y * working.width + drag.dirty.x1)
    }
    // The live stroke already updated the layer; mark it as matching so it is not rebuilt.
    const strokes = [...history.strokes, drag.stroke]
    layerStrokesRef.current = strokes
    setHistory({ strokes, undo: [...history.undo, history.strokes], redo: [] })
  }

  // ---- export ----

  const exportPng = async () => {
    if (!working || !refined) return
    setIsExporting(true)
    setError('')
    try {
      const alpha = applyEdits(refined, layerRef.current)
      const { fullWidth: width, fullHeight: height } = working
      const { canvas, context } = createCanvas(width, height)
      let rgba: Uint8ClampedArray = working.rgba
      if (width !== working.width || height !== working.height) {
        if (!bitmapRef.current) throw new Error('The original image is no longer available. Choose it again.')
        context.drawImage(bitmapRef.current, 0, 0)
        rgba = context.getImageData(0, 0, width, height).data
      }
      const output = context.createImageData(width, height)
      composeCutout(rgba, resizeAlpha(alpha, working.width, working.height, width, height), null, background, settings.despill / 100, output.data, width, fullRect(width, height))
      context.putImageData(output, 0, 0)
      downloadBlob(await canvasToBlob(canvas), exportFileName(working.name))
    } catch (cause) {
      console.error('[remove-background]', cause)
      setError(`Could not export the PNG: ${cause instanceof Error ? cause.message : String(cause)}`)
    } finally {
      setIsExporting(false)
    }
  }

  const updateSettings = (patch: Partial<RefineSettings>) => setSettings((current) => ({ ...current, ...patch }))
  const progressLabel = progress && progress.total > 0 ? `${progress.key} — ${Math.round((progress.current / progress.total) * 100)}%` : null
  const scaleNote = working && (working.fullWidth !== working.width || working.fullHeight !== working.height)
    ? `Editing at ${working.width} × ${working.height}; the PNG is exported at ${working.fullWidth} × ${working.fullHeight}.`
    : null

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      className="hidden"
      onChange={(event) => {
        const nextFile = event.target.files?.[0]
        if (nextFile) void handleFile(nextFile)
        event.target.value = ''
      }}
    />
  )

  const preview = !working ? (
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
        if (droppedFile) void handleFile(droppedFile)
      }}
      className="flex min-h-80 flex-1"
    >
      <EmptyState
        icon={ImagePlus}
        title={isLoading ? 'Loading image…' : 'Choose an image'}
        hint="Drag and drop a PNG, JPEG, or WebP here (up to 20 MiB and 10,000 px per side). Everything runs in your browser."
        action={<Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><ImagePlus />Choose image</Button>}
        className={cn('transition-colors', isDraggingFile && 'border-primary bg-primary/5')}
      />
    </div>
  ) : (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" aria-pressed={showOriginal} onClick={() => setShowOriginal((value) => !value)} disabled={!hasMask} className={cn(showOriginal && 'bg-accent text-accent-foreground')}>
            <Eye />Original
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {isProcessing ? (progressLabel ?? 'Removing background…') : isRefining ? 'Refining edges…' : !hasMask ? 'Original image' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom out"><Minus /></Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(view.zoom * 100)}%</span>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => zoomAt(1.25)} aria-label="Zoom in"><Plus /></Button>
          <Button type="button" size="sm" variant="ghost" onClick={fitView}><Maximize />Fit</Button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={cn('relative min-h-80 flex-1 touch-none overflow-hidden rounded-lg border border-border select-none', isPanning ? 'cursor-grab' : canPaint ? 'cursor-none' : 'cursor-default')}
        style={{ backgroundImage: 'repeating-conic-gradient(#8883 0% 25%, transparent 0% 50%)', backgroundSize: '16px 16px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerLeave={() => {
          if (cursorRef.current) cursorRef.current.style.opacity = '0'
        }}
        onAuxClick={(event) => event.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={hasMask ? 'Image with the background removed' : 'Original image'}
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, imageRendering: view.zoom > 2 ? 'pixelated' : 'auto' }}
        />
        <div ref={cursorRef} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 rounded-full border border-white opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]" />
      </div>
      <p className="text-xs text-muted-foreground">
        Scroll to zoom. Hold Space or use the hand tool to pan. Use [ and ] to change the brush size. {scaleNote}
      </p>
    </>
  )

  const controls = (
    <>
      <ControlGroup title="Image">
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={() => void runRemoveBackground()} disabled={!working || busy || hasMask}>
            <Wand2 />
            {isProcessing ? 'Removing background…' : hasMask ? 'Background removed' : 'Remove background'}
          </Button>
          <Button type="button" variant="outline" onClick={() => void exportPng()} disabled={!hasMask || busy || isRefining}>
            <Download />
            {isExporting ? 'Exporting…' : 'Download PNG'}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy}><ImagePlus />{working ? 'Change' : 'Choose'}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={resetImageState} disabled={!working || busy}><Trash2 />Clear</Button>
          </div>
        </div>
      </ControlGroup>

      <ControlGroup
        title="Brush"
        action={
          <div className="flex items-center gap-1">
            <Button type="button" size="icon-sm" variant="ghost" onClick={undo} disabled={!history.undo.length} aria-label="Undo (Ctrl/Cmd+Z)" title="Undo (Ctrl/Cmd+Z)"><Undo2 /></Button>
            <Button type="button" size="icon-sm" variant="ghost" onClick={redo} disabled={!history.redo.length} aria-label="Redo (Ctrl/Cmd+Shift+Z)" title="Redo (Ctrl/Cmd+Shift+Z)"><Redo2 /></Button>
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Brush tool">
          {([
            ['restore', 'Restore', Brush],
            ['erase', 'Erase', Eraser],
            ['pan', 'Pan', Hand],
          ] as const).map(([value, label, Icon]) => (
            <Button key={value} type="button" size="sm" variant="outline" aria-pressed={tool === value} onClick={() => setTool(value)} disabled={!hasMask} className={cn(tool === value && 'bg-accent text-accent-foreground')}>
              <Icon />{label}
            </Button>
          ))}
        </div>
        <RangeField label="Size" value={brushSize} min={1} max={MAX_BRUSH_SIZE} unit=" px" disabled={!hasMask} onChange={setBrushSize} />
        <RangeField label="Hardness" value={hardness} min={0} max={100} unit="%" disabled={!hasMask} onChange={setHardness} />
        <Button type="button" size="sm" variant="ghost" onClick={resetEdits} disabled={!history.strokes.length} className="self-start"><RotateCcw />Reset edits</Button>
      </ControlGroup>

      <ControlGroup
        title="Refine edges"
        action={<Button type="button" size="sm" variant="ghost" onClick={() => setSettings(DEFAULT_REFINE_SETTINGS)} disabled={!hasMask}>Reset</Button>}
      >
        <label className={cn('flex items-center gap-2 text-sm', !hasMask && 'opacity-60')}>
          <Checkbox checked={settings.edgeRefine} onCheckedChange={(checked) => updateSettings({ edgeRefine: checked === true })} disabled={!hasMask} />
          Edge refine
        </label>
        <RangeField label="Edge detail" value={settings.edgeStrength} min={0} max={100} unit="%" disabled={!hasMask || !settings.edgeRefine} onChange={(value) => updateSettings({ edgeStrength: value })} />
        <RangeField label="Softness" value={settings.softness} min={0} max={100} unit="%" disabled={!hasMask} onChange={(value) => updateSettings({ softness: value })} />
        <RangeField label="Shift edge" value={settings.shiftEdge} min={-MAX_SHIFT_EDGE} max={MAX_SHIFT_EDGE} unit=" px" disabled={!hasMask} onChange={(value) => updateSettings({ shiftEdge: value })} />
        <RangeField label="Feather" value={settings.feather} min={0} max={MAX_FEATHER} unit=" px" disabled={!hasMask} onChange={(value) => updateSettings({ feather: value })} />
        <RangeField label="Despill" value={settings.despill} min={0} max={100} unit="%" disabled={!hasMask || !background} onChange={(value) => updateSettings({ despill: value })} />
        {hasMask && !background && <p className="text-xs text-muted-foreground">Despill needs some clear background in the photo to estimate its color.</p>}
      </ControlGroup>
    </>
  )

  return (
    <ToolPage>
      <ToolPageHeader
        title="Remove Background"
        description="Remove image backgrounds entirely in your browser using a local AI model, then refine the edges and fix areas with a brush. First run downloads ~90MB and may take a while; cached afterward."
        showRememberInput={false}
      />
      {fileInput}
      <WorkspaceCanvas className="min-h-0 flex-1" preview={preview} controls={controls} />
      <ToolStatus state={error ? 'invalid' : 'idle'} message={error} />
    </ToolPage>
  )
}
