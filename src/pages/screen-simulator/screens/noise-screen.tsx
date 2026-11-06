import { AudioLines } from 'lucide-react'

import type { NoiseColor } from '@/features/screen-simulator/noise'

const BACKGROUNDS: Record<NoiseColor, string> = { white: '#1A1A1A', pink: '#2A1420', brown: '#24170F' }

export function NoiseScreen({ color, playing, remainingSeconds }: { color: NoiseColor; playing: boolean; remainingSeconds: number | null }) {
  const minutes = remainingSeconds === null ? null : `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3cqh] text-white" style={{ background: BACKGROUNDS[color] }}>
      <AudioLines className={playing ? 'animate-pulse motion-reduce:animate-none' : 'opacity-40'} style={{ width: '14cqh', height: '14cqh' }} />
      <p className="capitalize" style={{ fontSize: '4cqh' }}>{color} noise</p>
      <p className="text-white/60" style={{ fontSize: '2.4cqh' }}>{playing ? (minutes ? `Stops in ${minutes}` : 'Playing') : 'Paused'}</p>
    </div>
  )
}
