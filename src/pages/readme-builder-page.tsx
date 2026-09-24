import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  FilePlus2,
  FolderOpen,
  GripVertical,
  Pencil,
  Plus,
  Redo2,
  Save,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'

import { CodeEditor } from '@/components/tool/code-editor'
import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { mergeAppliedMarkdown } from '@/features/readme-builder/apply-markdown'
import { deleteDraft, listDrafts, loadDraft, renameDraft, saveDraft, type ReadmeDraftSummary } from '@/features/readme-builder/drafts'
import { createBadgeUrl, createTocEntries, importReadme, renderReadme, type ImportResult } from '@/features/readme-builder/markdown'
import {
  addSection,
  applyTemplate,
  createDocument,
  duplicateSection,
  moveSection,
  pushHistory,
  updateSection,
  validateDocument,
  type ProjectType,
  type ReadmeBadge,
  type ReadmeDocument,
  type ReadmeSection,
  type SectionKind,
} from '@/features/readme-builder/model'
import { cn } from '@/lib/utils'

type ViewTab = 'builder' | 'markdown' | 'preview'

type SaveStatus = { state: 'idle' } | { state: 'saving' } | { state: 'saved'; at: number } | { state: 'error'; message: string }

interface ConfirmRequest {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onClose?: () => void
}

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const AUTOSAVE_DELAY_MS = 600
const TYPING_BURST_DELAY_MS = 500

const SECTION_KIND_ORDER: SectionKind[] = [
  'overview',
  'live-demo',
  'screenshots',
  'features',
  'tech-stack',
  'requirements',
  'installation',
  'usage',
  'configuration',
  'scripts',
  'project-structure',
  'api-reference',
  'testing',
  'deployment',
  'roadmap',
  'contributing',
  'license',
  'acknowledgements',
  'divider',
  'custom',
]

const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  overview: 'Overview',
  'live-demo': 'Live Demo',
  screenshots: 'Screenshots',
  features: 'Features',
  'tech-stack': 'Tech Stack',
  requirements: 'Requirements',
  installation: 'Installation',
  usage: 'Usage',
  configuration: 'Configuration',
  scripts: 'Scripts',
  'project-structure': 'Project Structure',
  'api-reference': 'API Reference',
  testing: 'Testing',
  deployment: 'Deployment',
  roadmap: 'Roadmap',
  contributing: 'Contributing',
  license: 'License',
  acknowledgements: 'Acknowledgements',
  divider: 'Divider',
  custom: 'Custom Section',
}

const PROJECT_TYPE_ORDER: ProjectType[] = ['default', 'blank', 'web-app', 'frontend-app', 'backend-api', 'cli-tool', 'library-package', 'mobile-app', 'full-stack-app']

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  default: 'Default',
  blank: 'Blank',
  'web-app': 'Web App',
  'frontend-app': 'Frontend App',
  'backend-api': 'Backend API',
  'cli-tool': 'CLI Tool',
  'library-package': 'Library / Package',
  'mobile-app': 'Mobile App',
  'full-stack-app': 'Full Stack App',
}

const fieldClass = 'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

function sectionHeadingLabel(section: ReadmeSection): string {
  if (section.kind === 'custom') {
    const custom = (section.fields.customTitle ?? '').trim()
    if (custom !== '') return custom
  }
  return section.title.trim() !== '' ? section.title : SECTION_KIND_LABELS[section.kind]
}

// Whether a document has any real content worth confirming before a
// destructive replace (New/Reset, Apply template). Checked directly against
// the document's own fields rather than an "edited" flag: a flag that's
// cleared whenever a document is loaded (e.g. `resetTo`, used by "load
// draft") would silently skip confirmation right after loading a populated
// draft. Section visibility is intentionally ignored — a hidden section's
// content is still destroyed by a template replace, so it still counts.
function documentHasContent(document: ReadmeDocument): boolean {
  if (document.badges.length > 0) return true
  return document.sections.some((section) => section.body.trim() !== '' || Object.values(section.fields).some((value) => value.trim() !== ''))
}

function saveStatusLabel(status: SaveStatus): string {
  if (status.state === 'saving') return 'Saving…'
  if (status.state === 'saved') return `Saved ${new Date(status.at).toLocaleTimeString()}`
  if (status.state === 'error') return status.message
  return ''
}

