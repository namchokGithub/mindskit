import { Captions, Circle, Hand, LayoutGrid, MessageSquare, Mic, MicOff, MonitorUp, MoreHorizontal, PhoneOff, ShieldCheck, Smile, Users, Video, Volume2 } from 'lucide-react'

import { avatarInitials, formatCallDuration, progressPercent, type ProgressMode } from '@/features/screen-simulator/screen'

import { useElapsed, useNow } from '../stage'

const AVATAR_COLORS = ['#7B83EB', '#E3008C', '#00A4A6', '#C239B3', '#E74856', '#0078D4', '#498205', '#CA5010', '#8764B8', '#038387']

function colorFor(name: string) {
  let hash = 0
  for (const character of name) hash = (hash * 31 + character.codePointAt(0)!) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function gridColumns(count: number) {
  if (count <= 1) return 1
  if (count <= 4) return 2
  if (count <= 9) return 3
  return 4
}

export type CallStyle = 'teams' | 'meet' | 'zoom' | 'discord'

const CALL_THEMES: Record<CallStyle, { background: string; tile: string; radius: string; font: string; nameBackground: string }> = {
  teams: { background: '#1F1F1F', tile: '#292929', radius: '0.6cqh', font: '"Segoe UI", system-ui, sans-serif', nameBackground: 'rgba(0,0,0,0.45)' },
  meet: { background: '#202124', tile: '#3C4043', radius: '1.2cqh', font: '"Google Sans", Roboto, system-ui, sans-serif', nameBackground: 'transparent' },
  zoom: { background: '#1A1A1A', tile: '#232323', radius: '0.4cqh', font: 'Lato, "Helvetica Neue", system-ui, sans-serif', nameBackground: 'rgba(0,0,0,0.6)' },
  discord: { background: '#313338', tile: '#2B2D31', radius: '1cqh', font: '"gg sans", "Noto Sans", "Helvetica Neue", system-ui, sans-serif', nameBackground: 'rgba(0,0,0,0.55)' },
}

const iconSize = { width: '2.6cqh', height: '2.6cqh' }

function ToolbarButton({ icon: Icon, label, background, color, round }: { icon: typeof Mic; label?: string; background?: string; color?: string; round?: boolean }) {
  return (
    <span className={round ? 'flex items-center justify-center rounded-full' : 'flex flex-col items-center justify-center gap-[0.4cqh] rounded-md px-[0.8cqw]'} style={{ background, color, ...(round ? { width: '5.6cqh', height: '5.6cqh' } : { minWidth: '7cqh', height: '7cqh' }) }}>
      <Icon style={iconSize} />
      {label && <span style={{ fontSize: '1.3cqh' }}>{label}</span>}
    </span>
  )
}

export interface SelfAvatar {
  /** Avatar circle color; null uses the automatic color. */
  color: string | null
  /** Object URL of a photo kept only in this browser; null shows initials. */
  photoUrl: string | null
}

export function VideoCallScreen({ style, selfName, members, selfAvatar, meetingName = '' }: { style: CallStyle; selfName: string; members: string[]; selfAvatar?: SelfAvatar; meetingName?: string }) {
  const elapsed = useElapsed(1000, style)
  const now = useNow(10_000)
  const participants = [...members, `${selfName.trim() || 'You'} (You)`]
  const columns = gridColumns(participants.length)
  const rows = Math.ceil(participants.length / columns)
  const theme = CALL_THEMES[style]
  const avatarSize = `${Math.min(18, 34 / rows)}cqh`

  return (
    <div className="absolute inset-0 flex flex-col text-white" style={{ background: theme.background, fontFamily: theme.font }}>
      {style === 'teams' && (
        <div className="flex items-center justify-between border-b border-white/10 px-[2cqw]" style={{ height: '7cqh', background: '#141414', fontSize: '1.9cqh' }}>
          <span className="tabular-nums">{formatCallDuration(elapsed)}</span>
          <div className="flex items-center gap-[1.4cqw] text-white/80">
            <Users style={iconSize} />
            <MessageSquare style={iconSize} />
            <Hand style={iconSize} />
            <Smile style={iconSize} />
            <MoreHorizontal style={iconSize} />
            <span className="flex items-center gap-[0.5cqw] rounded-md px-[1cqw] py-[0.6cqh]" style={{ background: '#C4314B' }}>
              <PhoneOff style={{ width: '2.4cqh', height: '2.4cqh' }} />Leave
            </span>
          </div>
        </div>
      )}
      {style === 'zoom' && (
        <div className="flex items-center justify-between px-[2cqw]" style={{ height: '5cqh', fontSize: '1.7cqh' }}>
          <span className="flex items-center gap-[0.5cqw] text-[#23D959]"><ShieldCheck style={{ width: '2.2cqh', height: '2.2cqh' }} />Zoom Meeting</span>
          <span className="tabular-nums text-white/80">{formatCallDuration(elapsed)}</span>
          <span className="flex items-center gap-[0.5cqw] text-white/80"><LayoutGrid style={{ width: '2.2cqh', height: '2.2cqh' }} />Gallery View</span>
        </div>
      )}
      {style === 'discord' && (
        <div className="flex items-center gap-[1cqw] border-b border-black/30 px-[2cqw]" style={{ height: '6cqh', fontSize: '2cqh', background: '#313338' }}>
          <Volume2 style={iconSize} className="text-white/60" />
          <span className="font-semibold">General</span>
          <span className="text-white/50 tabular-nums" style={{ fontSize: '1.6cqh' }}>{formatCallDuration(elapsed)}</span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-[1cqh] p-[1.6cqh]" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
        {participants.map((name, index) => {
          const display = name.replace(/ \(You\)$/, '')
          const muted = index % 3 === 1
          const isSelf = index === participants.length - 1
          const photoUrl = isSelf ? selfAvatar?.photoUrl : null
          const avatarColor = (isSelf && selfAvatar?.color) || colorFor(display)
          const speaking = style !== 'teams' && index === 0
          return (
            <div
              key={`${name}-${index}`}
              className="relative flex min-h-0 items-center justify-center overflow-hidden"
              style={{ background: theme.tile, borderRadius: theme.radius, boxShadow: speaking ? `inset 0 0 0 0.4cqh ${style === 'zoom' ? '#23D959' : style === 'discord' ? '#23A55A' : '#8AB4F8'}` : undefined }}
            >
              <div className="flex items-center justify-center overflow-hidden rounded-full font-semibold" style={{ background: avatarColor, width: avatarSize, height: avatarSize, fontSize: `${Math.min(6.5, 12 / rows)}cqh` }}>
                {photoUrl ? <img src={photoUrl} alt="" draggable={false} className="h-full w-full max-w-none object-cover" /> : avatarInitials(display)}
              </div>
              <span className="absolute bottom-[1cqh] left-[1cqh] flex items-center gap-[0.5cqw] rounded px-[0.6cqw] py-[0.3cqh]" style={{ fontSize: '1.7cqh', background: theme.nameBackground }}>
                {muted && <MicOff style={{ width: '1.8cqh', height: '1.8cqh' }} className={style === 'zoom' || style === 'discord' ? 'text-[#F23F43]' : undefined} />}
                {name}
              </span>
            </div>
          )
        })}
      </div>

      {style === 'meet' && (
        <div className="flex items-center justify-between px-[2cqw]" style={{ height: '10cqh', fontSize: '1.9cqh' }}>
          <span className="tabular-nums text-white/90">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} | {meetingName.trim() || 'abc-defg-hij'}</span>
          <div className="flex items-center gap-[1cqw]">
            {[Mic, Video, Captions, Smile, MonitorUp, Hand, MoreHorizontal].map((Icon, index) => <ToolbarButton key={index} icon={Icon} background="#3C4043" round />)}
            <span className="flex items-center justify-center rounded-full" style={{ background: '#EA4335', width: '8cqh', height: '5.6cqh' }}>
              <PhoneOff style={iconSize} />
            </span>
          </div>
          <div className="flex items-center gap-[1.4cqw] text-white/80">
            <Users style={iconSize} />
            <MessageSquare style={iconSize} />
          </div>
        </div>
      )}
      {style === 'teams' && (
        <div className="flex items-center justify-center gap-[1.4cqw] text-white/80" style={{ height: '8cqh' }}>
          {[Mic, Video, MonitorUp].map((Icon, index) => (
            <span key={index} className="flex items-center justify-center rounded-md" style={{ background: '#2D2D2D', width: '6cqh', height: '5.2cqh' }}>
              <Icon style={iconSize} />
            </span>
          ))}
        </div>
      )}
      {style === 'zoom' && (
        <div className="flex items-center justify-between px-[2cqw] text-white/90" style={{ height: '9cqh', background: '#111111' }}>
          <div className="flex gap-[0.6cqw]">
            <ToolbarButton icon={Mic} label="Mute" />
            <ToolbarButton icon={Video} label="Stop Video" />
          </div>
          <div className="flex gap-[0.6cqw]">
            <ToolbarButton icon={Users} label="Participants" />
            <ToolbarButton icon={MessageSquare} label="Chat" />
            <ToolbarButton icon={MonitorUp} label="Share Screen" color="#23D959" />
            <ToolbarButton icon={Circle} label="Record" />
            <ToolbarButton icon={Smile} label="Reactions" />
          </div>
          <span className="rounded-md px-[1.2cqw] py-[0.8cqh] font-semibold" style={{ background: '#E02828', fontSize: '1.7cqh' }}>End</span>
        </div>
      )}
      {style === 'discord' && (
        <div className="flex items-center justify-center gap-[1cqw]" style={{ height: '10cqh' }}>
          <ToolbarButton icon={Video} background="#4E5058" round />
          <ToolbarButton icon={MonitorUp} background="#4E5058" round />
          <ToolbarButton icon={Smile} background="#4E5058" round />
          <ToolbarButton icon={Mic} background="#4E5058" round />
          <span className="flex items-center justify-center rounded-full" style={{ background: '#F23F43', width: '5.6cqh', height: '5.6cqh' }}>
            <PhoneOff style={iconSize} />
          </span>
        </div>
      )}
    </div>
  )
}

export type UpdateVariant = 'win10' | 'win11' | 'xp' | 'xp-boot' | 'macos' | 'ubuntu' | 'chromeos' | 'android'

function DotSpinner({ color = 'white' }: { color?: string }) {
  return (
    <div className="relative" style={{ width: '7cqh', height: '7cqh' }}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className="absolute inset-0 animate-spin motion-reduce:animate-none" style={{ animationDuration: '1.6s', animationDelay: `${index * 0.12}s` }}>
          <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full" style={{ width: '0.9cqh', height: '0.9cqh', background: color }} />
        </span>
      ))}
    </div>
  )
}

