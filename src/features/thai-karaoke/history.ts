/**
 * Undo/redo history. Rapid changes with the same `key` (dragging text, moving a slider, typing in one
 * field) are merged into one step when they arrive within `mergeWindowMs` of each other.
 */
export interface History<T> {
  past: T[]
  present: T
  future: T[]
  lastKey: string | null
  lastTime: number
}

export const HISTORY_LIMIT = 100
export const MERGE_WINDOW_MS = 800

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastTime: 0 }
}

export function commitHistory<T>(history: History<T>, next: T, options: { key?: string; now?: number } = {}): History<T> {
  if (Object.is(next, history.present)) return history
  const now = options.now ?? Date.now()
  const key = options.key ?? null
  const merge = key !== null && key === history.lastKey && now - history.lastTime <= MERGE_WINDOW_MS
  return {
    past: merge ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastTime: now,
  }
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    lastKey: null,
    lastTime: 0,
  }
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: history.future[0],
    future: history.future.slice(1),
    lastKey: null,
    lastTime: 0,
  }
}

/** Ends the current merge run, so the next change starts a new undo step. */
export function sealHistory<T>(history: History<T>): History<T> {
  return history.lastKey === null ? history : { ...history, lastKey: null }
}
