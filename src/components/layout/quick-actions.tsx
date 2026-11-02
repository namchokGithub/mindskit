import { MessageCircleMore, Pin, Search, Star } from 'lucide-react'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { tools } from '@/config/tools'
import { cn } from '@/lib/utils'
import type { ToolDefinition } from '@/types/tool'

export type QuickActionsState = {
  favorites: string[]
  recent: string[]
  usage: Record<string, number>
}

export const QUICK_ACTIONS_UPDATED_EVENT = 'mindskit:quick-actions-updated'
const STORAGE_KEY = 'mindskit:quick-actions'
const EMPTY_STATE: QuickActionsState = { favorites: [], recent: [], usage: {} }

export function readQuickActionsState(): QuickActionsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return EMPTY_STATE
    const parsed = JSON.parse(stored) as Partial<QuickActionsState>
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent : [],
      usage: parsed.usage ?? {},
    }
  } catch {
    return EMPTY_STATE
  }
}

// One shared store for every mounted QuickActions (header, sidebar, floating, mobile sheet), so instances never
// overwrite each other's pins or recent list with stale copies.
let currentState: QuickActionsState | null = null
let lastRecordedPath: string | null = null
const listeners = new Set<() => void>()

function getQuickActionsSnapshot(): QuickActionsState {
  currentState ??= readQuickActionsState()
  return currentState
}

function subscribeQuickActions(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function updateQuickActions(update: (previous: QuickActionsState) => QuickActionsState) {
  currentState = update(getQuickActionsSnapshot())
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState))
  } catch {
    // localStorage unavailable — keep the in-memory state
  }
  listeners.forEach((listener) => listener())
  window.dispatchEvent(new Event(QUICK_ACTIONS_UPDATED_EVENT))
}

function getTool(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}

export function QuickActions({ variant = 'floating' }: { variant?: 'sidebar' | 'floating' | 'header' }) {
  const sidebar = variant === 'sidebar'
  const header = variant === 'header'
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const state = useSyncExternalStore(subscribeQuickActions, getQuickActionsSnapshot)

  useEffect(() => {
    // Every mounted instance runs this effect; the module-level guard records each visit once.
    if (lastRecordedPath === location.pathname) return
    const tool = tools.find((item) => item.path === location.pathname)
    if (!tool) return
    lastRecordedPath = location.pathname
    updateQuickActions((previous) => ({
      ...previous,
      recent: [tool.id, ...previous.recent.filter((id) => id !== tool.id)].slice(0, 5),
      usage: { ...previous.usage, [tool.id]: (previous.usage[tool.id] ?? 0) + 1 },
    }))
  }, [location.pathname])

  const favorites = state.favorites.map(getTool).filter((tool): tool is ToolDefinition => Boolean(tool))
  const recent = state.recent.map(getTool).filter((tool): tool is ToolDefinition => Boolean(tool))
  const frequent = useMemo(
    () => Object.entries(state.usage)
      .map(([id, count]) => ({ tool: getTool(id), count }))
      .filter((item): item is { tool: ToolDefinition; count: number } => Boolean(item.tool))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
    [state.usage],
  )
  const searchResults = useMemo(
    () => tools.filter((tool) => tool.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6),
    [query],
  )

  const toggleFavorite = (id: string) => {
    updateQuickActions((previous) => ({
      ...previous,
      favorites: previous.favorites.includes(id)
        ? previous.favorites.filter((favorite) => favorite !== id)
        : [...previous.favorites, id],
    }))
  }

  const clearRecent = () => updateQuickActions((previous) => ({ ...previous, recent: [] }))
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" size={sidebar ? 'sm' : header ? 'icon' : 'icon-lg'} variant={sidebar ? 'outline' : header ? 'ghost' : 'default'} aria-label="Search tools" className={sidebar ? 'w-full justify-start' : header ? 'size-8' : 'fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-4 z-50 size-12 rounded-full shadow-[0_16px_28px_-14px_var(--primary)] sm:bottom-20 sm:left-6'}>
          {sidebar ? <Search /> : header ? <Search className="size-4" /> : <MessageCircleMore className="size-5" />}
          {sidebar && 'Search tools…'}
        </Button>
      </PopoverTrigger>
      <PopoverContent side={header ? 'bottom' : 'top'} align="start" className="flex max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] max-w-80 flex-col overflow-hidden p-2 sm:w-80">
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-sm font-semibold">Quick Actions</span>
          <Pin className="size-3.5 text-primary" />
        </div>
        <label className="relative my-1 block">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a tool…" className="h-8 w-full rounded-lg border border-input bg-background py-1 pr-2 pl-8 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
        </label>

        {query ? (
          <div className="min-h-0 overflow-y-auto">
          <QuickSection title="Tools">
            {searchResults.map((tool) => <QuickToolLink key={tool.id} tool={tool} isFavorite={state.favorites.includes(tool.id)} onSelect={() => setOpen(false)} onToggleFavorite={toggleFavorite} />)}
            {!searchResults.length && <p className="px-2 py-3 text-sm text-muted-foreground">No tools found.</p>}
          </QuickSection>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-1">
            {favorites.length > 0 && <QuickSection title="Pinned"><div>{favorites.map((tool) => <QuickToolLink key={tool.id} tool={tool} isFavorite onSelect={() => setOpen(false)} onToggleFavorite={toggleFavorite} />)}</div></QuickSection>}
            {recent.length > 0 && <QuickSection title="Recent" action={<button type="button" onClick={clearRecent} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}><div>{recent.map((tool) => <QuickToolLink key={tool.id} tool={tool} isFavorite={state.favorites.includes(tool.id)} onSelect={() => setOpen(false)} onToggleFavorite={toggleFavorite} />)}</div></QuickSection>}
            {frequent.length > 0 && <QuickSection title="Frequently used"><div>{frequent.map(({ tool, count }) => <QuickToolLink key={tool.id} tool={tool} detail={`${count} visits`} isFavorite={state.favorites.includes(tool.id)} onSelect={() => setOpen(false)} onToggleFavorite={toggleFavorite} />)}</div></QuickSection>}
            {!favorites.length && !recent.length && <p className="px-2 py-5 text-center text-sm text-muted-foreground">Open a tool to see it here, then pin your favorites.</p>}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function QuickSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section><div className="flex items-center justify-between px-1 pb-1"><span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</span>{action}</div>{children}</section>
}

function QuickToolLink({ tool, detail, isFavorite, onSelect, onToggleFavorite }: { tool: ToolDefinition; detail?: string; isFavorite: boolean; onSelect: () => void; onToggleFavorite: (id: string) => void }) {
  const Icon = tool.icon
  return <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent"><Link to={tool.path} onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2"><Icon className="size-4 shrink-0 text-primary" /><span className="truncate text-sm font-medium">{tool.name}</span>{detail && <span className="ml-auto text-xs text-muted-foreground">{detail}</span>}{tool.comingSoon && <Badge variant="secondary" className="badge-soon ml-auto px-1.5 py-0 text-[10px]">Soon</Badge>}</Link><button type="button" aria-label={`${isFavorite ? 'Unpin' : 'Pin'} ${tool.name}`} onClick={() => onToggleFavorite(tool.id)} className={cn('rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100', isFavorite && 'text-primary opacity-100')}><Star className={cn('size-3.5', isFavorite && 'fill-current')} /></button></div>
}