function ProgressBar({ percent, color, track }: { percent: number; color: string; track: string }) {
  return (
    <div className="overflow-hidden rounded-full" style={{ width: '40cqw', height: '0.8cqh', background: track }}>
      <div className="h-full transition-[width] duration-500" style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}

/** A bar that keeps moving, for screens without a percentage. */
function IndeterminateBar({ color, track, width = '30cqw' }: { color: string; track: string; width?: string }) {
  return (
    <div className="relative overflow-hidden rounded-full" style={{ width, height: '0.7cqh', background: track }}>
      <div className="absolute inset-y-0 w-1/3 animate-[mk-indeterminate_1.6s_ease-in-out_infinite] rounded-full motion-reduce:animate-none" style={{ background: color }} />
    </div>
  )
}

export function UpdateScreen({ variant, mode, durationSeconds, fixedPercent }: { variant: UpdateVariant; mode: ProgressMode; durationSeconds: number; fixedPercent: number }) {
  const elapsed = useElapsed(500, `${variant}-${mode}-${durationSeconds}`)
  const percent = progressPercent(mode, elapsed, durationSeconds, fixedPercent)
  const segoe = { fontFamily: '"Segoe UI", system-ui, sans-serif' }

  switch (variant) {
    case 'win10':
    case 'win11':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] text-center text-white" style={{ ...segoe, background: variant === 'win10' ? '#0063B1' : '#000000' }}>
          <DotSpinner />
          <div style={{ fontSize: '3.4cqh', lineHeight: 1.45 }}>
            <p>Working on updates {percent}%</p>
            <p>{variant === 'win10' ? "Don't turn off your computer" : 'Please keep your computer on.'}</p>
          </div>
          {variant === 'win10' && <p className="absolute bottom-[8cqh]" style={{ fontSize: '2.4cqh' }}>Your computer will restart several times</p>}
        </div>
      )
    case 'xp':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] text-white" style={{ background: 'linear-gradient(180deg, #5A7EDC 0%, #3A64C8 100%)', fontFamily: 'Tahoma, Verdana, sans-serif' }}>
          <p style={{ fontSize: '4.2cqh' }}>Installing Windows Updates…</p>
          <p style={{ fontSize: '2.4cqh' }}>Installing update 3 of 17</p>
          <div className="flex gap-[0.3cqw] rounded-sm border border-white/80 bg-white p-[0.4cqh]" style={{ width: '40cqw' }}>
            {Array.from({ length: 20 }, (_, index) => (
              <span key={index} className="h-[2.2cqh] flex-1" style={{ background: index < Math.round((percent / 100) * 20) ? '#2D8A2D' : 'transparent' }} />
            ))}
          </div>
          <p style={{ fontSize: '2.2cqh' }}>Do not turn off or unplug your computer.</p>
        </div>
      )
    case 'xp-boot':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[8cqh] bg-black text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
          <div className="text-center">
            <p style={{ fontSize: '2.6cqh' }}>Microsoft<sup style={{ fontSize: '1.2cqh' }}>®</sup></p>
            <p className="font-bold italic" style={{ fontSize: '7cqh', lineHeight: 1 }}>Windows<span className="ml-[0.5cqw] align-super font-normal not-italic" style={{ fontSize: '3cqh', color: '#F28C28' }}>xp</span></p>
          </div>
          <div className="relative overflow-hidden rounded-[0.6cqh] border-2 border-[#B2B2B2]" style={{ width: '17cqw', height: '2.6cqh' }}>
            <div className="absolute inset-y-[0.3cqh] flex animate-[mk-xp-boot_2.2s_linear_infinite] gap-[0.35cqw] motion-reduce:animate-none">
              {[0, 1, 2].map((index) => (
                <span key={index} className="h-full rounded-[0.2cqh]" style={{ width: '1.1cqw', background: 'linear-gradient(180deg, #8BB2F2, #2A5CC4 55%, #8BB2F2)' }} />
              ))}
            </div>
          </div>
          <p className="absolute bottom-[4cqh] right-[4cqw]" style={{ fontSize: '1.8cqh' }}>Microsoft</p>
        </div>
      )
    case 'macos':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[5cqh] bg-black text-white" style={{ fontFamily: '-apple-system, "Helvetica Neue", sans-serif' }}>
          <div className="rounded-full border-[0.6cqh] border-white" style={{ width: '12cqh', height: '12cqh' }} />
          <ProgressBar percent={mode === 'fixed' ? percent : Math.max(5, percent)} color="#FFFFFF" track="#3A3A3A" />
          <p className="text-white/80" style={{ fontSize: '2cqh' }}>Installing Mac OS X update… About {Math.max(1, Math.ceil(((100 - percent) / 100) * (durationSeconds / 60)))} minutes remaining</p>
        </div>
      )
    case 'ubuntu':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[5cqh] text-white" style={{ background: '#2C001E', fontFamily: 'Ubuntu, "Segoe UI", sans-serif' }}>
          <p className="font-light" style={{ fontSize: '6cqh' }}>ubuntu<sup style={{ fontSize: '2cqh' }}> 22.04</sup></p>
          <div className="flex gap-[1.2cqw]">
            {Array.from({ length: 5 }, (_, index) => (
              <span key={index} className="animate-pulse rounded-full bg-white motion-reduce:animate-none" style={{ width: '1.4cqh', height: '1.4cqh', animationDelay: `${index * 0.2}s` }} />
            ))}
          </div>
          <p className="text-white/70" style={{ fontSize: '2cqh' }}>Installing updates — {percent}%</p>
        </div>
      )
    case 'chromeos':
      return (
        <div className="absolute inset-0 flex flex-col items-start justify-center gap-[3cqh] bg-white px-[20cqw] text-[#202124]" style={{ fontFamily: 'Roboto, "Google Sans", sans-serif' }}>
          <p style={{ fontSize: '4.4cqh' }}>Updating your device</p>
          <p className="text-[#5F6368]" style={{ fontSize: '2.2cqh' }}>Your device is updating. This may take a few minutes. Don't turn off your device.</p>
          <ProgressBar percent={percent} color="#1A73E8" track="#D2E3FC" />
          <p className="text-[#5F6368]" style={{ fontSize: '2cqh' }}>{percent}%</p>
        </div>
      )
    case 'android':
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] bg-black text-white" style={{ fontFamily: 'Roboto, sans-serif' }}>
          <div className="relative flex items-end justify-center" style={{ width: '16cqh', height: '18cqh' }}>
            <div className="rounded-t-full" style={{ width: '14cqh', height: '7cqh', background: '#3DDC84' }} />
            <div className="absolute bottom-0 rounded-b-[2cqh]" style={{ width: '14cqh', height: '10cqh', background: '#3DDC84' }} />
            <div className="absolute animate-spin rounded-full border-[0.6cqh] border-white/90 border-t-transparent motion-reduce:animate-none" style={{ width: '6cqh', height: '6cqh', bottom: '2cqh' }} />
          </div>
          <p style={{ fontSize: '3cqh' }}>Installing system update…</p>
          <IndeterminateBar color="#3DDC84" track="#1F3A2B" />
          <p className="text-white/70" style={{ fontSize: '2cqh' }}>{percent}%</p>
        </div>
      )
  }
}
