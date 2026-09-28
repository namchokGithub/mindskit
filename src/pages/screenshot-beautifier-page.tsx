import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Download, ImagePlus, RotateCcw, Trash2 } from 'lucide-react'

import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'
import { backgroundCss, DEFAULT_DESIGN, mergePersistedPreferences, resetDesign, serializePersistedPreferences, type FramePreset, type ScreenshotDesign } from '@/features/screenshot-beautifier/model'
import { CANVAS_SIZE_PRESETS, findGradientPreset, FRAME_CHROME, FRAME_OPTIONS, GRADIENT_PRESETS, PERSPECTIVE_PRESETS, POSITION_ALIGN, POSITION_OPTIONS, SHADOW_CSS } from '@/features/screenshot-beautifier/presets'
import { resolveCanvasSize, resolveExportPixelRatio, resolveFittedScreenshotSize } from '@/features/screenshot-beautifier/layout'
import { copyBlobToClipboard, exportCanvasToBlob, exportScreenshotFileName, isClipboardImageCopySupported } from '@/features/screenshot-beautifier/export'
import { extractImageFileFromClipboard, formatFileSize, validateScreenshotDimensions, validateScreenshotFile } from '@/features/screenshot-beautifier/image'
import { cn } from '@/lib/utils'

export function ScreenshotBeautifierPage() {
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [error, setError] = useState('')
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const { enabled: rememberInputEnabled } = useSaveLocally()
  const [storedPrefs, setStoredPrefs] = usePersistedInput('screenshot-beautifier-prefs', rememberInputEnabled)

  const [design, setDesign] = useState<ScreenshotDesign>(() =>
    mergePersistedPreferences({ ...DEFAULT_DESIGN, background: { ...DEFAULT_DESIGN.background } }, storedPrefs, (id) => findGradientPreset(id)),
  )

  const updateDesign = (patch: Partial<ScreenshotDesign>) => setDesign((current) => ({ ...current, ...patch }))
  const updateBackground = (patch: Partial<ScreenshotDesign['background']>) =>
    setDesign((current) => ({ ...current, background: { ...current.background, ...patch } }))

  const imageRef = useRef<HTMLImageElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const stageWrapperRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  const canvasSize = naturalSize ? resolveCanvasSize(design, naturalSize) : { width: 1, height: 1 }
  const chrome = FRAME_CHROME[design.frame]
  const fitted = naturalSize ? resolveFittedScreenshotSize(canvasSize, design.padding, chrome, naturalSize, design.scale) : { width: 1, height: 1 }
  const align = POSITION_ALIGN[design.position]

  const [exportStatus, setExportStatus] = useState<'idle' | 'preparing' | 'exporting' | 'copying'>('idle')
  const lastResultUrlRef = useRef('')

  const backgroundColorForExport = design.background.type === 'solid' ? design.background.color : design.background.gradientFrom

  const runExport = async (format: 'png' | 'jpg') => {
    if (!stageRef.current || exportStatus !== 'idle') return
    setExportStatus('preparing')
    try {
      const pixelRatio = resolveExportPixelRatio(canvasSize)
      setExportStatus('exporting')
      const blob = await exportCanvasToBlob(stageRef.current, format, pixelRatio, backgroundColorForExport)
      if (lastResultUrlRef.current) URL.revokeObjectURL(lastResultUrlRef.current)
      const url = URL.createObjectURL(blob)
      lastResultUrlRef.current = url
      const filename = exportScreenshotFileName(screenshotFile?.name ?? null, format)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      toast.success(`Exported ${filename}`)
    } catch {
      toast.error('Failed to export this screenshot.')
    } finally {
      setExportStatus('idle')
    }
  }

  const runCopy = async () => {
    if (!stageRef.current || exportStatus !== 'idle') return
    if (!isClipboardImageCopySupported()) {
      toast.error('Copying images is not supported in this browser. Use Download instead.')
      return
    }
    setExportStatus('copying')
    try {
      const pixelRatio = resolveExportPixelRatio(canvasSize)
      const blob = await exportCanvasToBlob(stageRef.current, 'png', pixelRatio, backgroundColorForExport)
      await copyBlobToClipboard(blob)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy the image. Use Download instead.')
    } finally {
      setExportStatus('idle')
    }
  }

  const resetToDefaults = () => setDesign(resetDesign())

  const handleFile = async (file: File) => {
    const validationError = validateScreenshotFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    let bitmap: ImageBitmap
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      setError('Could not read this image file.')
      return
    }
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    const dimensionError = validateScreenshotDimensions(size)
    if (dimensionError) {
      setError(dimensionError)
      return
    }
    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl)
    setScreenshotFile(file)
    setScreenshotUrl(URL.createObjectURL(file))
    setNaturalSize(size)
    setError('')
  }

  const removeImage = () => {
    if (screenshotUrl) URL.revokeObjectURL(screenshotUrl)
    setScreenshotFile(null)
    setScreenshotUrl('')
    setNaturalSize(null)
    setError('')
  }

  const handleScreenshotError = () => {
    removeImage()
    setError('Could not read this image file.')
  }

  useEffect(() => {
    return () => {
      if (screenshotUrl) URL.revokeObjectURL(screenshotUrl)
    }
  }, [screenshotUrl])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditableTarget = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (isEditableTarget) return
      const items = Array.from(event.clipboardData?.items ?? [])
      const file = extractImageFileFromClipboard(items)
      if (!file) {
        setError('Clipboard does not contain an image.')
        return
      }
      event.preventDefault()
      handleFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenshotUrl])

  useLayoutEffect(() => {
    const wrapper = stageWrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(() => {
      const availableWidth = wrapper.clientWidth
      const availableHeight = wrapper.clientHeight
      if (availableWidth === 0 || availableHeight === 0 || canvasSize.width === 0 || canvasSize.height === 0) return
      setPreviewScale(Math.min(1, availableWidth / canvasSize.width, availableHeight / canvasSize.height))
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [canvasSize.width, canvasSize.height])

  useEffect(() => {
    return () => {
      if (lastResultUrlRef.current) URL.revokeObjectURL(lastResultUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (!rememberInputEnabled) return
    setStoredPrefs(serializePersistedPreferences(design))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rememberInputEnabled, design.canvasPreset, design.background.gradientPresetId, design.frame])

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader
        title="Screenshot Beautifier"
        description="Create polished screenshots with gradients, frames, spacing, shadows, and perspective — directly in your browser."
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" onClick={() => inputRef.current?.click()}>
          <ImagePlus />
          {screenshotFile ? 'Change screenshot' : 'Choose screenshot'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0]
            if (selected) handleFile(selected)
            event.target.value = ''
          }}
        />
        {screenshotFile && (
          <Button type="button" variant="outline" onClick={removeImage}>
            <Trash2 />
            Remove image
          </Button>
        )}
        {naturalSize && screenshotFile && (
          <span className="text-xs text-muted-foreground">
            {screenshotFile.name} · {naturalSize.width} × {naturalSize.height} · {screenshotFile.type} · {formatFileSize(screenshotFile.size)}
          </span>
        )}
      </div>

      <ToolStatus state={error ? 'invalid' : 'idle'} message={error} />

      {!screenshotFile ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDraggingFile(true)
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDraggingFile(false)
            const dropped = event.dataTransfer.files[0]
            if (dropped) handleFile(dropped)
          }}
          className={cn(
            'flex min-h-70 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-sm transition-colors',
            isDraggingFile && 'border-primary bg-primary/5',
          )}
        >
          <ImagePlus className="size-7 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Drag and drop a screenshot here, paste from your clipboard, or click to browse.</span>
          <span className="text-xs text-muted-foreground/80">PNG, JPEG, or WebP · up to 20 MiB</span>
        </button>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
            <section className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-sm lg:w-75 lg:shrink-0">
              <div className="space-y-2">
                <h2 className="text-sm font-medium">Canvas</h2>
                <Select value={design.canvasPreset} onValueChange={(value) => updateDesign({ canvasPreset: value as ScreenshotDesign['canvasPreset'] })}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANVAS_SIZE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium">Background</h2>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={design.background.type === 'solid' ? 'default' : 'outline'} onClick={() => updateBackground({ type: 'solid' })}>Solid</Button>
                  <Button type="button" size="sm" variant={design.background.type === 'gradient' ? 'default' : 'outline'} onClick={() => updateBackground({ type: 'gradient' })}>Gradient</Button>
                </div>
                {design.background.type === 'solid' ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Color
                    <input aria-label="Background color" type="color" value={design.background.color} onChange={(event) => updateBackground({ color: event.target.value })} className="h-8 w-16 cursor-pointer rounded-lg border border-input bg-transparent p-1" />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {GRADIENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          aria-label={preset.name}
                          title={preset.name}
                          onClick={() => updateBackground({ gradientFrom: preset.from, gradientTo: preset.to, gradientAngle: preset.angle, gradientPresetId: preset.id })}
                          className={cn('size-7 rounded-full border-2', design.background.gradientPresetId === preset.id ? 'border-primary' : 'border-transparent')}
                          style={{ background: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input aria-label="Gradient start color" type="color" value={design.background.gradientFrom} onChange={(event) => updateBackground({ gradientFrom: event.target.value, gradientPresetId: null })} className="h-8 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1" />
                      <input aria-label="Gradient end color" type="color" value={design.background.gradientTo} onChange={(event) => updateBackground({ gradientTo: event.target.value, gradientPresetId: null })} className="h-8 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1" />
                      <label className="flex flex-1 items-center gap-1.5">
                        Angle {design.background.gradientAngle}°
                        <input aria-label="Gradient angle" type="range" min="0" max="360" value={design.background.gradientAngle} onChange={(event) => updateBackground({ gradientAngle: Number(event.target.value), gradientPresetId: null })} className="flex-1 accent-primary" />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <label className="space-y-1.5 text-xs text-muted-foreground">
                Padding {design.padding}px
                <input aria-label="Padding" type="range" min={0} max={200} value={design.padding} onChange={(event) => updateDesign({ padding: Number(event.target.value) })} className="block w-full accent-primary" />
              </label>

              <label className="space-y-1.5 text-xs text-muted-foreground">
                Radius {design.radius}px
                <input aria-label="Border radius" type="range" min={0} max={48} value={design.radius} onChange={(event) => updateDesign({ radius: Number(event.target.value) })} className="block w-full accent-primary" />
              </label>

              <div className="space-y-1.5">
                <h2 className="text-sm font-medium">Shadow</h2>
                <div className="flex flex-wrap gap-1.5">
                  {(['none', 'soft', 'medium', 'strong'] as const).map((level) => (
                    <Button key={level} type="button" size="sm" variant={design.shadow === level ? 'default' : 'outline'} onClick={() => updateDesign({ shadow: level })}>
                      {level[0].toUpperCase() + level.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <label className="space-y-1.5 text-xs text-muted-foreground">
                Scale {design.scale}%
                <input aria-label="Screenshot scale" type="range" min={50} max={120} value={design.scale} onChange={(event) => updateDesign({ scale: Number(event.target.value) })} className="block w-full accent-primary" />
              </label>

              <div className="space-y-1.5">
                <h2 className="text-sm font-medium">Position</h2>
                <div className="flex flex-wrap gap-1.5">
                  {POSITION_OPTIONS.map((option) => (
                    <Button key={option.id} type="button" size="sm" variant={design.position === option.id ? 'default' : 'outline'} onClick={() => updateDesign({ position: option.id })}>
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-sm font-medium">Frame</h2>
                <div className="flex flex-wrap gap-1.5">
                  {FRAME_OPTIONS.map((option) => (
                    <Button key={option.id} type="button" size="sm" variant={design.frame === option.id ? 'default' : 'outline'} onClick={() => updateDesign({ frame: option.id })}>
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-sm font-medium">Perspective</h2>
                <div className="flex flex-wrap gap-1.5">
                  {PERSPECTIVE_PRESETS.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant={design.perspectiveX === preset.x && design.perspectiveY === preset.y ? 'default' : 'outline'}
                      onClick={() => updateDesign({ perspectiveX: preset.x, perspectiveY: preset.y })}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Rotate X {design.perspectiveX}°
                  <input aria-label="Rotate X" type="range" min={-15} max={15} value={design.perspectiveX} onChange={(event) => updateDesign({ perspectiveX: Number(event.target.value) })} className="flex-1 accent-primary" />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Rotate Y {design.perspectiveY}°
                  <input aria-label="Rotate Y" type="range" min={-15} max={15} value={design.perspectiveY} onChange={(event) => updateDesign({ perspectiveY: Number(event.target.value) })} className="flex-1 accent-primary" />
                </label>
              </div>
            </section>

            <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="text-sm font-medium">Preview</h2>
              <div ref={stageWrapperRef} className="flex min-h-70 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted/30 p-3">
                <div style={{ width: canvasSize.width * previewScale, height: canvasSize.height * previewScale }}>
                  <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left', width: canvasSize.width, height: canvasSize.height }}>
                    <div
                      ref={stageRef}
                      role="img"
                      aria-label="Beautified screenshot preview"
                      className="flex"
                      style={{
                        width: canvasSize.width,
                        height: canvasSize.height,
                        background: backgroundCss(design.background),
                        justifyContent: align.justify,
                        alignItems: align.align,
                      }}
                    >
                      <div
                        style={{
                          width: fitted.width + chrome.left + chrome.right,
                          height: fitted.height + chrome.top + chrome.bottom,
                          borderRadius: design.radius,
                          overflow: 'hidden',
                          boxShadow: SHADOW_CSS[design.shadow],
                          background: design.frame.startsWith('device-') ? BEZEL_COLOR : undefined,
                          display: 'flex',
                          flexDirection: 'column',
                          transform: `perspective(1000px) rotateX(${design.perspectiveX}deg) rotateY(${design.perspectiveY}deg)`,
                        }}
                      >
                        <FrameChromeOverlay frame={design.frame} />
                        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <img
                            ref={imageRef}
                            src={screenshotUrl}
                            alt="Selected screenshot"
                            onError={handleScreenshotError}
                            style={{ width: fitted.width, height: fitted.height, display: 'block' }}
                          />
                        </div>
                        {(design.frame === 'device-laptop' || design.frame === 'device-phone-portrait' || design.frame === 'device-phone-landscape') && (
                          <div style={{ background: BEZEL_COLOR, height: chrome.bottom }} className="flex shrink-0 items-center justify-center">
                            {design.frame === 'device-laptop' && <span className="h-1.5 w-24 rounded-t bg-black/30" />}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={resetToDefaults} disabled={exportStatus !== 'idle'}>
              <RotateCcw />
              Reset
            </Button>
            <Button type="button" variant="outline" onClick={() => void runCopy()} disabled={exportStatus !== 'idle'}>
              <Copy />
              {exportStatus === 'copying' ? 'Copying…' : 'Copy image'}
            </Button>
            <Button type="button" onClick={() => void runExport('png')} disabled={exportStatus !== 'idle'}>
              <Download />
              {exportStatus === 'preparing' || exportStatus === 'exporting' ? 'Exporting…' : 'Export PNG'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void runExport('jpg')} disabled={exportStatus !== 'idle'}>
              <Download />
              Export JPG
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

const BEZEL_COLOR = '#1F2023'
const BEZEL_ACCENT = '#3A3B3F'
const BROWSER_BAR_COLOR = '#E5E7EB'
const BROWSER_DOT_COLORS = ['#9CA3AF', '#9CA3AF', '#9CA3AF']
const BROWSER_MACOS_DOT_COLORS = ['#EF7A73', '#F5C065', '#61C454']

function FrameChromeOverlay({ frame }: { frame: FramePreset }) {
  if (frame === 'browser-minimal' || frame === 'browser-macos') {
    const dots = frame === 'browser-macos' ? BROWSER_MACOS_DOT_COLORS : BROWSER_DOT_COLORS
    return (
      <div style={{ background: BROWSER_BAR_COLOR, height: frame === 'browser-macos' ? 36 : 28 }} className="flex shrink-0 items-center gap-1.5 px-3">
        {dots.map((color, index) => (
          <span key={index} style={{ background: color }} className="size-2.5 rounded-full" />
        ))}
        {frame === 'browser-macos' && <span className="mx-auto h-4 w-2/3 max-w-64 rounded-full bg-black/10" />}
      </div>
    )
  }
  if (frame === 'device-laptop') {
    return <div style={{ background: BEZEL_ACCENT, height: 14 }} className="shrink-0" />
  }
  if (frame === 'device-phone-portrait' || frame === 'device-phone-landscape') {
    return <div style={{ background: BEZEL_COLOR, height: frame === 'device-phone-portrait' ? 20 : 10 }} className="flex shrink-0 items-center justify-center"><span className="h-1 w-10 rounded-full bg-white/30" /></div>
  }
  return null
}