function SectionRow({
  section,
  isFirst,
  isLast,
  isSelected,
  isDragging,
  onSelect,
  onToggleVisible,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  section: ReadmeSection
  isFirst: boolean
  isLast: boolean
  isSelected: boolean
  isDragging: boolean
  onSelect: () => void
  onToggleVisible: () => void
  onDuplicate: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: (event: DragEvent<HTMLDivElement>) => void
  onDragOver: (event: DragEvent<HTMLDivElement>) => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}) {
  const heading = sectionHeadingLabel(section)
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-1.5 text-sm transition-colors',
        isSelected && 'border-primary/60 bg-primary/5',
        isDragging && 'opacity-50',
        !section.visible && 'opacity-60',
      )}
    >
      <span className="cursor-grab text-muted-foreground" aria-hidden="true">
        <GripVertical className="size-4" />
      </span>
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 truncate text-left">
        <span className="block truncate font-medium text-foreground">{heading || 'Untitled section'}</span>
        <span className="block text-[11px] text-muted-foreground">{SECTION_KIND_LABELS[section.kind]}</span>
      </button>
      <Button type="button" size="icon-xs" variant="ghost" aria-label={section.visible ? `Hide ${heading}` : `Show ${heading}`} onClick={onToggleVisible}>
        {section.visible ? <Eye /> : <EyeOff />}
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" aria-label={`Duplicate ${heading}`} onClick={onDuplicate}>
        <Copy />
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" aria-label={`Move ${heading} up`} onClick={onMoveUp} disabled={isFirst}>
        <ArrowUp />
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" aria-label={`Move ${heading} down`} onClick={onMoveDown} disabled={isLast}>
        <ArrowDown />
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove ${heading}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  )
}

function BadgeRow({ badge, index, onChange, onRemove }: { badge: ReadmeBadge; index: number; onChange: (patch: Partial<ReadmeBadge>) => void; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2">
      <img src={createBadgeUrl(badge)} alt={badge.label || 'Badge preview'} className="h-5 shrink-0" />
      <input className={cn(fieldClass, 'w-28')} placeholder="Label" aria-label={`Badge ${index + 1} label`} value={badge.label} onChange={(event) => onChange({ label: event.target.value })} />
      <input className={cn(fieldClass, 'w-28')} placeholder="Message" aria-label={`Badge ${index + 1} message`} value={badge.message} onChange={(event) => onChange({ message: event.target.value })} />
      <input className={cn(fieldClass, 'w-24')} placeholder="Color" aria-label={`Badge ${index + 1} color`} value={badge.color} onChange={(event) => onChange({ color: event.target.value })} />
      <input className={cn(fieldClass, 'w-40 flex-1')} placeholder="Link (optional)" aria-label={`Badge ${index + 1} link`} value={badge.link ?? ''} onChange={(event) => onChange({ link: event.target.value })} />
      <Button type="button" size="icon-xs" variant="ghost" aria-label={`Remove badge ${index + 1}`} onClick={onRemove}>
        <Trash2 />
      </Button>
    </div>
  )
}

