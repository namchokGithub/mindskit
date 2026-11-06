import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'

import { countdownRemaining, formatTimer, timerElapsed, type TimerState } from '@/features/screen-simulator/screen'
import { cn } from '@/lib/utils'

import { FlipDisplay, type FlipAppearance } from './flip-display'

/** Re-renders on every animation frame while `active`, for smooth timer digits. */
function useFrameNow(active: boolean): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!active) {
      setNow(performance.now())
      return
    }
    let frame = requestAnimationFrame(function tick(time) {
      setNow(time)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [active])
  return now
}

const LOG_LINES = [
  'Injecting payload into kernel space…', 'Decrypting RSA-4096 handshake', 'Spoofing MAC address 3C:22:FB:8A:01:7E',
  'Routing through proxy chain [7/7]', 'Bypassing firewall rule #2048', 'Cracking hash 5f4dcc3b5aa765d61d8327deb882cf99',
  'Uploading trojan.sys to 10.0.13.37', 'Escalating privileges: root', 'Dumping memory segment 0x7FFE0000',
  'Brute forcing SSH on port 22', 'Tracing satellite uplink…', 'Compiling exploit for CVE-0000-0000 (fictional)',
]
const TASKS = ['Bypassing firewall', 'Decrypting database', 'Downloading files', 'Overriding security', 'Erasing traces']

function randomHexLine(seed: number) {
  let value = seed * 2654435761
  return Array.from({ length: 8 }, () => {
    value = (value * 1103515245 + 12345) >>> 0
    return (value >>> 8).toString(16).padStart(6, '0').slice(0, 4).toUpperCase()
  }).join(' ')
}

/** Movie-style hacking dashboard. Pressing keys pops ACCESS GRANTED / DENIED; `speed` scales all animations. */
export function HackerSimulatorScreen({ speed }: { speed: number }) {
  const factor = Math.max(0.25, speed)
  const [logs, setLogs] = useState<string[]>([])
  const [hexOffset, setHexOffset] = useState(0)
  const [task, setTask] = useState({ index: 0, progress: 0 })
  const [popup, setPopup] = useState<'granted' | 'denied' | null>(null)
  const popupTimer = useRef(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setLogs((current) => [...current.slice(-40), `[${new Date().toLocaleTimeString([], { hour12: false })}] ${LOG_LINES[Math.floor(Math.random() * LOG_LINES.length)]}`])
      setHexOffset((current) => current + 1)
    }, 260 / factor)
    return () => window.clearInterval(id)
  }, [factor])

  useEffect(() => {
    const id = window.setInterval(() => {
      setTask((current) => (current.progress < 100
        ? { ...current, progress: Math.min(100, current.progress + Math.random() * 6) }
        : { index: (current.index + 1) % TASKS.length, progress: 0 }))
    }, 120 / factor)
    return () => window.clearInterval(id)
  }, [factor])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      setPopup(Math.random() > 0.35 ? 'granted' : 'denied')
      window.clearTimeout(popupTimer.current)
      popupTimer.current = window.setTimeout(() => setPopup(null), 1600)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(popupTimer.current)
    }
  }, [])

  const panel = 'flex min-h-0 flex-col overflow-hidden rounded-[0.6cqh] border border-[#00FF41]/40 bg-black/70 p-[1.2cqh]'
  const title = 'mb-[0.8cqh] border-b border-[#00FF41]/30 pb-[0.5cqh] uppercase tracking-widest text-[#00FF41]/80'

  return (
    <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-[1.2cqh] bg-[#020802] p-[1.6cqh] font-mono text-[#00FF41]" style={{ fontSize: '1.6cqh' }}>
      <section className={cn(panel, 'col-span-2')}>
        <h3 className={title}>System log</h3>
        <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden leading-snug">
          {logs.slice(-16).map((line, index) => <p key={`${index}-${line}`} className="truncate">{line}</p>)}
        </div>
      </section>
      <section className={panel}>
        <h3 className={title}>Network scan</h3>
        <div className="relative m-auto aspect-square h-[80%] rounded-full border border-[#00FF41]/50">
          <div className="absolute inset-[18%] rounded-full border border-[#00FF41]/30" />
          <div className="absolute inset-[36%] rounded-full border border-[#00FF41]/20" />
          <div className="absolute inset-0 animate-spin rounded-full motion-reduce:animate-none" style={{ animationDuration: `${3 / factor}s`, background: 'conic-gradient(from 0deg, rgba(0,255,65,0.45), transparent 25%)' }} />
          {[[30, 40], [62, 28], [70, 66], [38, 72]].map(([x, y]) => <span key={`${x}-${y}`} className="absolute size-[1cqh] animate-pulse rounded-full bg-[#00FF41]" style={{ left: `${x}%`, top: `${y}%` }} />)}
        </div>
      </section>
      <section className={panel}>
        <h3 className={title}>Memory dump</h3>
        <div className="min-h-0 flex-1 overflow-hidden leading-snug text-[#00FF41]/80">
          {Array.from({ length: 14 }, (_, row) => <p key={row} className="truncate">{(hexOffset + row).toString(16).padStart(8, '0').toUpperCase()}  {randomHexLine(hexOffset + row)}</p>)}
        </div>
      </section>
      <section className={cn(panel, 'col-span-2 justify-center gap-[2cqh]')}>
        <h3 className={title}>Operation</h3>
        <p style={{ fontSize: '2.4cqh' }}>{TASKS[task.index]}… {Math.floor(task.progress)}%</p>
        <div className="h-[2.4cqh] overflow-hidden rounded-sm border border-[#00FF41]/60">
          <div className="h-full bg-[#00FF41]" style={{ width: `${task.progress}%` }} />
        </div>
        <p className="text-[#00FF41]/60">Press any key to execute command</p>
      </section>
      {popup && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={cn('animate-in zoom-in-95 border-[0.6cqh] px-[6cqw] py-[4cqh] font-bold tracking-[0.2em] motion-reduce:animate-none', popup === 'granted' ? 'border-[#00FF41] bg-[#002B0B] text-[#00FF41]' : 'border-[#FF3B30] bg-[#2B0000] text-[#FF3B30]')} style={{ fontSize: '7cqh' }}>
            {popup === 'granted' ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
          </div>
        </div>
      )}
    </div>
  )
}

