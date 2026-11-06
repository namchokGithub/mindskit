import { useEffect, useRef, useState } from 'react'

import { SAMPLE_HACKER_CODE, progressPercent, type ProgressMode } from '@/features/screen-simulator/screen'

import { useElapsed } from '../stage'

export function ColorScreen({ hex }: { hex: string }) {
  return <div className="absolute inset-0 transition-colors duration-300" style={{ background: hex }} />
}

/** Green-on-black code that types itself; loops back to the start when `loop` is on. */
export function HackerTypingScreen({ code, charsPerTick, loop }: { code: string; charsPerTick: number; loop: boolean }) {
  const source = code.trim() ? code : SAMPLE_HACKER_CODE
  const [length, setLength] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLength(0)
  }, [source])

  useEffect(() => {
    const id = window.setInterval(() => {
      setLength((current) => {
        if (current >= source.length) return loop ? 0 : current
        return Math.min(source.length, current + Math.max(1, charsPerTick))
      })
    }, 40)
    return () => window.clearInterval(id)
  }, [source, charsPerTick, loop])

  useEffect(() => {
    // Scroll only this box; scrollIntoView would also scroll the page around the preview.
    const container = containerRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [length])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black p-[3cqh] font-mono leading-snug text-[#33FF66]" style={{ fontSize: '2.4cqh' }}>
      <pre className="whitespace-pre-wrap break-words">
        {source.slice(0, length)}
        <span className="inline-block h-[1em] w-[0.6em] animate-pulse bg-[#33FF66] align-text-bottom" />
      </pre>
    </div>
  )
}

/** A static pseudo-QR block made of deterministic squares (not a real code). */
function FakeQr() {
  const cells = Array.from({ length: 21 * 21 }, (_, index) => {
    const x = index % 21
    const y = Math.floor(index / 21)
    const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
    if (finder) {
      const fx = x > 13 ? x - 14 : x
      const fy = y > 13 ? y - 14 : y
      return fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)
    }
    return ((x * 7 + y * 13 + x * y) % 5) < 2
  })
  return (
    <div className="grid shrink-0 bg-white p-[0.6cqh]" style={{ gridTemplateColumns: 'repeat(21, 1fr)', width: '15cqh', height: '15cqh' }}>
      {cells.map((filled, index) => <span key={index} className={filled ? 'bg-current' : ''} />)}
    </div>
  )
}

export type BsodVariant = 'win10' | 'win11' | 'xp'

export function BsodScreen({ variant, mode, durationSeconds, fixedPercent }: { variant: BsodVariant; mode: ProgressMode; durationSeconds: number; fixedPercent: number }) {
  const elapsed = useElapsed(250, `${variant}-${mode}-${durationSeconds}`)

  if (variant === 'xp') {
    return (
      <div className="absolute inset-0 bg-[#0000AA] p-[6cqh] font-mono text-white" style={{ fontSize: '2.6cqh', lineHeight: 1.35 }}>
        <p>A problem has been detected and Windows has been shut down to prevent damage to your computer.</p>
        <p className="mt-[2.5cqh]">IRQL_NOT_LESS_OR_EQUAL</p>
        <p className="mt-[2.5cqh]">If this is the first time you've seen this Stop error screen, restart your computer. If this screen appears again, follow these steps:</p>
        <p className="mt-[2.5cqh]">Check to make sure any new hardware or software is properly installed. If this is a new installation, ask your hardware or software manufacturer for any Windows updates you might need.</p>
        <p className="mt-[2.5cqh]">If problems continue, disable or remove any newly installed hardware or software. Disable BIOS memory options such as caching or shadowing.</p>
        <p className="mt-[2.5cqh]">Technical information:</p>
        <p className="mt-[2.5cqh]">*** STOP: 0x0000000A (0x00000000, 0x00000002, 0x00000000, 0x804E2A0C)</p>
        <p className="mt-[2.5cqh]">Beginning dump of physical memory<br />Physical memory dump complete.<br />Contact your system administrator or technical support group for further assistance.</p>
      </div>
    )
  }

  const percent = progressPercent(mode, elapsed, durationSeconds, fixedPercent)
  const background = variant === 'win11' ? '#0067C0' : '#0078D7'
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-[14cqw] text-white" style={{ background, fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
      <p style={{ fontSize: '16cqh', lineHeight: 1 }}>:(</p>
      <p className="mt-[4cqh] max-w-[70cqw]" style={{ fontSize: '3.6cqh', lineHeight: 1.3 }}>
        Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.
      </p>
      <p className="mt-[4cqh]" style={{ fontSize: '3.6cqh' }}>{percent}% complete</p>
      <div className="mt-[4cqh] flex items-start gap-[2cqw] text-white" style={{ color: background }}>
        {variant === 'win10' ? (
          // Screen blend turns the PNG's black modules into the screen blue and keeps white white, like a real stop screen.
          <span className="shrink-0" style={{ background, width: '15cqh', height: '15cqh' }}>
            <img src="/prank/mindskit-qr-code.png" alt="" draggable={false} className="block h-full w-full max-w-none mix-blend-screen" />
          </span>
        ) : (
          <FakeQr />
        )}
        <div className="text-white" style={{ fontSize: '1.7cqh', lineHeight: 1.5 }}>
          <p>For more information about this issue and possible fixes, visit https://www.windows.com/stopcode</p>
          <p className="mt-[2cqh]">If you call a support person, give them this info:</p>
          <p>Stop code: CRITICAL_PROCESS_DIED</p>
        </div>
      </div>
    </div>
  )
}
