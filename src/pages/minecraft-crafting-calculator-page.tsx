import { ChevronDown, ChevronRight, Hammer, Package, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CopyButton } from '@/components/tool/copy-button'
import { ToolPageHeader } from '@/components/tool/tool-page-header'
import { ToolStatus } from '@/components/tool/tool-status'
import { EmptyState, ToolPage, workspaceCardClass } from '@/components/tool/workspace'
import { Button } from '@/components/ui/button'
import { formatMaterialList, formatStacks, isCraftable, planCrafting, type CraftNode, type CraftRequest, type McDataset, type McItem } from '@/features/minecraft/crafting'
import { usePersistedInput } from '@/hooks/use-persisted-input'
import { useSaveLocally } from '@/hooks/use-save-locally'
import { cn } from '@/lib/utils'

const VERSION = '1.21.11'
const DATA_URL = `/data/minecraft/${VERSION}.json`
const MAX_QUANTITY = 1_000_000

const fieldClass = 'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/50'

function parseStoredRequests(value: string): CraftRequest[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is CraftRequest => typeof entry?.name === 'string' && Number.isFinite(entry?.quantity))
  } catch {
    return []
  }
}

function ItemIcon({ item, size = 24 }: { item: McItem | undefined; size?: number }) {
  if (!item?.texture) return <Package aria-hidden="true" className="shrink-0 text-muted-foreground" style={{ width: size, height: size }} />
  return <img src={`/data/minecraft/${VERSION}/textures/${item.texture}`} alt="" width={size} height={size} loading="lazy" className="shrink-0 [image-rendering:pixelated]" />
}