export function BrokenScreen({ src }: { src: string }) {
  return <img src={src} alt="" draggable={false} className="absolute inset-0 h-full w-full max-w-none object-cover select-none" />
}

export function CountdownScreen({ totalMs, state, appearance }: { totalMs: number; state: TimerState; appearance: FlipAppearance }) {
  const now = useFrameNow(state.running)
  const remaining = countdownRemaining(totalMs, state, now)
  const done = totalMs > 0 && remaining === 0
  return (
    <div className={cn('absolute inset-0 flex flex-col items-center justify-center', appearance === 'light' ? 'bg-white text-[#1C1C1E]' : 'bg-black text-white', done && 'animate-pulse motion-reduce:animate-none')}>
      <FlipDisplay value={formatTimer(remaining)} appearance={appearance} fontSize="min(12cqw, 30cqh)" />
      <p className={cn('mt-[4cqh] uppercase tracking-[0.3em]', done ? 'text-[#FF453A]' : 'opacity-50')} style={{ fontSize: '3.4cqh' }}>
        {done ? "Time's up" : state.running ? 'Counting down' : timerElapsed(state, now) > 0 ? 'Paused' : 'Ready'}
      </p>
    </div>
  )
}

export function StopwatchScreen({ state, laps, appearance }: { state: TimerState; laps: number[]; appearance: FlipAppearance }) {
  const now = useFrameNow(state.running)
  // Whole seconds only; formatTimer's hundredths mode floors (a stopwatch must not round up).
  const whole = formatTimer(timerElapsed(state, now), true).split('.')[0]
  return (
    <div className={cn('absolute inset-0 flex flex-col items-center justify-center', appearance === 'light' ? 'bg-white text-[#1C1C1E]' : 'bg-black text-white')}>
      <FlipDisplay value={whole} appearance={appearance} fontSize="min(12cqw, 30cqh)" />
      {laps.length > 0 && (
        <ol className="mt-[4cqh] grid grid-cols-2 gap-x-[6cqw] gap-y-[0.8cqh] tabular-nums opacity-70" style={{ fontSize: '2.4cqh' }}>
          {laps.slice(-8).map((lap, index, visible) => (
            <li key={`${index}-${lap}`}>Lap {laps.length - visible.length + index + 1}: {formatTimer(lap, true).split('.')[0]}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Shows a QR code (same `qrcode` library as the QR Code tool) with an optional caption. */
export function QrScreen({ content, description, dark }: { content: string; description: string; dark: boolean }) {
  const [dataUrl, setDataUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!content.trim()) {
      setDataUrl('')
      setError('Enter text or a URL to show a QR code.')
      return
    }
    QRCode.toDataURL(content, { width: 1024, margin: 2, errorCorrectionLevel: 'M', color: dark ? { dark: '#FFFFFF', light: '#000000' } : { dark: '#000000', light: '#FFFFFF' } })
      .then((url) => {
        if (cancelled) return
        setDataUrl(url)
        setError('')
      })
      .catch(() => {
        if (cancelled) return
        setDataUrl('')
        setError('This content is too large to encode as a QR code.')
      })
    return () => {
      cancelled = true
    }
  }, [content, dark])

  return (
    <div className={cn('absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] px-[8cqw] text-center', dark ? 'bg-black text-white' : 'bg-white text-black')}>
      {dataUrl ? <img src={dataUrl} alt="QR code" className="aspect-square max-w-none rounded-[1cqh]" style={{ height: description.trim() ? '62cqh' : '72cqh' }} /> : <p className="opacity-60" style={{ fontSize: '3cqh' }}>{error}</p>}
      {description.trim() && <p className="max-w-[80cqw] whitespace-pre-wrap font-medium" style={{ fontSize: '4cqh', lineHeight: 1.3 }}>{description}</p>}
    </div>
  )
}
