import { Backpack, ChevronDown, ChevronRight, Hammer, Package, RotateCcw, Search, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { EmptyState, ToolPage, workspaceCardClass } from '@/components/tool/workspace'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  RECIPE_TYPE_LABELS,
  createIndex,
  formatMaterialList,
  formatStacks,
  isCraftable,
  planCrafting,
  usableRecipes,
  type CraftNode,
  type CraftRequest,
  type McDataset,
  type McItem,
} from '@/features/minecraft/crafting'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'
import { cn } from '@/lib/utils'

const CraftGraphView = lazy(() => import('@/pages/minecraft-crafting/graph-view').then((module) => ({ default: module.CraftGraphView })))
const CraftSankeyView = lazy(() => import('@/pages/minecraft-crafting/sankey-view').then((module) => ({ default: module.CraftSankeyView })))

const VERSIONS = ['1.21.11', '1.20.6'] as const
type Version = (typeof VERSIONS)[number]
const MAX_QUANTITY = 1_000_000
type View = 'materials' | 'tree' | 'graph' | 'sankey'
const VIEWS: { id: View; label: string }[] = [
  { id: 'materials', label: 'Material list' },
  { id: 'tree', label: 'Crafting tree' },
  { id: 'graph', label: 'Graph' },
  { id: 'sankey', label: 'Flow' },
]

interface CalculatorState {
  version: Version
  requests: CraftRequest[]
  recipeChoices: Record<string, string>
  ingredientChoices: Record<string, string>
  inventory: Record<string, number>
}

const EMPTY_STATE: CalculatorState = { version: '1.21.11', requests: [], recipeChoices: {}, ingredientChoices: {}, inventory: {} }

const fieldClass = 'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'

function parseState(value: string): CalculatorState {
  try {
    const parsed = JSON.parse(value) as Partial<CalculatorState>
    const isRecord = (input: unknown): input is Record<string, unknown> => typeof input === 'object' && input !== null && !Array.isArray(input)
    return {
      version: VERSIONS.includes(parsed.version as Version) ? (parsed.version as Version) : EMPTY_STATE.version,
      requests: Array.isArray(parsed.requests) ? parsed.requests.filter((entry) => typeof entry?.name === 'string' && Number.isFinite(entry?.quantity)) : [],
      recipeChoices: isRecord(parsed.recipeChoices) ? (parsed.recipeChoices as Record<string, string>) : {},
      ingredientChoices: isRecord(parsed.ingredientChoices) ? (parsed.ingredientChoices as Record<string, string>) : {},
      inventory: isRecord(parsed.inventory) ? (parsed.inventory as Record<string, number>) : {},
    }
  } catch {
    return EMPTY_STATE
  }
}

function ItemIcon({ item, size = 24 }: { item: McItem | undefined; size?: number }) {
  if (!item?.texture) return <Package aria-hidden="true" className="shrink-0 text-muted-foreground" style={{ width: size, height: size }} />
  return <img src={`/data/minecraft/textures/${item.texture}`} alt="" width={size} height={size} loading="lazy" className="shrink-0 [image-rendering:pixelated]" />
}

function useIsDarkTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return dark
}

