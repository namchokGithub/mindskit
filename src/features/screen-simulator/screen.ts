export interface Resolution {
  id: string
  label: string
  width: number
  height: number
}

/** Preview stage sizes. The stage renders at these CSS pixels and is scaled down to fit the page. */
export const RESOLUTIONS: Resolution[] = [
  { id: '480p', label: '480p (854 × 480)', width: 854, height: 480 },
  { id: '720p', label: '720p (1280 × 720)', width: 1280, height: 720 },
  { id: '1080p', label: '1080p (1920 × 1080)', width: 1920, height: 1080 },
  { id: '2k', label: '2K (2560 × 1440)', width: 2560, height: 1440 },
  { id: '4k', label: '4K (3840 × 2160)', width: 3840, height: 2160 },
  { id: '8k', label: '8K (7680 × 4320)', width: 7680, height: 4320 },
]

export const COLOR_PRESETS = [
  { id: 'white', label: 'White', hex: '#FFFFFF' },
  { id: 'black', label: 'Black', hex: '#000000' },
  { id: 'red', label: 'Red', hex: '#FF0000' },
  { id: 'green', label: 'Green', hex: '#00FF00' },
  { id: 'blue', label: 'Blue', hex: '#0000FF' },
] as const

export const MIN_KELVIN = 1500
export const MAX_KELVIN = 8500

function clampChannel(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)))
}

function toHex(channels: [number, number, number]): string {
  return `#${channels.map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/** Approximate color of a black-body light source (Tanner Helland's fit), clamped to 1500–8500 K. */
export function kelvinToHex(kelvin: number): string {
  const temperature = Math.min(MAX_KELVIN, Math.max(MIN_KELVIN, kelvin)) / 100
  const red = temperature <= 66 ? 255 : 329.698727446 * (temperature - 60) ** -0.1332047592
  const green = temperature <= 66
    ? 99.4708025861 * Math.log(temperature) - 161.1195681661
    : 288.1221695283 * (temperature - 60) ** -0.0755148492
  const blue = temperature >= 66 ? 255 : temperature <= 19 ? 0 : 138.5177312231 * Math.log(temperature - 10) - 305.0447927307
  return toHex([red, green, blue])
}

/**
 * Parses `#FFC0CB`, `FFC0CB`, `#FCB`, `12, 23, 12`, or `rgb(12, 23, 12)` into an uppercase `#RRGGBB`.
 * Returns null for anything else.
 */
export function parseScreenColor(input: string): string | null {
  const value = input.trim()
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1]
    return `#${digits.toUpperCase()}`
  }
  const rgb = /^(?:rgb\s*\(\s*)?(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)?$/i.exec(value)
  if (!rgb) return null
  const channels = rgb.slice(1, 4).map(Number) as [number, number, number]
  if (channels.some((channel) => channel > 255)) return null
  return toHex(channels)
}

export function hexToRgbText(hex: string): string {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(', ')
}

export type ProgressMode = 'auto' | 'fixed'

/** Percent shown by fake update/BSOD screens: runs from 0 to 100 over `durationSeconds`, or stays at `fixedPercent`. */
export function progressPercent(mode: ProgressMode, elapsedMs: number, durationSeconds: number, fixedPercent: number): number {
  if (mode === 'fixed') return Math.min(100, Math.max(0, Math.round(fixedPercent)))
  if (!(durationSeconds > 0)) return 100
  return Math.min(100, Math.max(0, Math.floor((elapsedMs / (durationSeconds * 1000)) * 100)))
}

const THAI_PATTERN = /[฀-๿]/
const THAI_LEADING_VOWELS = /^[เแโใไ]$/

function graphemes(value: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(value)].map((part) => part.segment)
  }
  return Array.from(value)
}

/**
 * Avatar initials. English: first letter of the first and last word (`Jane Doe` → `JD`). Thai: the first two
 * visible characters of the first word, skipping leading vowels and dropping marks (`สุดา` → `สด`, `เอกชัย` → `อก`).
 */
