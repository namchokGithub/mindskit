import { Download, Eraser, FileText, RotateCcw } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'

import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { TextStats } from '@/components/tool/text-stats'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { ToolPage, WorkspacePane, WorkspaceSplit, workspaceCardClass } from '@/components/tool/workspace'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { convertThaiKaraoke, needsReview, summarizeKaraokeWords, type KaraokeWordStatus } from '@/features/thai-karaoke/converter'
import {
  DEFAULT_KARAOKE_FORMAT,
  formatKaraoke,
  type KaraokeLetterCase,
  type KaraokeSyllableSeparator,
  type KaraokeWordSeparator,
} from '@/features/thai-karaoke/formatter'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'
import { cn } from '@/lib/utils'

const SAMPLE = `คิดถึงเธอทุกวัน
ความรักของเรา จะอยู่ตลอดไป
ไม่เป็นไรนะ ยิ้มไว้ดีๆ`

const MAX_REVIEW_ROWS = 200

const letterCaseOptions: Array<{ value: KaraokeLetterCase; label: string }> = [
  { value: 'lower', label: 'lowercase' },
  { value: 'upper', label: 'UPPERCASE' },
  { value: 'title', label: 'Title Case' },
]

// Radix Select cannot use an empty string as a value, so separators are keyed by name.
const syllableSeparatorOptions: Array<{ value: string; separator: KaraokeSyllableSeparator; label: string }> = [
  { value: 'none', separator: '', label: 'Syllables joined' },
  { value: 'hyphen', separator: '-', label: 'Syllables: kha-rao' },
  { value: 'space', separator: ' ', label: 'Syllables: kha rao' },
  { value: 'slash', separator: '/', label: 'Syllables: kha/rao' },
]

const wordSeparatorOptions: Array<{ value: string; separator: KaraokeWordSeparator; label: string }> = [
  { value: 'space', separator: ' ', label: 'Words: space' },
  { value: 'hyphen', separator: ' - ', label: 'Words: -' },
  { value: 'slash', separator: ' / ', label: 'Words: /' },
]

const statusLabels: Record<KaraokeWordStatus, string> = {
  dictionary: 'Dictionary',
  edited: 'Edited',
  guessed: 'Needs review',
  failed: 'Not converted',
}