function TreeNode({ node, itemByName, depth }: { node: CraftNode; itemByName: Map<string, McItem>; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const item = itemByName.get(node.name)
  const hasChildren = node.children.length > 0
  const notes = [
    node.isBase ? 'Base material' : node.crafts > 0 && node.recipeType ? `${RECIPE_TYPE_LABELS[node.recipeType]} · ${node.crafts} × ${node.perCraft}` : '',
    node.fromInventory > 0 ? `${node.fromInventory} owned` : '',
    node.fromSurplus > 0 ? `${node.fromSurplus} from leftovers` : '',
  ].filter(Boolean)
  return (
    <li>
      <div className="flex items-center gap-2 rounded-md py-1 pr-2 hover:bg-muted/50" style={{ paddingLeft: `${depth * 1.25 + 0.25}rem` }}>
        {hasChildren ? (
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${item?.displayName ?? node.name}`} className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : <span className="size-5" />}
        <ItemIcon item={item} size={20} />
        <span className="min-w-0 flex-1 truncate text-sm"><span className="font-medium tabular-nums">{node.quantity}</span> × {item?.displayName ?? node.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{notes.join(' · ')}</span>
      </div>
      {hasChildren && open && <ul>{node.children.map((child, index) => <TreeNode key={`${child.name}-${index}`} node={child} itemByName={itemByName} depth={depth + 1} />)}</ul>}
    </li>
  )
}

export function MinecraftCraftingCalculatorPage() {
  const { enabled: saveLocally } = useSaveLocally()
  const [stored, setStored] = usePersistedInput('minecraft-crafting', saveLocally)
  const state = useMemo(() => (stored ? parseState(stored) : EMPTY_STATE), [stored])
  const update = (patch: Partial<CalculatorState>) => {
    const next = { ...state, ...patch }
    const isEmpty = next.requests.length === 0 && Object.keys(next.inventory).length === 0 && Object.keys(next.recipeChoices).length === 0 && Object.keys(next.ingredientChoices).length === 0 && next.version === EMPTY_STATE.version
    setStored(isEmpty ? '' : JSON.stringify(next))
  }

  const [datasets, setDatasets] = useState<Partial<Record<Version, McDataset>>>({})
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [inventoryQuery, setInventoryQuery] = useState('')
  const [view, setView] = useState<View>('materials')
  const isDark = useIsDarkTheme()
  const dataset = datasets[state.version]

  useEffect(() => {
    if (datasets[state.version]) return
    let cancelled = false
    setLoadError('')
    fetch(`/data/minecraft/${state.version}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<McDataset>
      })
      .then((data) => {
        if (!cancelled) setDatasets((current) => ({ ...current, [state.version]: data }))
      })
      .catch(() => {
        if (!cancelled) setLoadError(`Could not load Minecraft ${state.version} data. Reload the page to try again.`)
      })
    return () => {
      cancelled = true
    }
  }, [datasets, state.version])

  const index = useMemo(() => (dataset ? createIndex(dataset) : null), [dataset])
  const itemByName = useMemo(() => new Map((dataset?.items ?? []).map((item) => [item.name, item])), [dataset])
  const craftableItems = useMemo(() => (index ? index.dataset.items.filter((item) => isCraftable(item.name, index)) : []), [index])
  const searchItems = (list: McItem[], text: string) => {
    const normalized = text.trim().toLowerCase()
    if (!normalized) return []
    return list.filter((item) => item.displayName.toLowerCase().includes(normalized) || item.name.includes(normalized.replace(/\s+/g, '_'))).slice(0, 12)
  }
  const searchResults = useMemo(() => searchItems(craftableItems, query), [craftableItems, query])
  const inventoryResults = useMemo(() => searchItems(dataset?.items ?? [], inventoryQuery), [dataset, inventoryQuery])

  const requests = useMemo(() => state.requests.filter((request) => itemByName.has(request.name)), [state.requests, itemByName])
  const plan = useMemo(() => (index && requests.length ? planCrafting(requests, index, state) : null), [index, requests, state])
  const displayName = (name: string) => itemByName.get(name)?.displayName ?? name

  const addItem = (name: string) => {
    const existing = state.requests.find((request) => request.name === name)
    update({ requests: existing ? state.requests.map((request) => (request.name === name ? { ...request, quantity: Math.min(MAX_QUANTITY, request.quantity + 1) } : request)) : [...state.requests, { name, quantity: 1 }] })
    setQuery('')
  }
  const toQuantity = (value: string) => Math.min(MAX_QUANTITY, Math.max(0, Math.floor(Number(value) || 0)))
  const setInventory = (name: string, quantity: number) => {
    const inventory = { ...state.inventory }
    if (quantity > 0) inventory[name] = quantity
    else delete inventory[name]
    update({ inventory })
  }

  return (
    <ToolPage>
      <ToolPageHeader title="Minecraft Crafting Calculator" description="Pick items and amounts to get every raw material, crafting step, and a crafting graph (Java Edition recipes, including furnace, stonecutter, and smithing)." />

      {loadError && <ToolStatus state="invalid" message={loadError} />}

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className={cn('flex min-w-0 flex-col gap-3 p-4', workspaceCardClass)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Items to craft</h2>
              <div className="flex items-center gap-2">
                <Select value={state.version} onValueChange={(value) => update({ version: value as Version, recipeChoices: {}, ingredientChoices: {} })}>
                  <SelectTrigger size="sm" className="w-32" aria-label="Minecraft version"><SelectValue /></SelectTrigger>
                  <SelectContent>{VERSIONS.map((version) => <SelectItem key={version} value={version}>Java {version}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={() => update(EMPTY_STATE)} disabled={stored === ''}><RotateCcw />Reset</Button>
              </div>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={dataset ? 'Search items, e.g. torch, piston, beacon…' : 'Loading items…'} disabled={!dataset} aria-label="Search craftable items" className={cn(fieldClass, 'pl-8')} />
              {searchResults.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                  {searchResults.map((item) => (
                    <li key={item.name}>
                      <button type="button" onClick={() => addItem(item.name)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"><ItemIcon item={item} /><span className="truncate">{item.displayName}</span></button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim() && dataset && searchResults.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No craftable item matches “{query.trim()}”.</p>}
            </div>
            {requests.length === 0 ? (
              <EmptyState icon={Hammer} title="No items yet" hint="Search for an item above to add it. You can add several items and set an amount for each." />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {requests.map((request) => {
                  const item = itemByName.get(request.name)
                  return (
                    <li key={request.name} className="flex items-center gap-2 px-2 py-1.5">
                      <ItemIcon item={item} />
                      <span className="min-w-0 flex-1 truncate text-sm">{displayName(request.name)}</span>
                      <input type="number" min={0} max={MAX_QUANTITY} value={request.quantity} onChange={(event) => update({ requests: state.requests.map((entry) => (entry.name === request.name ? { ...entry, quantity: toQuantity(event.target.value) } : entry)) })} aria-label={`Amount of ${displayName(request.name)}`} className={cn(fieldClass, 'w-24 text-right tabular-nums')} />
                      {item && <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground sm:block">{formatStacks(request.quantity, item.stackSize)}</span>}
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => update({ requests: state.requests.filter((entry) => entry.name !== request.name) })} aria-label={`Remove ${displayName(request.name)}`}><Trash2 /></Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {plan && index && (plan.steps.some((step) => usableRecipes(step.name, index).length > 1) || plan.alternatives.length > 0) && (
            <section className={cn('flex min-w-0 flex-col gap-3 p-4', workspaceCardClass)}>
              <h2 className="text-sm font-medium">Recipes and ingredients</h2>
              {plan.steps.filter((step) => usableRecipes(step.name, index).length > 1).map((step) => {
                const recipes = usableRecipes(step.name, index)
                const current = state.recipeChoices[step.name] && recipes.some((recipe) => recipe.id === state.recipeChoices[step.name]) ? state.recipeChoices[step.name] : recipes[0].id
                return (
                  <label key={step.name} className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><ItemIcon item={itemByName.get(step.name)} size={16} />{displayName(step.name)}</span>
                    <Select value={current} onValueChange={(value) => update({ recipeChoices: { ...state.recipeChoices, [step.name]: value } })}>
                      <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {recipes.map((recipe) => (
                          <SelectItem key={recipe.id} value={recipe.id}>
                            {RECIPE_TYPE_LABELS[recipe.type]}: {recipe.ingredients.map((ingredient) => `${ingredient.quantity} ${ingredient.options.map((option) => (option.startsWith('#') ? `any ${option.slice(1).replace(/_/g, ' ')}` : displayName(option))).join(' / ')}`).join(' + ')} → {recipe.count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                )
              })}
              {plan.alternatives.map((alternative) => (
                <label key={alternative.key} className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>Use for “{alternative.key.split('|').map((option) => (option.startsWith('#') ? `any ${option.slice(1).replace(/_/g, ' ')}` : displayName(option))).join(' / ')}”</span>
                  <Select value={alternative.chosen} onValueChange={(value) => update({ ingredientChoices: { ...state.ingredientChoices, [alternative.key]: value } })}>
                    <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{alternative.options.map((option) => <SelectItem key={option} value={option}>{displayName(option)}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              ))}
            </section>
          )}

          <section className={cn('flex min-w-0 flex-col gap-3 p-4', workspaceCardClass)}>
            <h2 className="flex items-center gap-1.5 text-sm font-medium"><Backpack className="size-4" />Inventory (already owned)</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
              <input value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} placeholder="Add an item you already have…" disabled={!dataset} aria-label="Search inventory items" className={cn(fieldClass, 'pl-8')} />
              {inventoryResults.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                  {inventoryResults.map((item) => (
                    <li key={item.name}>
                      <button type="button" onClick={() => { setInventory(item.name, (state.inventory[item.name] ?? 0) + item.stackSize); setInventoryQuery('') }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"><ItemIcon item={item} /><span className="truncate">{item.displayName}</span></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {Object.keys(state.inventory).length === 0 ? (
              <p className="text-xs text-muted-foreground">Owned items are used before anything is crafted or gathered.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {Object.entries(state.inventory).map(([name, quantity]) => (
                  <li key={name} className="flex items-center gap-2 px-2 py-1.5">
                    <ItemIcon item={itemByName.get(name)} size={20} />
                    <span className="min-w-0 flex-1 truncate text-sm">{displayName(name)}</span>
                    <input type="number" min={0} max={MAX_QUANTITY} value={quantity} onChange={(event) => setInventory(name, toQuantity(event.target.value))} aria-label={`Owned ${displayName(name)}`} className={cn(fieldClass, 'w-24 text-right tabular-nums')} />
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => setInventory(name, 0)} aria-label={`Remove ${displayName(name)} from inventory`}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className={cn('flex min-w-0 flex-col gap-3 p-4', workspaceCardClass)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Result view" className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
              {VIEWS.map((entry) => (
                <Button key={entry.id} type="button" role="tab" size="xs" variant={view === entry.id ? 'secondary' : 'ghost'} aria-selected={view === entry.id} onClick={() => setView(entry.id)}>{entry.label}</Button>
              ))}
            </div>
            <CopyButton value={plan ? formatMaterialList(plan, displayName) : ''} />
          </div>

          {!plan ? (
            <EmptyState icon={Package} title="Nothing to calculate yet" hint="Add at least one item with an amount above 0." />
          ) : view === 'materials' ? (
            <div className="flex flex-col gap-3 animate-in fade-in duration-200 motion-reduce:animate-none">
              {plan.materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">Everything is covered by your inventory.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {plan.materials.map((material) => {
                    const item = itemByName.get(material.name)
                    return (
                      <li key={material.name} className="flex items-center gap-2 px-3 py-2">
                        <ItemIcon item={item} />
                        <span className="min-w-0 flex-1 truncate text-sm">{displayName(material.name)}</span>
                        <span className="text-sm font-medium tabular-nums">{material.quantity.toLocaleString()}</span>
                        <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">{formatStacks(material.quantity, item?.stackSize ?? 64)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {plan.steps.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Crafts needed</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {plan.steps.map((step) => (
                      <li key={step.name} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs" title={RECIPE_TYPE_LABELS[step.recipeType]}>
                        <ItemIcon item={itemByName.get(step.name)} size={16} />
                        {displayName(step.name)} <span className="text-muted-foreground tabular-nums">× {step.crafts} → {step.produced}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.usedInventory.length > 0 && <p className="text-xs text-muted-foreground">Used from inventory: {plan.usedInventory.map((entry) => `${entry.quantity} ${displayName(entry.name)}`).join(', ')}</p>}
              {plan.leftovers.length > 0 && <p className="text-xs text-muted-foreground">Left over after crafting: {plan.leftovers.map((entry) => `${entry.quantity} ${displayName(entry.name)}`).join(', ')}</p>}
              <p className="text-xs text-muted-foreground">Furnace, smoker, and campfire fuel is not included.</p>
            </div>
          ) : view === 'tree' ? (
            <ul className="animate-in fade-in duration-200 motion-reduce:animate-none">{plan.tree.map((node) => <TreeNode key={node.name} node={node} itemByName={itemByName} depth={0} />)}</ul>
          ) : (
            <Suspense fallback={<p className="py-10 text-center text-sm text-muted-foreground">Loading view…</p>}>
              {view === 'graph' ? <CraftGraphView plan={plan} itemByName={itemByName} isDark={isDark} /> : <CraftSankeyView plan={plan} itemByName={itemByName} />}
            </Suspense>
          )}
        </section>
      </div>
    </ToolPage>
  )
}
