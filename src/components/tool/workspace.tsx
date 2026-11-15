import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/*
 * Shared tool layout primitives (see docs/ui-patterns.md).
 *
 * Spacing: page sections are 16px apart (gap-4); cards use 16–20px padding; toolbars 12px × 8px.
 * Layout variants:
 *   - WorkspaceSplit  — toolbar + input | output panes (formatters, converters)
 *   - WorkspaceSingle — toolbar + one body (quick tools, generators)
 *   - WorkspaceCanvas — large preview + side controls (images, Screen Simulator)
 *   - WorkspaceForm   — centered card for calculators (color, timestamp, Minecraft)
 * Motion: CSS only, short (150–200 ms) and disabled for reduced motion.
 */

/** Page wrapper with standard spacing and a short fade-in. */
export function ToolPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-0 flex-col gap-4 lg:h-full animate-in fade-in duration-200 motion-reduce:animate-none', className)}>
      {children}
    </div>
  )
}

/** Standard card surface: border, background, soft shadow, and a focus ring while a control inside has focus. */
export const workspaceCardClass =
  'rounded-xl border border-border bg-card shadow-sm transition-[box-shadow,border-color] duration-200 focus-within:border-ring/60 focus-within:shadow-md motion-reduce:transition-none'

/** Toolbar row at the top of a workspace card. Put one primary button first, then outline, then ghost buttons. */
export function WorkspaceToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2', className)}>{children}</div>
}

/** One labelled pane. `tone="output"` marks a result pane (muted background). */
export function WorkspacePane({
  label,
  actions,
  tone = 'input',
  children,
  className,
}: {
  label: ReactNode
  actions?: ReactNode
  tone?: 'input' | 'output'
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('flex min-h-65 min-w-0 flex-col lg:min-h-0', tone === 'input' ? 'bg-editor/40' : 'bg-muted/20', className)}>
      <div className="flex min-h-11 items-center justify-between gap-2 px-3 py-1.5">
        <h2 className="text-sm font-medium text-muted-foreground">{label}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export function WorkspaceSplit({ toolbar, children, className }: { toolbar?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden', workspaceCardClass, className)}>
      {toolbar && <WorkspaceToolbar>{toolbar}</WorkspaceToolbar>}
      <div className="tool-workspace-grid grid min-h-0 grid-cols-1 divide-y divide-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">{children}</div>
    </div>
  )
}

export function WorkspaceSingle({ toolbar, children, className }: { toolbar?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden', workspaceCardClass, className)}>
      {toolbar && <WorkspaceToolbar>{toolbar}</WorkspaceToolbar>}
      <div className="flex min-h-0 flex-1 flex-col p-4">{children}</div>
    </div>
  )
}

export function WorkspaceCanvas({ preview, controls, className }: { preview: ReactNode; controls: ReactNode; className?: string }) {
  return (
    <div className={cn('grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]', className)}>
      <section className={cn('flex min-w-0 flex-col gap-3 p-4', workspaceCardClass)}>{preview}</section>
      <aside className={cn('flex min-w-0 flex-col gap-4 p-4', workspaceCardClass)}>{controls}</aside>
    </div>
  )
}

export function WorkspaceForm({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-5', workspaceCardClass, className)}>{children}</section>
}

/** Consistent empty state: icon, short title, one-line hint, and an optional action (e.g. Choose file / Sample). */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-40 flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center', className)}>
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

/** Wraps a freshly produced result so it fades and slides in slightly; re-keys on `resultKey` to replay. */
export function ResultReveal({ resultKey, children, className }: { resultKey: string | number; children: ReactNode; className?: string }) {
  return (
    <div key={resultKey} className={cn('flex min-h-0 flex-1 flex-col animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none', className)}>
      {children}
    </div>
  )
}
