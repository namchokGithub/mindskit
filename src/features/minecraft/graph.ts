import type { CraftNode, CraftPlan } from './crafting.ts'

export interface CraftGraphNode {
  id: string
  /** Total quantity needed across the plan (after inventory and leftovers are applied per branch). */
  quantity: number
  crafts: number
  isBase: boolean
  /** Longest distance from a requested item (0 = requested). */
  depth: number
  /** Whether this node has ingredients that are hidden because it is collapsed. */
  collapsed: boolean
  hasIngredients: boolean
}

export interface CraftGraphEdge {
  id: string
  /** Ingredient item. */
  source: string
  /** Item it is crafted into. */
  target: string
  quantity: number
}

export interface CraftGraph {
  nodes: CraftGraphNode[]
  edges: CraftGraphEdge[]
}

/**
 * Turns a crafting plan into an item graph: one node per item (quantities summed over every branch) and one edge per
 * ingredient → product pair. Ingredients of `collapsed` items are left out unless another branch still needs them.
 */
export function buildCraftGraph(plan: CraftPlan, collapsed: ReadonlySet<string> = new Set()): CraftGraph {
  const nodes = new Map<string, CraftGraphNode>()
  const edges = new Map<string, CraftGraphEdge>()

  const visit = (node: CraftNode, depth: number) => {
    const existing = nodes.get(node.name)
    const isCollapsed = collapsed.has(node.name)
    nodes.set(node.name, {
      id: node.name,
      quantity: (existing?.quantity ?? 0) + node.quantity,
      crafts: (existing?.crafts ?? 0) + node.crafts,
      isBase: node.isBase,
      depth: Math.max(existing?.depth ?? 0, depth),
      collapsed: isCollapsed && node.children.length > 0,
      hasIngredients: (existing?.hasIngredients ?? false) || node.children.length > 0,
    })
    if (isCollapsed) return
    for (const child of node.children) {
      const id = `${child.name}->${node.name}`
      edges.set(id, { id, source: child.name, target: node.name, quantity: (edges.get(id)?.quantity ?? 0) + child.quantity })
      visit(child, depth + 1)
    }
  }
  for (const root of plan.tree) visit(root, 0)
  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}

/** Items connected to `id` in either direction (its ingredients chain and the products it feeds), for highlighting. */
export function connectedItems(graph: CraftGraph, id: string): Set<string> {
  const result = new Set([id])
  const walk = (current: string, direction: 'up' | 'down') => {
    for (const edge of graph.edges) {
      const next = direction === 'up' ? (edge.target === current ? edge.source : null) : edge.source === current ? edge.target : null
      if (next && !result.has(next)) {
        result.add(next)
        walk(next, direction)
      }
    }
  }
  walk(id, 'up')
  walk(id, 'down')
  return result
}
