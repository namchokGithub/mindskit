import { ArrowDown, ArrowUp, Copy, Download, Eraser, FileText, ImagePlus, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { ReceivedImageNote, SendToImageTool } from '@/components/tool/send-to-image-tool'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { EmptyState, ToolPage, WorkspaceCanvas, workspaceCardClass } from '@/components/tool/workspace'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { handoffValidationInput, toHandoffFile } from '@/features/images/handoff'
import { copyBlobToClipboard, isClipboardImageCopySupported } from '@/features/screenshot-beautifier/export'
import { extractImageFileFromClipboard, formatFileSize, validateScreenshotDimensions, validateScreenshotFile } from '@/features/screenshot-beautifier/image'
import { DEFAULT_KARAOKE_FORMAT, type KaraokeLetterCase, type KaraokeStyle, type KaraokeSyllableSeparator } from '@/features/thai-karaoke/formatter'
import {
  clearKaraokeLinesHandoff,
  MAX_KARAOKE_IMAGE_LINES,
  parseKaraokeLines,
  peekKaraokeLinesHandoff,
  resolveKaraokeLines,
  serializeKaraokeLines,
  type KaraokeImageLine,
} from '@/features/thai-karaoke/image-lines'
import {
  ASPECT_OPTIONS,
  clampNumber,
  DEFAULT_KARAOKE_IMAGE_DESIGN,
  karaokeImageFileName,
  LINE_SPACING_RANGE,
  RESOLUTION_OPTIONS,
  resolveOutputSize,
  resolveSourceCrop,
  SIZE_RANGE,
  STROKE_RANGE,
  type KaraokeAlign,
  type KaraokeAspect,
  type KaraokeImageDesign,
  type KaraokeOverlay,
  type KaraokePosition,
  type KaraokeResolution,
  type KaraokeShadow,
} from '@/features/thai-karaoke/image-model'
import { canvasToBlob, loadKaraokeFont, renderKaraokeImage } from '@/features/thai-karaoke/image-render'
import { useImageHandoff } from '@/hooks/use-image-handoff'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'
import { cn } from '@/lib/utils'

const PAGE_PATH = '/images/karaoke-image-maker'
const CONVERTER_NAME = 'Thai Karaoke Converter'

const SAMPLE_LINES = ['คิดถึงเธอทุกวัน', 'ความรักของเรา จะอยู่ตลอดไป']

const fieldClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'
const colorClass = 'h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-0.5'

const syllableOptions: Array<{ value: string; separator: KaraokeSyllableSeparator; label: string }> = [
  { value: 'none', separator: '', label: 'Joined' },
  { value: 'hyphen', separator: '-', label: 'ka-ra-o-ke' },
  { value: 'space', separator: ' ', label: 'ka ra o ke' },
]

type ImageState = { file: File; bitmap: ImageBitmap; size: { width: number; height: number } }

/**
 * Lines and style kept in module memory while the tab stays open, so a round trip to Image Crop
 * (send the image out, send the result back) does not lose the user's text. Never written to storage.
 */
let sessionDraft: {
  lines: Array<Pick<KaraokeImageLine, 'thai' | 'karaoke'>>
  design: KaraokeImageDesign
  style: KaraokeStyle
  letterCase: KaraokeLetterCase
  syllableKey: string
} | null = null

function OptionGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; label: string }>; onChange: (value: T) => void }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => (
          <Button key={option.id} type="button" size="sm" variant={value === option.id ? 'default' : 'outline'} aria-pressed={value === option.id} onClick={() => onChange(option.id)}>
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function RangeField({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return (
    <label className="block space-y-1 text-xs text-muted-foreground">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="font-mono">
          {value}
          {suffix}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(clampNumber(Number(event.target.value), min, max))} className="block w-full accent-primary" />
    </label>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input type="color" aria-label={label} value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className={colorClass} />
      {label}
    </label>
  )
}

function ControlSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export function KaraokeImageMakerPage() {
  const { enabled } = useSaveLocally()
  const [storedLines, setStoredLines] = usePersistedInput('karaoke-image-maker', enabled)
  const nextLineId = useRef(1)
  const makeLine = (thai = '', karaoke: string | null = null): KaraokeImageLine => ({ id: nextLineId.current++, thai, karaoke })

  // Lines sent from the Converter win over remembered lines; both are only text, never the image.
  const [linesHandoff] = useState(() => peekKaraokeLinesHandoff())
  const [lines, setLines] = useState<KaraokeImageLine[]>(() => {
    const initial = linesHandoff?.lines ?? sessionDraft?.lines ?? parseKaraokeLines(storedLines)
    return initial.length > 0 ? initial.map((line) => makeLine(line.thai, line.karaoke)) : [makeLine()]
  })
  const [linesFrom, setLinesFrom] = useState<string | null>(linesHandoff ? CONVERTER_NAME : null)
  useEffect(() => {
    if (linesHandoff) clearKaraokeLinesHandoff(linesHandoff.id)
  }, [linesHandoff])
  useEffect(() => {
    const hasText = lines.some((line) => line.thai.trim() || line.karaoke?.trim())
    setStoredLines(hasText ? serializeKaraokeLines(lines) : '')
  }, [lines, setStoredLines])

  const [style, setStyle] = useState<KaraokeStyle>(sessionDraft?.style ?? DEFAULT_KARAOKE_FORMAT.style)
  const [letterCase, setLetterCase] = useState<KaraokeLetterCase>(sessionDraft?.letterCase ?? DEFAULT_KARAOKE_FORMAT.letterCase)
  const [syllableKey, setSyllableKey] = useState(sessionDraft?.syllableKey ?? 'none')
  const [design, setDesign] = useState<KaraokeImageDesign>(sessionDraft?.design ?? DEFAULT_KARAOKE_IMAGE_DESIGN)
  useEffect(() => {
    sessionDraft = { lines: lines.map(({ thai, karaoke }) => ({ thai, karaoke })), design, style, letterCase, syllableKey }
  }, [lines, design, style, letterCase, syllableKey])
  const update = (patch: Partial<KaraokeImageDesign>) => setDesign((current) => ({ ...current, ...patch }))

  const format = useMemo(
    () => ({ ...DEFAULT_KARAOKE_FORMAT, style, letterCase, syllableSeparator: syllableOptions.find((option) => option.value === syllableKey)?.separator ?? '' }),
    [style, letterCase, syllableKey],
  )
  const generated = useMemo(() => resolveKaraokeLines(lines.map((line) => ({ ...line, karaoke: null })), format), [lines, format])
  const textLines = useMemo(() => lines.map((line, index) => ({ thai: line.thai, karaoke: line.karaoke ?? generated[index].karaoke })), [lines, generated])

  const [image, setImage] = useState<ImageState | null>(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [fontReady, setFontReady] = useState(false)
  const [busy, setBusy] = useState<'idle' | 'exporting' | 'copying'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const [previewWidth, setPreviewWidth] = useState(0)

  const crop = image ? resolveSourceCrop(image.size, design.aspect) : null
  const output = crop ? resolveOutputSize(crop, design.resolution) : null

  useEffect(() => {
    let active = true
    void loadKaraokeFont().then(() => {
      if (active) setFontReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  // The decoded image is closed when it is replaced and when the page is left. The ref (not an effect on
  // `image`) avoids closing a bitmap that is still shown after StrictMode's development remount.
  const imageRef = useRef<ImageState | null>(null)
  const replaceImage = (next: ImageState | null) => {
    imageRef.current?.bitmap.close()
    imageRef.current = next
    setImage(next)
  }
  useEffect(() => () => imageRef.current?.bitmap.close(), [])

  const handleFile = async (file: File, received = false) => {
    const validationError = validateScreenshotFile(handoffValidationInput(file, received))
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
    const dimensionError = validateScreenshotDimensions(size)
    if (dimensionError) {
      bitmap.close()
      setError(dimensionError)
      return
    }
    if (!received) dismissReceived()
    replaceImage({ file, bitmap, size })
    setError('')
  }

  const { receivedFrom, dismiss: dismissReceived } = useImageHandoff(PAGE_PATH, (file) => handleFile(file, true))

  const removeImage = () => {
    replaceImage(null)
    setError('')
    dismissReceived()
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return
      const file = extractImageFileFromClipboard(Array.from(event.clipboardData?.items ?? []))
      if (!file) return
      event.preventDefault()
      void handleFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // handleFile only reads setters and the handoff dismiss callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    const wrapper = previewWrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(() => setPreviewWidth(wrapper.clientWidth))
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [image])

  // Preview: the same renderer as the export, drawn at a smaller scale.
  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !image || !crop || !output || !fontReady || previewWidth === 0) return
    const frame = requestAnimationFrame(() => {
      const pixelRatio = window.devicePixelRatio || 1
      const scale = Math.min(1, (previewWidth * pixelRatio) / output.width, (720 * pixelRatio) / output.height)
      try {
        renderKaraokeImage(canvas, { image: image.bitmap, crop, output, lines: textLines, design, scale })
      } catch {
        setError('Could not draw the preview in this browser.')
      }
    })
    return () => cancelAnimationFrame(frame)
    // crop and output are derived from image and design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, design, textLines, fontReady, previewWidth])

  const renderBlob = async (fileFormat: 'png' | 'jpg') => {
    if (!image || !crop || !output) throw new Error('No image')
    await loadKaraokeFont()
    const canvas = document.createElement('canvas')
    try {
      renderKaraokeImage(canvas, { image: image.bitmap, crop, output, lines: textLines, design, opaque: fileFormat === 'jpg' })
      return await canvasToBlob(canvas, fileFormat)
    } finally {
      // Release the full-size canvas memory right away.
      canvas.width = 0
      canvas.height = 0
    }
  }

  const exportImage = async (fileFormat: 'png' | 'jpg') => {
    if (busy !== 'idle') return
    setBusy('exporting')
    try {
      const blob = await renderBlob(fileFormat)
      const filename = karaokeImageFileName(image?.file.name ?? null, fileFormat)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`Exported ${filename}`)
    } catch {
      toast.error('Failed to export the karaoke image.')
    } finally {
      setBusy('idle')
    }
  }

  const copyImage = async () => {
    if (busy !== 'idle') return
    if (!isClipboardImageCopySupported()) {
      toast.error('Copying images is not supported in this browser. Use Download instead.')
      return
    }
    setBusy('copying')
    try {
      await copyBlobToClipboard(await renderBlob('png'))
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy the image. Use Download instead.')
    } finally {
      setBusy('idle')
    }
  }

  const updateLine = (id: number, patch: Partial<KaraokeImageLine>) => setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  const moveLine = (index: number, offset: -1 | 1) =>
    setLines((current) => {
      const next = [...current]
      const target = index + offset
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  const removeLine = (id: number) => setLines((current) => (current.length > 1 ? current.filter((line) => line.id !== id) : [makeLine()]))
  const addLine = () => setLines((current) => (current.length < MAX_KARAOKE_IMAGE_LINES ? [...current, makeLine()] : current))
  const useSample = () => setLines(SAMPLE_LINES.map((thai) => makeLine(thai)))
  const clearLines = () => {
    setLines([makeLine()])
    setLinesFrom(null)
  }

  const disabled = busy !== 'idle' || !image

  return (
    <ToolPage>
      <ToolPageHeader title="Karaoke Image Maker" description="Put Thai lyrics and their karaoke readings on an image, style them, and export PNG or JPG — everything stays in your browser." />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => inputRef.current?.click()}>
          <ImagePlus />
          {image ? 'Change image' : 'Choose image'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0]
            if (selected) void handleFile(selected)
            event.target.value = ''
          }}
        />
        {image && (
          <>
            <SendToImageTool currentPath={PAGE_PATH} size="default" label="Crop or edit image in" getFile={async () => image.file} />
            <Button type="button" variant="ghost" onClick={removeImage}>
              <Trash2 />
              Remove image
            </Button>
            <span className="text-xs text-muted-foreground">
              {image.file.name} · {image.size.width} × {image.size.height} · {formatFileSize(image.file.size)}
            </span>
          </>
        )}
      </div>

      <ReceivedImageNote from={receivedFrom} onDismiss={dismissReceived} />
      <ToolStatus state={error ? 'invalid' : 'idle'} message={error} />

      <WorkspaceCanvas
        preview={
          image && output ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Preview</h2>
                <span className="text-xs text-muted-foreground">
                  Export {output.width} × {output.height} px
                </span>
              </div>
              <div ref={previewWrapperRef} className="flex min-h-70 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-muted/30 p-2">
                {fontReady ? (
                  <canvas ref={previewRef} role="img" aria-label="Karaoke image preview" className="block h-auto max-h-[720px] w-auto max-w-full" />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading font…</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void exportImage('png')} disabled={disabled}>
                  <Download />
                  {busy === 'exporting' ? 'Exporting…' : 'Export PNG'}
                </Button>
                <Button type="button" variant="outline" onClick={() => void exportImage('jpg')} disabled={disabled}>
                  <Download />
                  Export JPG
                </Button>
                <Button type="button" variant="outline" onClick={() => void copyImage()} disabled={disabled}>
                  <Copy />
                  {busy === 'copying' ? 'Copying…' : 'Copy image'}
                </Button>
                <SendToImageTool
                  currentPath={PAGE_PATH}
                  disabled={disabled}
                  getFile={async () => toHandoffFile(await renderBlob('png'), karaokeImageFileName(image.file.name, 'png'))}
                />
              </div>
            </>
          ) : (
            <div
              className="flex min-h-70 flex-1"
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                const dropped = event.dataTransfer.files[0]
                if (dropped) void handleFile(dropped)
              }}
            >
              <EmptyState
                icon={ImagePlus}
                title="Add a background image"
                hint="Drag and drop, paste from your clipboard, or choose a PNG, JPEG, or WebP image up to 20 MiB."
                className={cn(isDragging && 'border-primary bg-primary/5')}
                action={
                  <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
                    <ImagePlus />
                    Choose image
                  </Button>
                }
              />
            </div>
          )
        }
        controls={
          <div className="flex flex-col gap-4 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
            <ControlSection title="Image">
              <OptionGroup<KaraokeAspect> label="Aspect ratio" value={design.aspect} options={ASPECT_OPTIONS} onChange={(aspect) => update({ aspect })} />
              <label className="block space-y-1 text-xs text-muted-foreground">
                <span>Export size (long edge)</span>
                <Select value={design.resolution} onValueChange={(value) => update({ resolution: value as KaraokeResolution })}>
                  <SelectTrigger size="sm" className="w-full" aria-label="Export size"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESOLUTION_OPTIONS.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </ControlSection>

            <ControlSection title="Reading">
              <div className="grid grid-cols-2 gap-2">
                <Select value={style} onValueChange={(value) => setStyle(value as KaraokeStyle)}>
                  <SelectTrigger size="sm" className="w-full" aria-label="Reading style"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rtgs">RTGS</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={letterCase} onValueChange={(value) => setLetterCase(value as KaraokeLetterCase)}>
                  <SelectTrigger size="sm" className="w-full" aria-label="Letter case"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lower">lowercase</SelectItem>
                    <SelectItem value="upper">UPPERCASE</SelectItem>
                    <SelectItem value="title">Title Case</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Select value={syllableKey} onValueChange={setSyllableKey}>
                <SelectTrigger size="sm" className="w-full" aria-label="Syllable separator"><SelectValue /></SelectTrigger>
                <SelectContent>{syllableOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant={design.showThai ? 'default' : 'outline'} aria-pressed={design.showThai} onClick={() => update({ showThai: !design.showThai })}>
                  Thai text
                </Button>
                <Button type="button" size="sm" variant={design.showKaraoke ? 'default' : 'outline'} aria-pressed={design.showKaraoke} onClick={() => update({ showKaraoke: !design.showKaraoke })}>
                  Karaoke text
                </Button>
              </div>
            </ControlSection>

            <ControlSection title="Typography">
              <p className="text-xs text-muted-foreground">Font: Sarabun Bold</p>
              <RangeField label="Thai size" value={design.thaiSize} min={SIZE_RANGE.thai.min} max={SIZE_RANGE.thai.max} step={0.5} suffix="%" onChange={(thaiSize) => update({ thaiSize })} />
              <RangeField label="Karaoke size" value={design.karaokeSize} min={SIZE_RANGE.karaoke.min} max={SIZE_RANGE.karaoke.max} step={0.5} suffix="%" onChange={(karaokeSize) => update({ karaokeSize })} />
              <div className="flex flex-wrap gap-3">
                <ColorField label="Thai" value={design.thaiColor} onChange={(thaiColor) => update({ thaiColor })} />
                <ColorField label="Karaoke" value={design.karaokeColor} onChange={(karaokeColor) => update({ karaokeColor })} />
              </div>
              <RangeField label="Opacity" value={design.textOpacity} min={10} max={100} suffix="%" onChange={(textOpacity) => update({ textOpacity })} />
            </ControlSection>

            <ControlSection title="Stroke & shadow">
              <ColorField label="Stroke color" value={design.strokeColor} onChange={(strokeColor) => update({ strokeColor })} />
              <RangeField label="Stroke width" value={design.strokeWidth} min={STROKE_RANGE.min} max={STROKE_RANGE.max} suffix="%" onChange={(strokeWidth) => update({ strokeWidth })} />
              <OptionGroup<KaraokeShadow>
                label="Shadow"
                value={design.shadow}
                options={[
                  { id: 'none', label: 'None' },
                  { id: 'soft', label: 'Soft' },
                  { id: 'strong', label: 'Strong' },
                ]}
                onChange={(shadow) => update({ shadow })}
              />
            </ControlSection>

            <ControlSection title="Layout">
              <OptionGroup<KaraokePosition>
                label="Position"
                value={design.position}
                options={[
                  { id: 'top', label: 'Top' },
                  { id: 'center', label: 'Center' },
                  { id: 'bottom', label: 'Bottom' },
                ]}
                onChange={(position) => update({ position })}
              />
              <OptionGroup<KaraokeAlign>
                label="Alignment"
                value={design.align}
                options={[
                  { id: 'left', label: 'Left' },
                  { id: 'center', label: 'Center' },
                  { id: 'right', label: 'Right' },
                ]}
                onChange={(align) => update({ align })}
              />
              <RangeField label="Line spacing" value={design.lineSpacing} min={LINE_SPACING_RANGE.min} max={LINE_SPACING_RANGE.max} step={0.1} onChange={(lineSpacing) => update({ lineSpacing })} />
            </ControlSection>

            <ControlSection title="Background overlay">
              <OptionGroup<KaraokeOverlay>
                label="Overlay"
                value={design.overlay}
                options={[
                  { id: 'none', label: 'None' },
                  { id: 'band', label: 'Behind text' },
                  { id: 'full', label: 'Whole image' },
                ]}
                onChange={(overlay) => update({ overlay })}
              />
              {design.overlay !== 'none' && (
                <>
                  <ColorField label="Overlay color" value={design.overlayColor} onChange={(overlayColor) => update({ overlayColor })} />
                  <RangeField label="Overlay opacity" value={design.overlayOpacity} min={0} max={100} suffix="%" onChange={(overlayOpacity) => update({ overlayOpacity })} />
                </>
              )}
            </ControlSection>

            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setDesign(DEFAULT_KARAOKE_IMAGE_DESIGN)}>
              <RotateCcw />
              Reset style
            </Button>
          </div>
        }
      />

      <section className={cn('flex flex-col gap-3 p-4 sm:p-5', workspaceCardClass)} aria-labelledby="karaoke-lines-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="karaoke-lines-heading" className="text-sm font-semibold text-foreground">Lines</h2>
            <p className="text-xs text-muted-foreground">Readings are generated from the Thai text. Type in a reading field to use your own; clear it to go back to the generated one.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={lines.length >= MAX_KARAOKE_IMAGE_LINES}>
              <Plus />
              Add line
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={useSample}>
              <FileText />
              Sample
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearLines}>
              <Eraser />
              Clear
            </Button>
          </div>
        </div>
        {linesFrom && (
          <div role="status" className="flex w-fit items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pr-1 pl-3 text-xs text-muted-foreground">
            <span>Lines from {linesFrom}</span>
            <Button type="button" size="icon-xs" variant="ghost" onClick={() => setLinesFrom(null)} aria-label="Hide note">
              <X />
            </Button>
          </div>
        )}
        <ol className="flex flex-col gap-2">
          {lines.map((line, index) => (
            <li key={line.id} className="grid gap-2 rounded-lg border border-border bg-background p-2 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
              <span className="text-xs text-muted-foreground sm:text-center">{index + 1}</span>
              <input value={line.thai} onChange={(event) => updateLine(line.id, { thai: event.target.value })} placeholder="ข้อความภาษาไทย" aria-label={`Thai text, line ${index + 1}`} lang="th" className={fieldClass} />
              <input
                value={line.karaoke ?? ''}
                onChange={(event) => updateLine(line.id, { karaoke: event.target.value ? event.target.value : null })}
                placeholder={generated[index]?.karaoke || 'Karaoke reading'}
                aria-label={`Karaoke reading, line ${index + 1}`}
                spellCheck={false}
                autoCapitalize="off"
                className={cn(fieldClass, 'font-mono')}
              />
              <div className="flex items-center gap-1">
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => moveLine(index, -1)} disabled={index === 0} aria-label={`Move line ${index + 1} up`}>
                  <ArrowUp />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => moveLine(index, 1)} disabled={index === lines.length - 1} aria-label={`Move line ${index + 1} down`}>
                  <ArrowDown />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" onClick={() => removeLine(line.id)} aria-label={`Remove line ${index + 1}`}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </ToolPage>
  )
}