export function ReadmeBuilderPage() {
  const [doc, setDoc] = useState(() => createDocument('default'))
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(doc.sections[0]?.id ?? null)
  const [view, setView] = useState<ViewTab>('builder')
  const [past, setPast] = useState<ReadmeDocument[]>([])
  const [future, setFuture] = useState<ReadmeDocument[]>([])
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null)
  const [pickerKind, setPickerKind] = useState<SectionKind>('overview')
  const [stagedTemplate, setStagedTemplate] = useState<ProjectType | null>(null)
  const [badgesOpen, setBadgesOpen] = useState(false)
  const [importNotices, setImportNotices] = useState<string[]>([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const [drafts, setDrafts] = useState<ReadmeDraftSummary[]>([])
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [renamingDraftId, setRenamingDraftId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'idle' })

  const documentRef = useRef(doc)
  // Mirror `past`/`future` in refs so history math always reads a synchronously
  // accurate array. React state (`past`/`future`) exists only to trigger renders
  // (e.g. disabling the Undo/Redo buttons); every write goes through
  // `updatePast`/`updateFuture` below, which updates the ref and the state
  // together. This avoids ever composing a new history array from a stale
  // render-closure value of `past`/`future` — see the fix note near `commit`.
  const pastRef = useRef<ReadmeDocument[]>([])
  const futureRef = useRef<ReadmeDocument[]>([])
  const pendingBaseRef = useRef<ReadmeDocument | null>(null)
  const burstTimerRef = useRef<number | undefined>(undefined)
  const autosaveTimerRef = useRef<number | undefined>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const markdown = useMemo(() => renderReadme(doc), [doc])
  const [markdownBuffer, setMarkdownBuffer] = useState(markdown)
  const syncedMarkdownRef = useRef(markdown)

  const issues = useMemo(() => validateDocument(doc), [doc])
  const tocEntries = useMemo(() => createTocEntries(doc), [doc])
  const selectedSection = doc.sections.find((section) => section.id === selectedSectionId) ?? null
  const templateSelectValue = stagedTemplate ?? doc.projectType

  useEffect(() => {
    documentRef.current = doc
  }, [doc])

  useEffect(() => {
    const exists = selectedSectionId !== null && doc.sections.some((section) => section.id === selectedSectionId)
    if (!exists) setSelectedSectionId(doc.sections[0]?.id ?? null)
  }, [doc, selectedSectionId])

  useEffect(() => {
    if (markdownBuffer === syncedMarkdownRef.current) {
      setMarkdownBuffer(markdown)
    }
    syncedMarkdownRef.current = markdown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markdown])

  useEffect(() => {
    void refreshDrafts()
  }, [])

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current)
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    }
  }, [])

  async function refreshDrafts() {
    try {
      setDrafts(await listDrafts())
    } catch {
      // Listing is best-effort; storage errors surface to the user via saveStatus when they act on a draft.
    }
  }

  // Cancels any pending typing-burst timer and returns (and clears) the
  // snapshot it was going to flush, or null if none is pending. Plain
  // synchronous ref bookkeeping — no setState — so it's safe to call from
  // both a direct event handler and the burst's own setTimeout callback.
  function takePendingBurstBase(): ReadmeDocument | null {
    if (burstTimerRef.current) {
      window.clearTimeout(burstTimerRef.current)
      burstTimerRef.current = undefined
    }
    const base = pendingBaseRef.current
    pendingBaseRef.current = null
    return base
  }

  // Sets `past`/`future` and their ref mirrors together. Always the sole way
  // either array is written, so `pastRef.current`/`futureRef.current` are
  // synchronously correct everywhere below, including inside the same event
  // handler that just called `flushBurst()`.
  function updatePast(next: ReadmeDocument[]) {
    pastRef.current = next
    setPast(next)
  }

  function updateFuture(next: ReadmeDocument[]) {
    futureRef.current = next
    setFuture(next)
  }

  // Folds a pending typing burst's pre-burst snapshot into `past`, if one is
  // pending. Reads/writes only through `pastRef`/`updatePast`, never the
  // `past` render-closure, so this is correct whether it runs from the
  // burst's own setTimeout (an async callback whose closure could otherwise
  // be stale) or synchronously at the top of `commit`/`undo`/`redo` (see fix
  // note there for why mixing a functional setState with a closure-value one
  // in the same handler previously dropped or skipped checkpoints).
  function flushBurst() {
    const base = takePendingBurstBase()
    if (base !== null) {
      updatePast(pushHistory(pastRef.current, base))
    }
  }

  function discardBurst() {
    takePendingBurstBase()
  }

  function scheduleAutosave() {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      void persistDraft()
    }, AUTOSAVE_DELAY_MS)
  }

  async function persistDraft(): Promise<boolean> {
    setSaveStatus({ state: 'saving' })
    try {
      await saveDraft(documentRef.current)
      setSaveStatus({ state: 'saved', at: Date.now() })
      void refreshDrafts()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Local draft storage is unavailable in this browser.'
      setSaveStatus({ state: 'error', message })
      return false
    }
  }

  // Fix note (undo/redo checkpoint loss): this used to call `flushBurst()`
  // (a functional `setPast` update) and then immediately call
  // `setPast(pushHistory(past, doc))` using the `past` render-closure value.
  // React doesn't synchronously apply a queued functional update back into
  // that closure, so the second, value-based `setPast` call would silently
  // replace/discard whatever `flushBurst` had just queued — losing the
  // pre-burst checkpoint if this ran within ~500ms of the user's last
  // keystroke. `commit`/`undo`/`redo` now exclusively read/write history
  // through `pastRef.current`/`futureRef.current` (via `updatePast`/
  // `updateFuture`), which are always synchronously accurate, so there is no
  // stale-closure value left to race against.
  function commit(next: ReadmeDocument) {
    flushBurst()
    updatePast(pushHistory(pastRef.current, doc))
    updateFuture([])
    setDoc(next)
    scheduleAutosave()
  }

  function commitTyped(next: ReadmeDocument) {
    if (!pendingBaseRef.current) pendingBaseRef.current = doc
    updateFuture([])
    setDoc(next)
    scheduleAutosave()
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current)
    burstTimerRef.current = window.setTimeout(flushBurst, TYPING_BURST_DELAY_MS)
  }

  function undo() {
    flushBurst()
    const current = pastRef.current
    if (current.length === 0) return
    const previous = current[current.length - 1]
    updatePast(current.slice(0, -1))
    updateFuture(pushHistory(futureRef.current, doc))
    setDoc(previous)
    // Undo changes the in-memory document just like `commit` does, so it
    // must also mark the draft dirty and schedule a save — otherwise the
    // undone state only lives in memory and reloading the page (or
    // reloading the draft from the Drafts list) silently reverts it.
    scheduleAutosave()
  }

  function redo() {
    // Flushed for consistency with `commit`/`undo` — currently a no-op in
    // practice since `commitTyped` always clears `future`, so a burst can
    // never be pending while `future` is non-empty, but keeping every
    // history-mutating action funnel through the same flush-first shape
    // avoids relying on that invariant holding forever.
    flushBurst()
    const current = futureRef.current
    if (current.length === 0) return
    const next = current[current.length - 1]
    updateFuture(current.slice(0, -1))
    updatePast(pushHistory(pastRef.current, doc))
    setDoc(next)
    // See `undo` above: redo must persist too, or a redo can be silently
    // reverted by a reload.
    scheduleAutosave()
  }

  function resetTo(next: ReadmeDocument) {
    discardBurst()
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = undefined
    }
    updatePast([])
    updateFuture([])
    setSaveStatus({ state: 'idle' })
    setDoc(next)
    setSelectedSectionId(next.sections[0]?.id ?? null)
    setStagedTemplate(null)
    setView('builder')
    const nextMarkdown = renderReadme(next)
    setMarkdownBuffer(nextMarkdown)
    syncedMarkdownRef.current = nextMarkdown
    setImportNotices([])
  }

  function handleNewClick() {
    const startFresh = () => resetTo(createDocument('default'))
    if (documentHasContent(doc)) {
      setConfirmRequest({
        title: 'Start a new README?',
        description: 'This clears the current workspace. Anything already saved to your Drafts list is unaffected.',
        confirmLabel: 'Start new',
        onConfirm: startFresh,
      })
    } else {
      startFresh()
    }
  }

  function handleApplyTemplateClick() {
    const target = stagedTemplate
    if (!target || target === doc.projectType) return
    const applyNow = () => {
      commit(applyTemplate(doc, target))
      setStagedTemplate(null)
    }
    if (documentHasContent(doc)) {
      setConfirmRequest({
        title: 'Replace sections with this template?',
        description: `Switching to "${PROJECT_TYPE_LABELS[target]}" replaces every current section. Your title, badges, and table-of-contents setting are kept.`,
        confirmLabel: 'Replace sections',
        onConfirm: applyNow,
      })
    } else {
      applyNow()
    }
  }

  function handleAddSection() {
    const next = addSection(doc, pickerKind)
    commit(next)
    const added = next.sections[next.sections.length - 1]
    if (added) setSelectedSectionId(added.id)
  }

  function handleToggleVisible(id: string) {
    const section = doc.sections.find((item) => item.id === id)
    if (!section) return
    commit(updateSection(doc, id, { visible: !section.visible }))
  }

  function handleDuplicateSection(id: string) {
    const index = doc.sections.findIndex((section) => section.id === id)
    if (index === -1) return
    const next = duplicateSection(doc, id)
    commit(next)
    const duplicate = next.sections[index + 1]
    if (duplicate) setSelectedSectionId(duplicate.id)
  }

  function handleRemoveSection(id: string) {
    const index = doc.sections.findIndex((section) => section.id === id)
    if (index === -1) return
    const next = { ...doc, sections: doc.sections.filter((section) => section.id !== id) }
    commit(next)
    if (selectedSectionId === id) {
      const fallback = next.sections[index - 1]?.id ?? next.sections[index]?.id ?? null
      setSelectedSectionId(fallback)
    }
  }

  function handleMoveSection(id: string, direction: 'up' | 'down') {
    const index = doc.sections.findIndex((section) => section.id === id)
    if (index === -1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    commit(moveSection(doc, id, targetIndex))
  }

  function handleSectionDragStart(id: string) {
    return (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.setData('text/plain', id)
      event.dataTransfer.effectAllowed = 'move'
      setDraggingSectionId(id)
    }
  }

  function handleSectionDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleSectionDrop(targetId: string) {
    return (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const sourceId = event.dataTransfer.getData('text/plain') || draggingSectionId
      setDraggingSectionId(null)
      if (!sourceId || sourceId === targetId) return
      const targetIndex = doc.sections.findIndex((section) => section.id === targetId)
      if (targetIndex === -1) return
      commit(moveSection(doc, sourceId, targetIndex))
    }
  }

  function handleSectionDragEnd() {
    setDraggingSectionId(null)
  }

  function handleAddBadge() {
    const badge: ReadmeBadge = { id: crypto.randomUUID(), label: 'label', message: 'message', color: 'blue', link: '' }
    commit({ ...doc, badges: [...doc.badges, badge] })
  }

  function handleUpdateBadge(id: string, patch: Partial<ReadmeBadge>) {
    commitTyped({ ...doc, badges: doc.badges.map((badge) => (badge.id === id ? { ...badge, ...patch } : badge)) })
  }

  function handleRemoveBadge(id: string) {
    commit({ ...doc, badges: doc.badges.filter((badge) => badge.id !== id) })
  }

  function applyImportResult({ document: imported, notices }: ImportResult, sourceLabel: string) {
    commit(imported)
    setSelectedSectionId(imported.sections[0]?.id ?? null)
    const nextMarkdown = renderReadme(imported)
    setMarkdownBuffer(nextMarkdown)
    syncedMarkdownRef.current = nextMarkdown
    setImportNotices(notices)
    toast.success(`${sourceLabel} imported${notices.length ? ` with ${notices.length} note${notices.length === 1 ? '' : 's'}` : ''}`)
  }

  function handleApplyMarkdown() {
    const result = importReadme(markdownBuffer)
    applyImportResult({ document: mergeAppliedMarkdown(doc, result.document), notices: result.notices }, 'Markdown')
  }

  function handlePasteApply() {
    applyImportResult(importReadme(pasteValue), 'Pasted Markdown')
    setPasteOpen(false)
    setPasteValue('')
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error('Choose a Markdown file smaller than 10 MB.')
      return
    }
    try {
      const text = await file.text()
      applyImportResult(importReadme(text), 'File')
    } catch {
      toast.error('Unable to read this file.')
    }
  }

  function handleDownload() {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const link = window.document.createElement('a')
    link.href = url
    link.download = 'README.md'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function handleManualSave() {
    const ok = await persistDraft()
    if (ok) toast.success('Draft saved')
    else toast.error('Could not save this draft.')
  }

  async function handleLoadDraft(id: string) {
    try {
      const loaded = await loadDraft(id)
      if (!loaded) {
        toast.error('This draft no longer exists.')
        void refreshDrafts()
        return
      }
      resetTo(loaded)
      setDraftsOpen(false)
      toast.success(`Loaded "${loaded.name}"`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load this draft.')
    }
  }

  async function handleDuplicateDraft(id: string) {
    try {
      const loaded = await loadDraft(id)
      if (!loaded) {
        toast.error('This draft no longer exists.')
        void refreshDrafts()
        return
      }
      const copy: ReadmeDocument = { ...loaded, id: crypto.randomUUID(), name: `${loaded.name} (copy)` }
      await saveDraft(copy)
      await refreshDrafts()
      toast.success('Draft duplicated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not duplicate this draft.')
    }
  }

  async function handleConfirmRename(id: string) {
    const name = renameValue.trim() || 'Untitled'
    try {
      await renameDraft(id, name)
      if (id === doc.id) setDoc((current) => ({ ...current, name }))
      setRenamingDraftId(null)
      await refreshDrafts()
      toast.success('Draft renamed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not rename this draft.')
    }
  }

  async function handleDeleteDraft(id: string) {
    try {
      await deleteDraft(id)
      await refreshDrafts()
      toast.success('Draft deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete this draft.')
    }
  }

  function requestDeleteDraft(id: string, name: string) {
    // Close the Drafts sheet first: Radix marks non-portaled siblings aria-hidden while a
    // Dialog/Sheet is open, which would trap keyboard and screen-reader users inside the
    // Sheet and make this plain confirm dialog unreachable even though it renders on top.
    setDraftsOpen(false)
    setConfirmRequest({
      title: 'Delete this draft?',
      description: `"${name || 'Untitled'}" will be permanently removed from this browser. This cannot be undone.`,
      confirmLabel: 'Delete draft',
      onConfirm: () => {
        void handleDeleteDraft(id)
      },
      onClose: () => setDraftsOpen(true),
    })
  }

  const statusText = saveStatusLabel(saveStatus)

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-full">
      <ToolPageHeader title="README Builder" description="Build, preview, and save clean README.md files locally." showRememberInput={false} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleNewClick}>
          <FilePlus2 />
          New
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={undo} disabled={past.length === 0}>
          <Undo2 />
          Undo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={redo} disabled={future.length === 0}>
          <Redo2 />
          Redo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <FileUp />
          Import file
        </Button>
        <input ref={fileInputRef} type="file" accept=".md,.markdown,.txt" className="hidden" onChange={(event) => void handleFileChange(event)} />
        <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
          <ClipboardPaste />
          Paste Markdown
        </Button>
        <CopyButton value={markdown} />
        <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
          <Download />
          Download README.md
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setDraftsOpen(true)}>
          <FolderOpen />
          Drafts{drafts.length > 0 ? ` (${drafts.length})` : ''}
        </Button>
        {statusText && <span className={cn('text-xs', saveStatus.state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{statusText}</span>}
      </div>

      <div className="tool-options-card shrink-0 rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Document name
            <input className={fieldClass} value={doc.name} onChange={(event) => commitTyped({ ...doc, name: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            README title (H1)
            <input className={fieldClass} value={doc.title} onChange={(event) => commitTyped({ ...doc, title: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Project template
            <div className="flex items-center gap-1.5">
              <Select value={templateSelectValue} onValueChange={(value) => setStagedTemplate(value as ProjectType)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPE_ORDER.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PROJECT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {stagedTemplate && stagedTemplate !== doc.projectType && (
                <Button type="button" size="sm" onClick={handleApplyTemplateClick}>
                  Apply
                </Button>
              )}
            </div>
          </label>
          <label className="flex items-end gap-1.5 pb-1.5 text-xs text-muted-foreground">
            <Checkbox checked={doc.includeTableOfContents} onCheckedChange={(value) => commit({ ...doc, includeTableOfContents: value === true })} />
            Include table of contents
          </label>
        </div>
        {doc.includeTableOfContents && (
          <p className="mt-2 text-[11px] text-muted-foreground">{tocEntries.length > 0 ? `Links to: ${tocEntries.map((entry) => entry.title).join(', ')}` : 'No visible sections to list yet.'}</p>
        )}
        <Collapsible open={badgesOpen} onOpenChange={setBadgesOpen} className="mt-3 border-t border-border pt-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium text-foreground">
            <span>Badges ({doc.badges.length})</span>
            <ChevronDown className={cn('size-4 transition-transform', badgesOpen && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-2 pt-3">
            {doc.badges.length === 0 && <p className="text-xs text-muted-foreground">No badges yet.</p>}
            {doc.badges.map((badge, index) => (
              <BadgeRow key={badge.id} badge={badge} index={index} onChange={(patch) => handleUpdateBadge(badge.id, patch)} onRemove={() => handleRemoveBadge(badge.id)} />
            ))}
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={handleAddBadge}>
              <Plus />
              Add badge
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex w-fit shrink-0 gap-1 rounded-lg border border-border bg-card p-1" role="tablist" aria-label="README view">
        {(
          [
            ['builder', 'Builder'],
            ['markdown', 'Markdown'],
            ['preview', 'Preview'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={view === tab}
            onClick={() => setView(tab)}
            className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', view === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'builder' && (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm lg:overflow-y-auto">
            <h2 className="text-sm font-medium text-muted-foreground">Sections</h2>
            <div className="flex items-center gap-1.5">
              <Select value={pickerKind} onValueChange={(value) => setPickerKind(value as SectionKind)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_KIND_ORDER.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {SECTION_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" onClick={handleAddSection}>
                <Plus />
                Add
              </Button>
            </div>
            <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto lg:max-h-none lg:flex-1">
              {doc.sections.length === 0 && <p className="p-2 text-sm text-muted-foreground">No sections yet. Add one from the library above.</p>}
              {doc.sections.map((section, index) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  isFirst={index === 0}
                  isLast={index === doc.sections.length - 1}
                  isSelected={section.id === selectedSectionId}
                  isDragging={section.id === draggingSectionId}
                  onSelect={() => setSelectedSectionId(section.id)}
                  onToggleVisible={() => handleToggleVisible(section.id)}
                  onDuplicate={() => handleDuplicateSection(section.id)}
                  onRemove={() => handleRemoveSection(section.id)}
                  onMoveUp={() => handleMoveSection(section.id, 'up')}
                  onMoveDown={() => handleMoveSection(section.id, 'down')}
                  onDragStart={handleSectionDragStart(section.id)}
                  onDragOver={handleSectionDragOver}
                  onDrop={handleSectionDrop(section.id)}
                  onDragEnd={handleSectionDragEnd}
                />
              ))}
            </div>
          </section>

          <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm lg:overflow-y-auto">
            <h2 className="text-sm font-medium text-muted-foreground">Editor</h2>
            {!selectedSection ? (
              <p className="text-sm text-muted-foreground">{doc.sections.length === 0 ? 'Add a section from the library to get started.' : 'Select a section to edit its content.'}</p>
            ) : selectedSection.kind === 'divider' ? (
              <p className="text-sm text-muted-foreground">This section renders a horizontal rule (`---`) without a heading or table-of-contents entry.</p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{SECTION_KIND_LABELS[selectedSection.kind]}</span>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={selectedSection.visible} onCheckedChange={() => handleToggleVisible(selectedSection.id)} />
                    Visible in README
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Heading
                  <input className={fieldClass} value={selectedSection.title} onChange={(event) => commitTyped(updateSection(doc, selectedSection.id, { title: event.target.value }))} />
                </label>
                {selectedSection.kind === 'custom' && (
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Custom section title (used as the rendered heading)
                    <input
                      className={fieldClass}
                      value={selectedSection.fields.customTitle ?? ''}
                      onChange={(event) => commitTyped(updateSection(doc, selectedSection.id, { fields: { ...selectedSection.fields, customTitle: event.target.value } }))}
                    />
                  </label>
                )}
                {selectedSection.kind === 'live-demo' && (
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    Demo URL
                    <input
                      className={fieldClass}
                      placeholder="https://example.com"
                      value={selectedSection.fields.url ?? ''}
                      onChange={(event) => commitTyped(updateSection(doc, selectedSection.id, { fields: { ...selectedSection.fields, url: event.target.value } }))}
                    />
                  </label>
                )}
                <label className="flex min-h-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
                  Content (Markdown)
                  <Textarea
                    className="min-h-40 flex-1 font-mono text-sm lg:min-h-0"
                    placeholder="Write this section's content…"
                    value={selectedSection.body}
                    onChange={(event) => commitTyped(updateSection(doc, selectedSection.id, { body: event.target.value }))}
                  />
                </label>
              </div>
            )}
          </section>

          <div className="hidden min-h-0 flex-col gap-2 lg:flex">
            <h2 className="text-sm font-medium text-muted-foreground">Live preview</h2>
            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card p-4">
              <div className="markdown-preview">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'markdown' && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Edit raw Markdown, then apply it to replace the structured document.</p>
            <Button type="button" size="sm" onClick={handleApplyMarkdown} disabled={markdownBuffer === markdown}>
              <Check />
              Apply Markdown
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor language="markdown" value={markdownBuffer} onChange={setMarkdownBuffer} wrap ariaLabel="README Markdown source" />
          </div>
          {importNotices.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Import notes</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {importNotices.map((notice, index) => (
                  <li key={index}>{notice}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {view === 'preview' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">Preview</h2>
            <CopyButton value={markdown} />
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="markdown-preview">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-[80vw] max-w-full">
        <ToolStatus state={issues.length > 0 ? 'invalid' : 'valid'} message={issues.length > 0 ? issues.map((issue) => issue.message).join(' · ') : undefined} validLabel="README looks good" />
      </div>

      <Sheet open={draftsOpen} onOpenChange={setDraftsOpen}>
        <SheetContent side="right" className="w-80 gap-0 p-0 sm:w-96">
          <SheetHeader>
            <SheetTitle>Saved drafts</SheetTitle>
            <SheetDescription>Stored locally in this browser via IndexedDB, independent of Remember input.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4 pt-0">
            <Button type="button" size="sm" variant="outline" onClick={() => void handleManualSave()}>
              <Save />
              Save current as draft
            </Button>
            {drafts.length === 0 ? (
              <p className="pt-4 text-sm text-muted-foreground">No saved drafts yet. Edits autosave here once you start writing.</p>
            ) : (
              drafts.map((draft) => (
                <div key={draft.id} className={cn('rounded-lg border border-border p-2.5', draft.id === doc.id && 'border-primary/60 bg-primary/5')}>
                  {renamingDraftId === draft.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        className={cn(fieldClass, 'flex-1')}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void handleConfirmRename(draft.id)
                          if (event.key === 'Escape') setRenamingDraftId(null)
                        }}
                      />
                      <Button type="button" size="icon-xs" variant="ghost" aria-label="Save name" onClick={() => void handleConfirmRename(draft.id)}>
                        <Check />
                      </Button>
                      <Button type="button" size="icon-xs" variant="ghost" aria-label="Cancel rename" onClick={() => setRenamingDraftId(null)}>
                        <X />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{draft.name || 'Untitled'}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(draft.updatedAt).toLocaleString()}</p>
                      </div>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Rename ${draft.name}`}
                        onClick={() => {
                          setRenamingDraftId(draft.id)
                          setRenameValue(draft.name)
                        }}
                      >
                        <Pencil />
                      </Button>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button type="button" size="xs" variant="outline" onClick={() => void handleLoadDraft(draft.id)}>
                      <FolderOpen />
                      Load
                    </Button>
                    <Button type="button" size="xs" variant="outline" onClick={() => void handleDuplicateDraft(draft.id)}>
                      <Copy />
                      Duplicate
                    </Button>
                    <Button type="button" size="xs" variant="outline" className="ml-auto text-destructive hover:text-destructive" onClick={() => requestDeleteDraft(draft.id, draft.name)}>
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {pasteOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="paste-markdown-title" className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-4">
          <div className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-border bg-popover p-5 shadow-xl">
            <h2 id="paste-markdown-title" className="font-semibold text-foreground">
              Paste Markdown
            </h2>
            <p className="text-sm text-muted-foreground">Paste a full README and apply it to replace the current structured document.</p>
            <Textarea autoFocus rows={10} className="font-mono text-sm" value={pasteValue} onChange={(event) => setPasteValue(event.target.value)} placeholder="# Project title…" />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPasteOpen(false)
                  setPasteValue('')
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handlePasteApply} disabled={!pasteValue.trim()}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmRequest && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="readme-confirm-title" className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-popover p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 id="readme-confirm-title" className="font-semibold text-foreground">
                  {confirmRequest.title}
                </h2>
                <p className="text-sm text-muted-foreground">{confirmRequest.description}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  confirmRequest.onClose?.()
                  setConfirmRequest(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  confirmRequest.onConfirm()
                  confirmRequest.onClose?.()
                  setConfirmRequest(null)
                }}
              >
                {confirmRequest.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
