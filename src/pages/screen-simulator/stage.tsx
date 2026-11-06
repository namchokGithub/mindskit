import { Maximize } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import type { Resolution } from '@/features/screen-simulator/screen'
import { cn } from '@/lib/utils'

/** Milliseconds since mount (or since `resetKey` changed), updated every `intervalMs`. */
export function useElapsed(intervalMs = 250, resetKey?: unknown): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = performance.now()
    setElapsed(0)
    const id = window.setInterval(() => setElapsed(performance.now() - start), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs, resetKey])
  return elapsed
}

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

/** Size of an element in CSS pixels as displayed (after any parent scaling). */
export function useDisplayedSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const rect = element.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])
  return [ref, size] as const
}

type WakeLockSentinelLike = { release: () => Promise<void> }

/**
 * Renders a screen at the chosen resolution, scaled down to fit the page. "Full screen" shows the same screen
 * edge to edge, keeps the display awake (Screen Wake Lock), and hides the cursor while idle.
 */
export function ScreenStage({ resolution, children, background = '#000000' }: { resolution: Resolution; children: ReactNode; background?: string }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.25)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [cursorHidden, setCursorHidden] = useState(false)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const update = () => setScale(frame.clientWidth / resolution.width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [resolution.width])

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === fullscreenRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock
    wakeLock?.request('screen').then((lock) => {
      if (cancelled) void lock.release()
      else sentinel = lock
    }).catch(() => undefined)
    setShowHint(true)
    const hintTimer = window.setTimeout(() => setShowHint(false), 2500)
    let idleTimer = window.setTimeout(() => setCursorHidden(true), 2000)
    const onMove = () => {
      setCursorHidden(false)
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => setCursorHidden(true), 2000)
    }
    window.addEventListener('pointermove', onMove)
    return () => {
      cancelled = true
      void sentinel?.release()
      window.clearTimeout(hintTimer)
      window.clearTimeout(idleTimer)
      window.removeEventListener('pointermove', onMove)
      setCursorHidden(false)
      setShowHint(false)
    }
  }, [isFullscreen])

  const enterFullscreen = useCallback(() => {
    void fullscreenRef.current?.requestFullscreen?.().catch(() => undefined)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else enterFullscreen()
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={frameRef} className="relative w-full overflow-hidden rounded-xl border border-border bg-black shadow-sm" style={{ aspectRatio: `${resolution.width} / ${resolution.height}` }}>
        <div
          ref={fullscreenRef}
          onDoubleClick={toggleFullscreen}
          className={cn('overflow-hidden', isFullscreen ? 'h-screen w-screen' : 'absolute top-0 left-0 origin-top-left', cursorHidden && 'cursor-none')}
          style={isFullscreen ? { background, containerType: 'size' } : { width: resolution.width, height: resolution.height, transform: `scale(${scale})`, background, containerType: 'size' }}
        >
          {children}
          {showHint && (
            <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 animate-in rounded-full bg-black/70 px-4 py-2 text-sm text-white fade-in">
              Press Esc or double-click to exit full screen
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Preview {resolution.width} × {resolution.height} · double-click the screen to toggle full screen</span>
        <Button type="button" onClick={enterFullscreen}><Maximize />Full screen</Button>
      </div>
    </div>
  )
}
