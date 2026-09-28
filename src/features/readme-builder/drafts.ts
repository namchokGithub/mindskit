import type { ReadmeDocument } from './model.ts'

/**
 * Summary of a saved draft, as shown in a draft list
 */
export interface ReadmeDraftSummary {
  id: string
  name: string
  updatedAt: number
}

/**
 * A stored draft record: the document plus when it was last saved
 */
interface DraftRecord {
  document: ReadmeDocument
  updatedAt: number
}

/**
 * Storage seam for draft persistence. Any conforming implementation
 * (in-memory, IndexedDB, ...) can back `createDraftsAdapter`.
 */
export interface DraftStorage {
  get(id: string): Promise<DraftRecord | null>
  put(id: string, record: DraftRecord): Promise<void>
  delete(id: string): Promise<void>
  list(): Promise<Array<{ id: string; record: DraftRecord }>>
}

/**
 * The five draft operations exposed to callers, built on top of a
 * `DraftStorage` by `createDraftsAdapter`.
 */
export interface DraftsAdapter {
  listDrafts(): Promise<ReadmeDraftSummary[]>
  loadDraft(id: string): Promise<ReadmeDocument | null>
  saveDraft(document: ReadmeDocument): Promise<ReadmeDraftSummary>
  renameDraft(id: string, name: string): Promise<void>
  deleteDraft(id: string): Promise<void>
}

const UNAVAILABLE_MESSAGE = 'Local draft storage is unavailable in this browser.'

/**
 * Summarize a stored record for list display
 */
function toSummary(id: string, record: DraftRecord): ReadmeDraftSummary {
  return { id, name: record.document.name, updatedAt: record.updatedAt }
}

/**
 * Build the five draft operations on top of any conforming `DraftStorage`.
 * Every call into `storage` is wrapped so a storage-layer failure (a real
 * IndexedDB error, or anything a fake storage throws) surfaces as a single
 * user-facing "unavailable" error, regardless of backend. Domain-level
 * failures the adapter itself raises (like renaming a draft that doesn't
 * exist) are not storage failures and are thrown as-is.
 */
export function createDraftsAdapter(storage: DraftStorage): DraftsAdapter {
  async function callStorage<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch {
      throw new Error(UNAVAILABLE_MESSAGE)
    }
  }

  return {
    async listDrafts() {
      const entries = await callStorage(() => storage.list())
      return entries.map(({ id, record }) => toSummary(id, record)).sort((a, b) => b.updatedAt - a.updatedAt)
    },

    async loadDraft(id) {
      const record = await callStorage(() => storage.get(id))
      return record ? record.document : null
    },

    async saveDraft(document) {
      const record: DraftRecord = { document, updatedAt: Date.now() }
      await callStorage(() => storage.put(document.id, record))
      return toSummary(document.id, record)
    },

    async renameDraft(id, name) {
      const existing = await callStorage(() => storage.get(id))
      if (!existing) throw new Error(`No draft found with id: ${id}`)
      await callStorage(() =>
        storage.put(id, {
          document: { ...existing.document, name },
          updatedAt: Date.now(),
        }),
      )
    },

    async deleteDraft(id) {
      await callStorage(() => storage.delete(id))
    },
  }
}

/**
 * In-memory `DraftStorage` test double. Not persisted across page loads;
 * intended for unit tests, not browser use.
 *
 * `list()` orders its results most-recently-`put`-first using an internal
 * sequence counter, purely as a tiebreak: `Array.prototype.sort` is stable,
 * so when the adapter's `listDrafts` later sorts these by `updatedAt` (which
 * can collide within the same millisecond, especially in fast test runs),
 * entries with equal `updatedAt` keep this relative order instead of an
 * arbitrary one. The counter never touches the stored `updatedAt` value
 * itself — callers only ever see exactly what `createDraftsAdapter` wrote.
 */
export function createMemoryDraftStorage(): DraftStorage {
  const records = new Map<string, DraftRecord>()
  const sequenceById = new Map<string, number>()
  let sequence = 0

  return {
    async get(id) {
      return records.get(id) ?? null
    },
    async put(id, record) {
      records.set(id, record)
      sequenceById.set(id, sequence++)
    },
    async delete(id) {
      records.delete(id)
      sequenceById.delete(id)
    },
    async list() {
      return Array.from(records, ([id, record]) => ({ id, record })).sort(
        (a, b) => (sequenceById.get(b.id) ?? 0) - (sequenceById.get(a.id) ?? 0),
      )
    },
  }
}

const DATABASE_NAME = 'mindskit-readme-builder'
const DATABASE_VERSION = 1
const STORE_NAME = 'drafts'

/**
 * Open (and, on first use, create) the readme-builder IndexedDB database.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Run a single transaction against the `drafts` object store
 */
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const request = run(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

/**
 * Real, browser-backed `DraftStorage` using IndexedDB. Database
 * `mindskit-readme-builder` (version 1), object store `drafts` keyed by
 * document id, storing the document plus an `updatedAt` timestamp.
 */
export function createIndexedDbDraftStorage(): DraftStorage {
  return {
    async get(id) {
      const result = await withStore('readonly', (store) => store.get(id))
      return (result as DraftRecord | undefined) ?? null
    },
    async put(id, record) {
      await withStore('readwrite', (store) => store.put(record, id))
    },
    async delete(id) {
      await withStore('readwrite', (store) => store.delete(id))
    },
    async list() {
      const db = await openDatabase()
      try {
        return await new Promise<Array<{ id: string; record: DraftRecord }>>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readonly')
          const store = transaction.objectStore(STORE_NAME)
          const keysRequest = store.getAllKeys()
          const valuesRequest = store.getAll()
          transaction.oncomplete = () => {
            const keys = keysRequest.result as string[]
            const values = valuesRequest.result as DraftRecord[]
            resolve(keys.map((id, index) => ({ id, record: values[index] })))
          }
          transaction.onerror = () => reject(transaction.error)
        })
      } finally {
        db.close()
      }
    },
  }
}

const defaultAdapter = createDraftsAdapter(createIndexedDbDraftStorage())

/**
 * Default draft operations, pre-bound to the real IndexedDB-backed storage.
 * Import and call these directly; use `createDraftsAdapter` only to test
 * against an alternate `DraftStorage`.
 */
export const listDrafts = defaultAdapter.listDrafts
export const loadDraft = defaultAdapter.loadDraft
export const saveDraft = defaultAdapter.saveDraft
export const renameDraft = defaultAdapter.renameDraft
export const deleteDraft = defaultAdapter.deleteDraft