function TreeNode({ node, itemByName, depth }: { node: CraftNode; itemByName: Map<string, McItem>; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const item = itemByName.get(node.name)
  const hasChildren = node.children.length > 0
  return (
    <li>
      <div className="flex items-center gap-2 rounded-md py-1 pr-2 hover:bg-muted/50" style={{ paddingLeft: `${depth * 1.25 + 0.25}rem` }}>
        {hasChildren ? (
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={`${open ? 'Collapse' : 'Expand'} ${item?.displayName ?? node.name}`} className="flex size-5 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : <span className="size-5" />}
        <ItemIcon item={item} size={20} />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-medium tabular-nums">{node.quantity}</span> × {item?.displayName ?? node.name}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {node.isBase ? 'Base material' : node.crafts > 0 ? `${node.crafts} craft${node.crafts === 1 ? '' : 's'} × ${node.perCraft}` : ''}
          {node.fromSurplus > 0 && ` · ${node.fromSurplus} from leftovers`}
        </span>
      </div>
      {hasChildren && open && (
        <ul>{node.children.map((child, index) => <TreeNode key={`${child.name}-${index}`} node={child} itemByName={itemByName} depth={depth + 1} />)}</ul>
      )}
    </li>
  )
}

export function MinecraftCraftingCalculatorPage() {
  const [dataset, setDataset] = useState<McDataset | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'materials' | 'tree'>('materials')
  const { enabled: saveLocally } = useSaveLocally()
  const [storedRequests, setStoredRequests] = usePersistedInput('minecraft-crafting', saveLocally)
  const requests = useMemo(() => parseStoredRequests(storedRequests), [storedRequests])
  const setRequests = (next: CraftRequest[]) => setStoredRequests(next.length ? JSON.stringify(next) : '')

  useEffect(() => {
    let cancelled = false
    fetch(DATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<McDataset>
      })
      .then((data) => {
        if (!cancelled) setDataset(data)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load the Minecraft item data. Reload the page to try again.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const itemByName = useMemo(() => new Map((dataset?.items ?? []).map((item) => [item.name, item])), [dataset])
  const craftableItems = useMemo(() => (dataset ? dataset.items.filter((item) => isCraftable(item.name, dataset)) : []), [dataset])
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []
    return craftableItems.filter((item) => item.displayName.toLowerCase().includes(normalized) || item.name.includes(normalized.replace(/\s+/g, '_'))).slice(0, 12)
  }, [craftableItems, query])

  const plan = useMemo(() => (dataset && requests.length ? planCrafting(requests, dataset) : null), [dataset, requests])
  const displayName = (name: string) => itemByName.get(name)?.displayName ?? name

  const addItem = (name: string) => {
    const existing = requests.find((request) => request.name === name)
    setRequests(existing ? requests.map((request) => (request.name === name ? { ...request, quantity: Math.min(MAX_QUANTITY, request.quantity + 1) } : request)) : [...requests, { name, quantity: 1 }])
    setQuery('')
  }
  const updateQuantity = (name: string, value: string) => {
    const quantity = Math.min(MAX_QUANTITY, Math.max(0, Math.floor(Number(value) || 0)))
    setRequests(requests.map((request) => (request.name === name ? { ...request, quantity } : request)))
  }
  const removeItem = (name: string) => setRequests(requests.filter((request) => request.name !== name))

  return (
    <ToolPage>
      <ToolPageHeader title="Minecraft Crafting Calculator" description={`Pick items and amounts to get every raw material and crafting step (Java Edition ${VERSION} crafting-table recipes).`} />

      {loadError && <ToolStatus state="invalid" message={loadError} />}

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className={cn('flex min-w-0 flex-col gap-3 p-4', workspaceCardClass)}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Items to craft</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRequests([])} disabled={requests.length === 0}><RotateCcw />Reset</Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={dataset ? 'Search items, e.g. torch, piston, beacon…' : 'Loading items…'} disabled={!dataset} aria-label="Search craftable items" className={cn(fieldClass, 'pl-8')} />
            {searchResults.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                {searchResults.map((item) => (
                  <li key={item.name}>
                    <button type="button" onClick={() => addItem(item.name)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none">
                      <ItemIcon item={item} />
                      <span className="truncate">{item.displayName}</span>
                    </button>
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
                    <span className="min-w-0 flex-1 truncate text-sm">{item?.displayName ?? request.name}</span>
                    <input type="number" min={0} max={MAX_QUANTITY} value={request.quantity} onChange={(event) => updateQuantity(request.name, event.target.value)} aria-label={`Amount of ${item?.displayName ?? request.name}`} className={cn(fieldClass, 'w-24 text-right tabular-nums')} />
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeItem(request.name)} aria-label={`Remove ${item?.displayName ?? request.name}`}><Trash2 /></Button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Items without a crafting-table recipe (logs, ores, ingots from smelting, mob drops) count as base materials. Wood and stone variants default to oak and cobblestone.</p>
        </section>

        <section className={cn('flex min-w-0 flex-col gap-3 p-4', workspaceCardClass)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="Result view" className="flex gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
              {(['materials', 'tree'] as const).map((id) => (
                <Button key={id} type="button" role="tab" size="xs" variant={view === id ? 'secondary' : 'ghost'} aria-selected={view === id} onClick={() => setView(id)}>
                  {id === 'materials' ? 'Material list' : 'Crafting tree'}
                </Button>
              ))}
            </div>
            <CopyButton value={plan ? formatMaterialList(plan, displayName) : ''} />
          </div>

          {!plan ? (
            <EmptyState icon={Package} title="Nothing to calculate yet" hint="Add at least one item with an amount above 0." />
          ) : view === 'materials' ? (
            <div className="flex flex-col gap-3 animate-in fade-in duration-200 motion-reduce:animate-none">
              <ul className="divide-y divide-border rounded-lg border border-border">
                {plan.materials.map((material) => {
                  const item = itemByName.get(material.name)
                  const stacks = formatStacks(material.quantity, item?.stackSize ?? 64)
                  return (
                    <li key={material.name} className="flex items-center gap-2 px-3 py-2">
                      <ItemIcon item={item} />
                      <span className="min-w-0 flex-1 truncate text-sm">{displayName(material.name)}</span>
                      <span className="text-sm font-medium tabular-nums">{material.quantity.toLocaleString()}</span>
                      {stacks && <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">{stacks}</span>}
                    </li>
                  )
                })}
              </ul>
              {plan.steps.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Crafts needed</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {plan.steps.map((step) => (
                      <li key={step.name} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs">
                        <ItemIcon item={itemByName.get(step.name)} size={16} />
                        {displayName(step.name)} <span className="text-muted-foreground tabular-nums">× {step.crafts} → {step.produced}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.leftovers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Left over after crafting: {plan.leftovers.map((leftover) => `${leftover.quantity} ${displayName(leftover.name)}`).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <ul className="animate-in fade-in duration-200 motion-reduce:animate-none">
              {plan.tree.map((node) => <TreeNode key={node.name} node={node} itemByName={itemByName} depth={0} />)}
            </ul>
          )}
        </section>
      </div>
    </ToolPage>
  )
}