export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (THAI_PATTERN.test(words[0][0])) {
    return graphemes(words[0])
      .filter((part) => !THAI_LEADING_VOWELS.test(part))
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
  }
  const first = Array.from(words[0])[0] ?? ''
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}

export const MAX_CALL_MEMBERS = 9

export const SAMPLE_MEMBER_NAMES = [
  'Olivia Carter', 'Liam Bennett', 'Emma Rodriguez', 'Noah Kim', 'Ava Thompson', 'Ethan Patel', 'Sophia Nguyen',
  'Mason Rossi', 'Isabella Clarke', 'Lucas Müller', 'Mia Santos', 'James O’Connor', 'สมชาย ใจดี', 'สุดา รักษ์ไทย',
  'เอกชัย ศรีสุข', 'นภา วงศ์ทอง', 'ปิยะ แสงจันทร์', 'วิไล พรหมมา',
]

/** Picks up to `count` distinct names using the provided random source (defaults to Web Crypto). */
export function randomMemberNames(count: number, random: () => number = cryptoRandom): string[] {
  const pool = [...SAMPLE_MEMBER_NAMES]
  const total = Math.min(Math.max(0, Math.floor(count)), MAX_CALL_MEMBERS, pool.length)
  const picked: string[] = []
  for (let index = 0; index < total; index += 1) {
    const choice = Math.floor(random() * pool.length)
    picked.push(pool.splice(choice, 1)[0])
  }
  return picked
}

function cryptoRandom(): number {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] / 2 ** 32
}

/** Member names from a textarea: one per line or comma separated, trimmed, at most nine. */
export function parseMemberNames(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, MAX_CALL_MEMBERS)
}

export function formatClock(date: Date, hour12: boolean): { hours: string; minutes: string; seconds: string; period: string } {
  const hours24 = date.getHours()
  const hours = hour12 ? ((hours24 + 11) % 12) + 1 : hours24
  return {
    hours: String(hours).padStart(2, '0'),
    minutes: String(date.getMinutes()).padStart(2, '0'),
    seconds: String(date.getSeconds()).padStart(2, '0'),
    period: hour12 ? (hours24 < 12 ? 'AM' : 'PM') : '',
  }
}

