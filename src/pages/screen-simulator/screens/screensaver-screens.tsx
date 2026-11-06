import { useEffect, useRef, useState } from 'react'

import { QUOTES, formatClock } from '@/features/screen-simulator/screen'
import { cn } from '@/lib/utils'

import { useDisplayedSize, useNow } from '../stage'

import { FlipDisplay, type FlipAppearance } from './flip-display'

const DVD_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#00C7BE', '#007AFF', '#AF52DE', '#FF2D55']

/** A "DVD" logo-style label that bounces off the edges and changes color on every hit. */
export function DvdScreen() {
  const containerRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const [color, setColor] = useState(DVD_COLORS[0])

  useEffect(() => {
    const container = containerRef.current
    const logo = logoRef.current
    if (!container || !logo) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let x = 0.2
    let y = 0.3
    let dx = 1
    let dy = 1
    let colorIndex = 0
    let frame = 0
    let last = performance.now()
    const step = (time: number) => {
      const seconds = Math.min(0.05, (time - last) / 1000)
      last = time
      // Positions are fractions of the free space, so speed stays the same at any resolution.
      const speed = reduced ? 0.03 : 0.12
      x += dx * speed * seconds
      y += dy * speed * seconds * (container.clientWidth / Math.max(1, container.clientHeight))
      let bounced = false
      if (x <= 0 || x >= 1) {
        dx *= -1
        x = Math.min(1, Math.max(0, x))
        bounced = true
      }
      if (y <= 0 || y >= 1) {
        dy *= -1
        y = Math.min(1, Math.max(0, y))
        bounced = true
      }
      if (bounced) {
        colorIndex = (colorIndex + 1) % DVD_COLORS.length
        setColor(DVD_COLORS[colorIndex])
      }
      logo.style.left = `${x * (container.clientWidth - logo.offsetWidth)}px`
      logo.style.top = `${y * (container.clientHeight - logo.offsetHeight)}px`
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-black">
      <div ref={logoRef} className="absolute flex flex-col items-center font-black italic tracking-tighter" style={{ color, fontSize: '13cqh', lineHeight: 0.85 }}>
        DVD
        <span className="mt-[0.6cqh] rounded-[50%] px-[2cqh] not-italic tracking-[0.3em]" style={{ background: color, color: '#000', fontSize: '2.4cqh', lineHeight: 1.6 }}>VIDEO</span>
      </div>
    </div>
  )
}

export function FlipClockScreen({ hour12, showSeconds, appearance }: { hour12: boolean; showSeconds: boolean; appearance: FlipAppearance }) {
  const now = useNow(1000)
  const time = formatClock(now, hour12)
  const value = showSeconds ? `${time.hours}:${time.minutes}:${time.seconds}` : `${time.hours}:${time.minutes}`
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center gap-[2cqw]', appearance === 'light' ? 'bg-white' : 'bg-black')}>
      <FlipDisplay value={value} appearance={appearance} fontSize={showSeconds ? 'min(10.5cqw, 30cqh)' : 'min(16cqw, 36cqh)'} />
      {time.period && <span className={cn('self-center font-light uppercase', appearance === 'light' ? 'text-[#3A3A3C]' : 'text-[#CCCCCC]')} style={{ fontSize: '6cqh' }}>{time.period}</span>}
    </div>
  )
}

export function QuotesScreen({ language, intervalSeconds }: { language: 'en' | 'th'; intervalSeconds: number }) {
  const quotes = QUOTES[language]
  const [index, setIndex] = useState(0)
  useEffect(() => {
    setIndex(0)
    const id = window.setInterval(() => setIndex((current) => (current + 1) % quotes.length), Math.max(3, intervalSeconds) * 1000)
    return () => window.clearInterval(id)
  }, [quotes, intervalSeconds])
  const quote = quotes[index % quotes.length]
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black px-[12cqw] text-center text-white">
      <figure key={`${language}-${index}`} className="animate-in fade-in duration-1000 motion-reduce:animate-none">
        <blockquote className="font-serif" style={{ fontSize: '6cqh', lineHeight: 1.3 }}>“{quote.text}”</blockquote>
        <figcaption className="mt-[4cqh] text-white/60" style={{ fontSize: '2.8cqh' }}>— {quote.author}</figcaption>
      </figure>
    </div>
  )
}

const BARS = ['#C0C0C0', '#C0C000', '#00C0C0', '#00C000', '#C000C0', '#C00000', '#0000C0']
const LOWER_BARS = ['#0000C0', '#131313', '#C000C0', '#131313', '#00C0C0', '#131313', '#C0C0C0']

export function NoSignalScreen() {
  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex flex-[67]">{BARS.map((color) => <span key={color} className="flex-1" style={{ background: color }} />)}</div>
      <div className="flex flex-[8]">{LOWER_BARS.map((color, index) => <span key={index} className="flex-1" style={{ background: color }} />)}</div>
      <div className="flex flex-[25]">
        {['#00214C', '#FFFFFF', '#32006A', '#131313', '#090909', '#131313', '#1D1D1D', '#131313'].map((color, index) => <span key={index} className={index === 3 ? 'flex-[3]' : 'flex-1'} style={{ background: color }} />)}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="bg-black/85 px-[4cqw] py-[2cqh] font-mono font-bold tracking-[0.2em] text-white" style={{ fontSize: '6cqh' }}>NO SIGNAL</span>
      </div>
    </div>
  )
}

const MATRIX_CHARACTERS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789'

/**
 * Falling-character rain. `fontSize` is in pixels on a 1080-pixel-tall screen and scales with the displayed height,
 * so the preview and full screen look the same; `speedMs` is the delay between frames.
 */
export function MatrixScreen({ fontSize, speedMs }: { fontSize: number; speedMs: number }) {
  const [canvasRef, size] = useDisplayedSize<HTMLCanvasElement>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width === 0 || size.height === 0) return
    const context = canvas.getContext('2d')
    if (!context) return
    canvas.width = Math.round(size.width)
    canvas.height = Math.round(size.height)
    const cell = Math.max(4, fontSize * (size.height / 1080))
    const columns = Math.ceil(canvas.width / cell)
    const drops = Array.from({ length: columns }, () => Math.floor(Math.random() * -40))
    context.fillStyle = '#000'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const draw = () => {
      context.fillStyle = 'rgba(0, 0, 0, 0.08)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.font = `${cell}px monospace`
      for (let column = 0; column < columns; column += 1) {
        const character = MATRIX_CHARACTERS[Math.floor(Math.random() * MATRIX_CHARACTERS.length)]
        const y = drops[column] * cell
        context.fillStyle = Math.random() > 0.975 ? '#D7FFD9' : '#00FF41'
        if (y >= 0) context.fillText(character, column * cell, y)
        drops[column] = y > canvas.height && Math.random() > 0.975 ? 0 : drops[column] + 1
      }
    }
    const id = window.setInterval(draw, Math.max(16, speedMs))
    return () => window.clearInterval(id)
  }, [canvasRef, size.width, size.height, fontSize, speedMs])

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full bg-black" />
}
