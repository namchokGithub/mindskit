import { normalizeStyle, type KaraokeStyleSettings } from './image-presets.ts'

/**
 * Custom style presets the user saves explicitly in the Karaoke Image Maker. Only style settings are
 * stored (no text, no image), in IndexedDB, independent of Remember input.
 */
export interface CustomPreset {
  id: string
  name: string
  style: KaraokeStyleSettings
  updatedAt: number
}

export interface PresetStorage {
  put(id: string, record: unknown): Promise<void>
  delete(id: string): Promise<void>
  list(): Promise<Array<{ id: string; record: unknown }>>
}

export interface PresetStore {
  listPresets(): Promise<CustomPreset[]>
  savePreset(name: string, style: KaraokeStyleSettings): Promise<CustomPreset>
  deletePreset(id: string): Promise<void>
}

export const MAX_CUSTOM_PRESETS = 50
export const MAX_PRESET_NAME_LENGTH = 40
const UNAVAILABLE_MESSAGE = 'Saving presets is unavailable in this browser.'

/** Cleans up a stored record; returns null for anything that is not a usable preset. */
export function normalizeCustomPreset(id: string, record: unknown): CustomPreset | null {
  if (typeof record !== 'object' || record === null) return null
  const input = record as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, MAX_PRESET_NAME_LENGTH) : ''
  const style = normalizeStyle(input.style)
  if (!name || !style) return null
  return { id, name, style, updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : 0 }
}

export function createPresetStore(storage: PresetStorage, makeId: () => string = () => crypto.randomUUID()): PresetStore {
  async function call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch {
      throw new Error(UNAVAILABLE_MESSAGE)
    }
  }

  const listPresets = async () => {
    const entries = await call(() => storage.list())
    return entries
      .map(({ id, record }) => normalizeCustomPreset(id, record))
      .filter((preset): preset is CustomPreset => preset !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  return {
    listPresets,
    async savePreset(rawName, style) {
      const name = rawName.trim().slice(0, MAX_PRESET_NAME_LENGTH)
      if (!name) throw new Error('Enter a name for the preset.')
      const existing = await listPresets()
      const sameName = existing.find((preset) => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase())
      if (!sameName && existing.length >= MAX_CUSTOM_PRESETS) throw new Error(`You can save up to ${MAX_CUSTOM_PRESETS} presets. Delete one first.`)
      // Saving under an existing name replaces that preset.
      const preset: CustomPreset = { id: sameName?.id ?? makeId(), name, style: normalizeStyle(style) ?? style, updatedAt: Date.now() }
      await call(() => storage.put(preset.id, { name: preset.name, style: preset.style, updatedAt: preset.updatedAt }))
      return preset
    },
    async deletePreset(id) {
      await call(() => storage.delete(id))
    },
  }
}

export function createMemoryPresetStorage(): PresetStorage {
  const records = new Map<string, unknown>()
  return {
    async put(id, record) {
      records.set(id, record)
    },
    async delete(id) {
      records.delete(id)
    },
    async list() {
      return Array.from(records, ([id, record]) => ({ id, record }))
    },
  }
}

const DATABASE_NAME = 'mindskit-karaoke-image-maker'
const DATABASE_VERSION = 1
const STORE_NAME = 'presets'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Runs one transaction and resolves only after it commits, so aborted writes reject. */
async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => T): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const result = run(transaction.objectStore(STORE_NAME))
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Preset storage transaction was aborted.'))
    })
  } finally {
    db.close()
  }
}

export function createIndexedDbPresetStorage(): PresetStorage {
  return {
    async put(id, record) {
      await withStore('readwrite', (store) => store.put(record, id))
    },
    async delete(id) {
      await withStore('readwrite', (store) => store.delete(id))
    },
    async list() {
      const requests = await withStore('readonly', (store) => ({ keys: store.getAllKeys(), values: store.getAll() }))
      const keys = requests.keys.result as string[]
      const values = requests.values.result as unknown[]
      return keys.map((id, index) => ({ id, record: values[index] }))
    },
  }
}

const defaultStore = createPresetStore(createIndexedDbPresetStorage())
export const listCustomPresets = defaultStore.listPresets
export const saveCustomPreset = defaultStore.savePreset
export const deleteCustomPreset = defaultStore.deletePreset
