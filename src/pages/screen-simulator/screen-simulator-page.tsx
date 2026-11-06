import { Pause, Play, Shuffle, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { NOISE_TIMER_MINUTES, fillNoise, type NoiseColor } from '@/features/screen-simulator/noise'
import {
  COLOR_PRESETS,
  MAX_CALL_MEMBERS,
  MAX_KELVIN,
  MIN_KELVIN,
  RESOLUTIONS,
  SAMPLE_HACKER_CODE,
  hexToRgbText,
  kelvinToHex,
  parseMemberNames,
  parseScreenColor,
  randomMemberNames,
  type ProgressMode,
} from '@/features/screen-simulator/screen'
import { cn } from '@/lib/utils'

import { BsodScreen, ColorScreen, HackerTypingScreen, type BsodVariant } from './screens/basic-screens'
import { UpdateScreen, VideoCallScreen, type CallStyle, type UpdateVariant } from './screens/call-and-update-screens'
import { NoiseScreen } from './screens/noise-screen'
import { DvdScreen, FlipClockScreen, MatrixScreen, NoSignalScreen, QuotesScreen } from './screens/screensaver-screens'
import { ScreenStage } from './stage'

const TABS = [
  { id: 'colors', label: 'Colors', modes: [{ id: 'solid', label: 'Solid color' }, { id: 'lighting', label: 'Lighting' }] },
  { id: 'pranks', label: 'Screen Pranks', modes: [{ id: 'hacker', label: 'Hacker Typing' }, { id: 'bsod', label: 'Blue Screen' }, { id: 'call', label: 'Fake Video Call' }, { id: 'update', label: 'Fake Update' }] },
  { id: 'screensaver', label: 'Screensaver', modes: [{ id: 'dvd', label: 'DVD' }, { id: 'clock', label: 'Flip Clock' }, { id: 'quotes', label: 'Quotes' }, { id: 'no-signal', label: 'No Signal' }, { id: 'matrix', label: 'Matrix' }] },
  { id: 'noise', label: 'White Noise', modes: [] },
] as const

type TabId = (typeof TABS)[number]['id']

const BSOD_VARIANTS: { id: BsodVariant; label: string }[] = [{ id: 'win10', label: 'Windows 10' }, { id: 'win11', label: 'Windows 11' }, { id: 'xp', label: 'Windows XP' }]
const CALL_STYLES: { id: CallStyle; label: string }[] = [{ id: 'teams', label: 'Microsoft Teams' }, { id: 'meet', label: 'Google Meet' }]
const UPDATE_VARIANTS: { id: UpdateVariant; label: string }[] = [
  { id: 'win10', label: 'Windows 10' },
  { id: 'win11', label: 'Windows 11' },
  { id: 'xp', label: 'Windows XP' },
  { id: 'xp-boot', label: 'Windows XP boot' },
  { id: 'macos', label: 'Mac OS X' },
  { id: 'ubuntu', label: 'Ubuntu 22' },
  { id: 'chromeos', label: 'Chrome OS' },
  { id: 'android', label: 'Android' },
]

const fieldClass = 'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive'

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { id: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => (
        <Button key={option.id} type="button" size="sm" variant={value === option.id ? 'secondary' : 'ghost'} role="radio" aria-checked={value === option.id} onClick={() => onChange(option.id)}>
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">{label}{children}</label>
}

function ProgressControls({ mode, setMode, duration, setDuration, percent, setPercent }: { mode: ProgressMode; setMode: (mode: ProgressMode) => void; duration: number; setDuration: (value: number) => void; percent: number; setPercent: (value: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Segmented label="Progress mode" value={mode} options={[{ id: 'auto', label: 'Run over time' }, { id: 'fixed', label: 'Fixed %' }] as const} onChange={setMode} />
      {mode === 'auto' ? (
        <Field label={`Update time: ${duration >= 60 ? `${Math.floor(duration / 60)} min ${duration % 60 ? `${duration % 60} s` : ''}` : `${duration} s`} to reach 100%`}>
          <input type="range" min={10} max={3600} step={10} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="accent-primary" />
        </Field>
      ) : (
        <Field label={`Complete: ${percent}%`}>
          <input type="range" min={0} max={100} value={percent} onChange={(event) => setPercent(Number(event.target.value))} className="accent-primary" />
        </Field>
      )}
    </div>
  )
}

/** Plays generated noise through Web Audio while `playing` is true. */
function useNoisePlayer(color: NoiseColor, volume: number, playing: boolean) {
  const contextRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  useEffect(() => {
    if (!playing) return
    const context = contextRef.current ?? new AudioContext()
    contextRef.current = context
    void context.resume()
    const buffer = context.createBuffer(1, context.sampleRate * 4, context.sampleRate)
    fillNoise(buffer.getChannelData(0), color)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = context.createGain()
    gain.gain.value = volume
    gainRef.current = gain
    source.connect(gain).connect(context.destination)
    source.start()
    return () => {
      source.stop()
      source.disconnect()
      gain.disconnect()
      gainRef.current = null
    }
    // Volume changes are applied below without restarting the sound.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color, playing])

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume
  }, [volume])

  useEffect(() => () => void contextRef.current?.close(), [])
}

export function ScreenSimulatorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (TABS.find((item) => item.id === searchParams.get('tab'))?.id ?? 'colors') as TabId
  const tabConfig = TABS.find((item) => item.id === tab)!
  const modes: readonly { id: string; label: string }[] = tabConfig.modes
  const mode = modes.find((item) => item.id === searchParams.get('mode'))?.id ?? modes[0]?.id ?? ''

  const setTab = (next: TabId) => setSearchParams({ tab: next }, { replace: false })
  const setMode = (next: string) => setSearchParams({ tab, mode: next })

  const [resolutionId, setResolutionId] = useState('1080p')
  const resolution = RESOLUTIONS.find((item) => item.id === resolutionId) ?? RESOLUTIONS[2]

  // Colors
  const [colorHex, setColorHex] = useState('#FFFFFF')
  const [colorText, setColorText] = useState('#FFFFFF')
  const [rgbText, setRgbText] = useState('255, 255, 255')
  const [kelvin, setKelvin] = useState(6500)
  const colorTextError = parseScreenColor(colorText) === null
  const rgbTextError = parseScreenColor(rgbText) === null
  const applyColor = (hex: string) => {
    setColorHex(hex)
    setColorText(hex)
    setRgbText(hexToRgbText(hex))
  }

  // Pranks
  const [hackerCode, setHackerCode] = useState('')
  const [hackerSpeed, setHackerSpeed] = useState(3)
  const [hackerLoop, setHackerLoop] = useState(true)
  const [bsodVariant, setBsodVariant] = useState<BsodVariant>('win10')
  const [progressMode, setProgressMode] = useState<ProgressMode>('auto')
  const [duration, setDuration] = useState(120)
  const [fixedPercent, setFixedPercent] = useState(42)
  const [callStyle, setCallStyle] = useState<CallStyle>('teams')
  const [selfName, setSelfName] = useState('Jane Doe')
  const [membersText, setMembersText] = useState(() => randomMemberNames(5).join('\n'))
  const members = parseMemberNames(membersText)
  const [updateVariant, setUpdateVariant] = useState<UpdateVariant>('win10')

  // Screensaver
  const [hour12, setHour12] = useState(false)
  const [showSeconds, setShowSeconds] = useState(true)
  const [quoteLanguage, setQuoteLanguage] = useState<'en' | 'th'>('en')
  const [quoteInterval, setQuoteInterval] = useState(10)
  const [matrixSize, setMatrixSize] = useState(20)
  const [matrixSpeed, setMatrixSpeed] = useState(50)

  // White noise
  const [noiseColor, setNoiseColor] = useState<NoiseColor>('white')
  const [volume, setVolume] = useState(0.4)
  const [playing, setPlaying] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  useNoisePlayer(noiseColor, volume, playing && tab === 'noise')

  useEffect(() => {
    if (!playing || timerMinutes === 0) {
      setRemainingSeconds(null)
      return
    }
    const end = Date.now() + timerMinutes * 60_000
    const tick = () => {
      const left = Math.max(0, Math.round((end - Date.now()) / 1000))
      setRemainingSeconds(left)
      if (left === 0) setPlaying(false)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [playing, timerMinutes])

  useEffect(() => {
    if (tab !== 'noise') setPlaying(false)
  }, [tab])

  const isPrank = tab === 'pranks' && mode !== 'hacker'
  const progressSupported = (mode === 'bsod' && bsodVariant !== 'xp') || mode === 'update'

  let screen: ReactNode = null
  let background = '#000000'
  if (tab === 'colors') {
    background = mode === 'lighting' ? kelvinToHex(kelvin) : colorHex
    screen = <ColorScreen hex={background} />
  } else if (tab === 'pranks') {
    if (mode === 'hacker') screen = <HackerTypingScreen code={hackerCode} charsPerTick={hackerSpeed} loop={hackerLoop} />
    else if (mode === 'bsod') screen = <BsodScreen variant={bsodVariant} mode={progressMode} durationSeconds={duration} fixedPercent={fixedPercent} />
    else if (mode === 'call') screen = <VideoCallScreen style={callStyle} selfName={selfName} members={members} />
    else screen = <UpdateScreen variant={updateVariant} mode={progressMode} durationSeconds={duration} fixedPercent={fixedPercent} />
  } else if (tab === 'screensaver') {
    if (mode === 'dvd') screen = <DvdScreen />
    else if (mode === 'clock') screen = <FlipClockScreen hour12={hour12} showSeconds={showSeconds} />
    else if (mode === 'quotes') screen = <QuotesScreen language={quoteLanguage} intervalSeconds={quoteInterval} />
    else if (mode === 'no-signal') screen = <NoSignalScreen />
    else screen = <MatrixScreen fontSize={matrixSize} speedMs={matrixSpeed} />
  } else {
    screen = <NoiseScreen color={noiseColor} playing={playing} remainingSeconds={remainingSeconds} />
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <ToolPageHeader title="Screen Simulator" description="Full-screen colors, lighting, screen pranks, screensavers, and white noise — all generated in your browser." showRememberInput={false} />

      <div role="tablist" aria-label="Screen Simulator sections" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        {TABS.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', tab === item.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
            {item.label}
          </button>
        ))}
      </div>

      {modes.length > 0 && <Segmented label={`${tabConfig.label} screens`} value={mode} options={modes} onChange={setMode} />}

      {isPrank && (
        <div role="note" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>Prank screen for fun only. It imitates the look of a real product but is not affiliated with or endorsed by its owner, does nothing to your device, and must not be used to deceive people for harm, fraud, or phishing.</span>
        </div>
      )}

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ScreenStage key={`${tab}-${mode}`} resolution={resolution} background={background}>{screen}</ScreenStage>

        <aside className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
          <Field label="Preview resolution">
            <Select value={resolutionId} onValueChange={setResolutionId}>
              <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{RESOLUTIONS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          {tab === 'colors' && mode === 'solid' && (
            <>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => applyColor(preset.hex)} aria-label={preset.label} title={preset.label} className={cn('size-8 rounded-lg border border-border shadow-sm', colorHex === preset.hex && 'ring-2 ring-ring ring-offset-2 ring-offset-background')} style={{ background: preset.hex }} />
                ))}
                <input type="color" value={colorHex.toLowerCase()} onChange={(event) => applyColor(event.target.value.toUpperCase())} aria-label="Pick a color" className="h-8 w-10 cursor-pointer rounded-lg border border-input bg-transparent p-0.5" />
              </div>
              <Field label="HEX">
                <input value={colorText} onChange={(event) => { setColorText(event.target.value); const hex = parseScreenColor(event.target.value); if (hex && /#|^[0-9a-f]{3,6}$/i.test(event.target.value.trim())) { setColorHex(hex); setRgbText(hexToRgbText(hex)) } }} aria-invalid={colorTextError} placeholder="#FFC0CB" className={cn(fieldClass, 'font-mono uppercase')} />
              </Field>
              <Field label="RGB">
                <input value={rgbText} onChange={(event) => { setRgbText(event.target.value); const hex = parseScreenColor(event.target.value); if (hex && /,|rgb/i.test(event.target.value)) { setColorHex(hex); setColorText(hex) } }} aria-invalid={rgbTextError} placeholder="12, 23, 12" className={cn(fieldClass, 'font-mono')} />
              </Field>
              {(colorTextError || rgbTextError) && <p className="text-xs text-destructive">Use #RGB, #RRGGBB, or three numbers 0–255 such as 12, 23, 12.</p>}
            </>
          )}

          {tab === 'colors' && mode === 'lighting' && (
            <Field label={`Color temperature: ${kelvin} K`}>
              <input type="range" min={MIN_KELVIN} max={MAX_KELVIN} step={50} value={kelvin} onChange={(event) => setKelvin(Number(event.target.value))} className="accent-primary" style={{ background: `linear-gradient(90deg, ${kelvinToHex(MIN_KELVIN)}, ${kelvinToHex(6500)}, ${kelvinToHex(MAX_KELVIN)})` }} aria-label="Color temperature in kelvin" />
              <span className="flex justify-between text-[0.7rem]"><span>Warm</span><span className="font-mono">{kelvinToHex(kelvin)}</span><span>Cool</span></span>
            </Field>
          )}

          {tab === 'pranks' && mode === 'hacker' && (
            <>
              <Field label={`Speed: ${hackerSpeed} characters per tick`}>
                <input type="range" min={1} max={30} value={hackerSpeed} onChange={(event) => setHackerSpeed(Number(event.target.value))} className="accent-primary" />
              </Field>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={hackerLoop} onCheckedChange={(value) => setHackerLoop(value === true)} />Loop when finished</label>
              <Field label="Your code (optional, stays in this browser)">
                <Textarea value={hackerCode} onChange={(event) => setHackerCode(event.target.value)} placeholder={SAMPLE_HACKER_CODE.split('\n').slice(0, 3).join('\n')} className="min-h-40 font-mono text-xs field-sizing-fixed" />
              </Field>
            </>
          )}

          {tab === 'pranks' && mode === 'bsod' && (
            <>
              <Segmented label="Blue screen style" value={bsodVariant} options={BSOD_VARIANTS} onChange={setBsodVariant} />
              {progressSupported && <ProgressControls mode={progressMode} setMode={setProgressMode} duration={duration} setDuration={setDuration} percent={fixedPercent} setPercent={setFixedPercent} />}
            </>
          )}

          {tab === 'pranks' && mode === 'call' && (
            <>
              <Segmented label="Call style" value={callStyle} options={CALL_STYLES} onChange={setCallStyle} />
              <Field label="Your name"><input value={selfName} onChange={(event) => setSelfName(event.target.value)} className={fieldClass} /></Field>
              <Field label={`Members (one per line, max ${MAX_CALL_MEMBERS}) · ${members.length}/${MAX_CALL_MEMBERS}`}>
                <Textarea value={membersText} onChange={(event) => setMembersText(event.target.value)} className="min-h-32 text-sm field-sizing-fixed" />
              </Field>
              <Button type="button" variant="outline" size="sm" onClick={() => setMembersText(randomMemberNames(1 + Math.floor(Math.random() * MAX_CALL_MEMBERS)).join('\n'))}><Shuffle />Random members</Button>
            </>
          )}

          {tab === 'pranks' && mode === 'update' && (
            <>
              <Field label="System">
                <Select value={updateVariant} onValueChange={(value) => setUpdateVariant(value as UpdateVariant)}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{UPDATE_VARIANTS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {updateVariant !== 'xp-boot' && <ProgressControls mode={progressMode} setMode={setProgressMode} duration={duration} setDuration={setDuration} percent={fixedPercent} setPercent={setFixedPercent} />}
            </>
          )}

          {tab === 'screensaver' && mode === 'clock' && (
            <>
              <Segmented label="Clock format" value={hour12 ? '12h' : '24h'} options={[{ id: '24h', label: '24h' }, { id: '12h', label: '12h' }] as const} onChange={(value) => setHour12(value === '12h')} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={showSeconds} onCheckedChange={(value) => setShowSeconds(value === true)} />Show seconds</label>
            </>
          )}

          {tab === 'screensaver' && mode === 'quotes' && (
            <>
              <Segmented label="Quote language" value={quoteLanguage} options={[{ id: 'en', label: 'English' }, { id: 'th', label: 'ไทย' }] as const} onChange={setQuoteLanguage} />
              <Field label={`Change every ${quoteInterval} s`}>
                <input type="range" min={5} max={60} step={5} value={quoteInterval} onChange={(event) => setQuoteInterval(Number(event.target.value))} className="accent-primary" />
              </Field>
            </>
          )}

          {tab === 'screensaver' && mode === 'matrix' && (
            <>
              <Field label={`Character size: ${matrixSize} px`}>
                <input type="range" min={10} max={48} value={matrixSize} onChange={(event) => setMatrixSize(Number(event.target.value))} className="accent-primary" />
              </Field>
              <Field label={`Speed: ${matrixSpeed} ms per frame`}>
                <input type="range" min={20} max={200} step={5} value={matrixSpeed} onChange={(event) => setMatrixSpeed(Number(event.target.value))} className="accent-primary" />
              </Field>
            </>
          )}

          {tab === 'screensaver' && (mode === 'dvd' || mode === 'no-signal') && <p className="text-xs text-muted-foreground">No settings. Use Full screen to start the screensaver.</p>}

          {tab === 'noise' && (
            <>
              <Segmented label="Noise color" value={noiseColor} options={[{ id: 'white', label: 'White' }, { id: 'pink', label: 'Pink' }, { id: 'brown', label: 'Brown' }] as const} onChange={setNoiseColor} />
              <Field label={`Volume: ${Math.round(volume * 100)}%`}>
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="accent-primary" />
              </Field>
              <Field label="Stop after">
                <Select value={String(timerMinutes)} onValueChange={(value) => setTimerMinutes(Number(value))}>
                  <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{NOISE_TIMER_MINUTES.map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes === 0 ? 'Never' : `${minutes} minutes`}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause /> : <Play />}{playing ? 'Pause' : 'Play'}</Button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