export function formatCallDuration(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

export const QUOTES: Record<'en' | 'th', { text: string; author: string }[]> = {
  en: [
    { text: 'Simplicity is the soul of efficiency.', author: 'Austin Freeman' },
    { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
    { text: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
    { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
    { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
    { text: 'Quality is not an act, it is a habit.', author: 'Will Durant' },
    { text: 'It always seems impossible until it is done.', author: 'Nelson Mandela' },
  ],
  th: [
    { text: 'ความพยายามอยู่ที่ไหน ความสำเร็จอยู่ที่นั่น', author: 'สุภาษิตไทย' },
    { text: 'น้ำหยดลงหินทุกวัน หินมันยังกร่อน', author: 'สุภาษิตไทย' },
    { text: 'ไม่มีอะไรได้มาง่าย ๆ ถ้าไม่ลงมือทำ', author: 'คำคม' },
    { text: 'เริ่มจากสิ่งเล็ก ๆ แล้วทำให้สม่ำเสมอ', author: 'คำคม' },
    { text: 'ช้า ๆ ได้พร้าเล่มงาม', author: 'สุภาษิตไทย' },
    { text: 'ความรู้คู่คุณธรรม', author: 'คำคม' },
  ],
}

export const SAMPLE_HACKER_CODE = `#include <stdio.h>
#include <stdlib.h>

struct node { int key; struct node *next; };

static unsigned long hash(const char *value) {
    unsigned long result = 5381;
    int c;
    while ((c = *value++)) result = ((result << 5) + result) + c;
    return result;
}

int bypass_firewall(int port, const char *target) {
    printf("[*] scanning %s:%d\\n", target, port);
    for (int i = 0; i < 1024; i++) {
        if (hash(target) % (i + 1) == 0) {
            printf("[+] handshake 0x%08lx accepted\\n", hash(target) ^ i);
        }
    }
    return 0;
}

int main(int argc, char **argv) {
    struct node *root = malloc(sizeof(struct node));
    root->key = 0x1337;
    root->next = NULL;
    bypass_firewall(443, argc > 1 ? argv[1] : "mainframe.local");
    printf("ACCESS GRANTED\\n");
    return 0;
}
`

/** Gray level 0 (black) to 255 (white) as `#RRGGBB`. */
export function grayHex(level: number): string {
  const value = clampChannel(level)
  return toHex([value, value, value])
}

export interface TimerState {
  running: boolean
  /** `performance.now()`/`Date.now()` value when the current run started. */
  startedAt: number
  /** Time banked from earlier runs. */
  accumulatedMs: number
}

export const STOPPED_TIMER: TimerState = { running: false, startedAt: 0, accumulatedMs: 0 }

export function timerElapsed(state: TimerState, now: number): number {
  return state.accumulatedMs + (state.running ? Math.max(0, now - state.startedAt) : 0)
}

export function startTimer(state: TimerState, now: number): TimerState {
  return state.running ? state : { ...state, running: true, startedAt: now }
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  return state.running ? { running: false, startedAt: 0, accumulatedMs: timerElapsed(state, now) } : state
}

export function countdownRemaining(totalMs: number, state: TimerState, now: number): number {
  return Math.max(0, totalMs - timerElapsed(state, now))
}

export function durationFromParts(hours: number, minutes: number, seconds: number): number {
  const safe = (value: number) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)
  return (safe(hours) * 3600 + safe(minutes) * 60 + safe(seconds)) * 1000
}

/** `H:MM:SS` (hours only when needed), with optional hundredths for stopwatches. */
export function formatTimer(ms: number, withHundredths = false): string {
  const safe = Math.max(0, ms)
  const totalSeconds = withHundredths ? Math.floor(safe / 1000) : Math.ceil(safe / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  const base = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
  return withHundredths ? `${base}.${pad(Math.floor((safe % 1000) / 10))}` : base
}

export const PRANK_CRACK_IMAGES = [
  { id: 'crack01', label: 'Crack 1', src: '/prank/crack01.png' },
  { id: 'crack02', label: 'Crack 2', src: '/prank/crack02.png' },
  { id: 'crack03', label: 'Crack 3', src: '/prank/crack03.png' },
] as const

export type MatrixLanguage = 'en' | 'th' | 'zh' | 'ja' | 'ko' | 'pt' | 'ru'

/**
 * Character pools for the Matrix rain. Thai uses consonants only (no combining vowels or tone marks, which cannot
 * stand alone in a cell); Portuguese adds its accented capitals to the Latin alphabet.
 */
export const MATRIX_CHARSETS: Record<MatrixLanguage, { label: string; characters: string }> = {
  en: { label: 'English', characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  th: { label: 'ไทย', characters: 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ' },
  zh: { label: '中文', characters: '的一是不了人我在有他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可里后小心多天能好都' },
  ja: { label: '日本語', characters: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンあいうえおかきくけこ' },
  ko: { label: '한국어', characters: '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추' },
  pt: { label: 'Português', characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÂÃÀÇÉÊÍÓÔÕÚ' },
  ru: { label: 'Русский', characters: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ' },
}

export const MATRIX_DIGITS = '0123456789'

/** Distinct characters (by code point) for the selected languages plus digits; Japanese when nothing is selected. */
export function matrixCharacters(languages: readonly MatrixLanguage[]): string[] {
  const selected = languages.length > 0 ? languages : (['ja'] as const)
  return [...new Set(Array.from(selected.map((language) => MATRIX_CHARSETS[language].characters).join('') + MATRIX_DIGITS))]
}