const fieldClass =
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function ThaiKaraokePage() {
  const { enabled } = useSaveLocally()
  const [input, setInput] = usePersistedInput('thai-karaoke', enabled)
  const [letterCase, setLetterCase] = useState<KaraokeLetterCase>(DEFAULT_KARAOKE_FORMAT.letterCase)
  const [syllableKey, setSyllableKey] = useState('none')
  const [wordKey, setWordKey] = useState('space')
  // Manual readings live only in component memory; they are not part of Remember input.
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [reviewOnly, setReviewOnly] = useState(true)

  const deferredInput = useDeferredValue(input)
  const lines = useMemo(() => (deferredInput.trim() ? convertThaiKaraoke(deferredInput, overrides) : []), [deferredInput, overrides])
  const output = useMemo(
    () =>
      formatKaraoke(lines, {
        letterCase,
        syllableSeparator: syllableSeparatorOptions.find((option) => option.value === syllableKey)?.separator ?? '',
        wordSeparator: wordSeparatorOptions.find((option) => option.value === wordKey)?.separator ?? ' ',
      }),
    [lines, letterCase, syllableKey, wordKey],
  )
  const words = useMemo(() => summarizeKaraokeWords(lines), [lines])
  const reviewCount = words.filter((word) => needsReview(word.status)).length
  const visibleWords = (reviewOnly ? words.filter((word) => needsReview(word.status) || word.status === 'edited') : words).slice(0, MAX_REVIEW_ROWS)
  const editedCount = Object.keys(overrides).length

  const setOverride = (thai: string, reading: string) => {
    setOverrides((current) => {
      const next = { ...current }
      if (reading.trim()) next[thai] = reading
      else delete next[thai]
      return next
    })
  }

  const clear = () => {
    setInput('')
    setOverrides({})
  }

  return (
    <ToolPage>
      <ToolPageHeader
        title="Thai Karaoke Converter"
        description="Turn Thai lyrics and text into karaoke-style Latin readings (RTGS, no tone marks), then review and correct uncertain words — all in your browser."
      />

      <WorkspaceSplit
        toolbar={
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => setInput(SAMPLE)}>
              <FileText />
              Sample
            </Button>
            <Select value={letterCase} onValueChange={(value) => setLetterCase(value as KaraokeLetterCase)}>
              <SelectTrigger size="sm" className="w-auto min-w-[8rem]" aria-label="Letter case"><SelectValue /></SelectTrigger>
              <SelectContent>{letterCaseOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={syllableKey} onValueChange={setSyllableKey}>
              <SelectTrigger size="sm" className="w-auto min-w-[8rem]" aria-label="Syllable separator"><SelectValue /></SelectTrigger>
              <SelectContent>{syllableSeparatorOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={wordKey} onValueChange={setWordKey}>
              <SelectTrigger size="sm" className="w-auto min-w-[8rem]" aria-label="Word separator"><SelectValue /></SelectTrigger>
              <SelectContent>{wordSeparatorOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={!input && editedCount === 0}>
              <Eraser />
              Clear
            </Button>
          </>
        }
      >
        <WorkspacePane label="Thai text" actions={<TextStats value={input} />}>
          <CodeEditor bare value={input} onChange={setInput} placeholder="พิมพ์หรือวางข้อความภาษาไทย…" wrap ariaLabel="Thai text" language="text" />
        </WorkspacePane>
        <WorkspacePane
          label="Karaoke reading"
          tone="output"
          actions={
            <>
              <CopyButton value={output} />
              <Button type="button" size="sm" variant="outline" disabled={!output} onClick={() => downloadText(output, 'thai-karaoke.txt')}>
                <Download />
                .txt
              </Button>
            </>
          }
        >
          <CodeEditor bare value={output} readOnly placeholder="Karaoke reading will appear here." wrap ariaLabel="Karaoke reading" language="text" />
        </WorkspacePane>
      </WorkspaceSplit>

      {words.length > 0 && (
        <section className={cn('flex flex-col gap-3 p-4 sm:p-5', workspaceCardClass)} aria-labelledby="karaoke-words-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="karaoke-words-heading" className="text-sm font-semibold text-foreground">Word readings</h2>
              <p className="text-xs text-muted-foreground">
                Thai karaoke spelling has no single correct answer. Words outside the built-in dictionary are guesses — type your own reading to replace one everywhere it appears.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" aria-pressed={reviewOnly} className={cn(reviewOnly && 'bg-accent')} onClick={() => setReviewOnly((value) => !value)}>
                Needs review only
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={editedCount === 0} onClick={() => setOverrides({})}>
                <RotateCcw />
                Reset edits
              </Button>
            </div>
          </div>

          {visibleWords.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">Every word was found in the dictionary.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleWords.map((word) => (
                <li key={word.thai} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-base text-foreground" lang="th">
                      {word.thai}
                      {word.count > 1 && <span className="ml-1.5 text-xs text-muted-foreground">×{word.count}</span>}
                    </span>
                    <Badge variant={needsReview(word.status) ? 'destructive' : word.status === 'edited' ? 'default' : 'secondary'}>{statusLabels[word.status]}</Badge>
                  </div>
                  <input
                    value={overrides[word.thai] ?? ''}
                    onChange={(event) => setOverride(word.thai, event.target.value)}
                    placeholder={word.status === 'failed' ? 'Type a reading' : word.syllables.join('-')}
                    aria-label={`Reading for ${word.thai}`}
                    spellCheck={false}
                    autoCapitalize="off"
                    className={fieldClass}
                  />
                </li>
              ))}
            </ul>
          )}
          {(reviewOnly ? words.filter((word) => needsReview(word.status) || word.status === 'edited').length : words.length) > MAX_REVIEW_ROWS && (
            <p className="text-xs text-muted-foreground">Showing the first {MAX_REVIEW_ROWS} words.</p>
          )}
        </section>
      )}

      <ToolStatus
        state={output ? 'valid' : 'idle'}
        validLabel={`Converted ${words.length} unique ${words.length === 1 ? 'word' : 'words'}${reviewCount ? ` · ${reviewCount} need review` : ''}`}
      />
    </ToolPage>
  )
}
