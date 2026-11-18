import { Background, Controls, Handle, MiniMap, Position, ReactFlow, getNodesBounds, getViewportForBounds, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Download, Minus, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import type { CraftPlan, McItem } from '@/features/minecraft/crafting'
import { buildCraftGraph, connectedItems } from '@/features/minecraft/graph'
import { cn } from '@/lib/utils'

import { downloadDataUrl } from './export-image'

type ItemNodeData = {
  label: string
  quantity: number
  crafts: number
  isBase: boolean
  texture: string | null
  collapsed: boolean
  hasIngredients: boolean
  dimmed: boolean
  onToggle: () => void
}

const COLUMN_WIDTH = 260
const ROW_HEIGHT = 76
const NODE_WIDTH = 210

function ItemNode({ data }: NodeProps<Node<ItemNodeData>>) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-card-foreground shadow-sm transition-opacity duration-200', data.isBase ? 'border-dashed border-border' : 'border-border', data.dimmed && 'opacity-30')} style={{ width: NODE_WIDTH }}>
      <Handle type="target" position={Position.Left} className="size-2! border-0! bg-muted-foreground!" />
      {data.texture ? <img src={`/data/minecraft/textures/${data.texture}`} alt="" width={24} height={24} className="shrink-0 [image-rendering:pixelated]" /> : <span className="size-6 shrink-0 rounded bg-muted" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{data.label}</p>
        <p className="text-[11px] text-muted-foreground tabular-nums">{data.quantity.toLocaleString()}{data.isBase ? ' · base' : data.crafts ? ` · ${data.crafts} crafts` : ''}</p>
      </div>
      {data.hasIngredients && (
        <button type="button" onClick={(event) => { event.stopPropagation(); data.onToggle() }} aria-label={data.collapsed ? `Expand ${data.label}` : `Collapse ${data.label}`} className="nodrag flex size-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
          {data.collapsed ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
        </button>
      )}
      <Handle type="source" position={Position.Right} className="size-2! border-0! bg-primary!" />
    </div>
  )
}

const nodeTypes = { item: ItemNode }

/** Interactive dependency graph: raw materials on the left, requested items on the right. */
export function CraftGraphView({ plan, itemByName, isDark }: { plan: CraftPlan; itemByName: Map<string, McItem>; isDark: boolean }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [highlight, setHighlight] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const graph = useMemo(() => buildCraftGraph(plan, collapsed), [plan, collapsed])
  const highlighted = useMemo(() => (highlight && graph.nodes.some((node) => node.id === highlight) ? connectedItems(graph, highlight) : null), [graph, highlight])

  const { nodes, edges } = useMemo(() => {
    const maxDepth = Math.max(0, ...graph.nodes.map((node) => node.depth))
    const rowsPerColumn = new Map<number, number>()
    const toggle = (id: string) => setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    const flowNodes: Node<ItemNodeData>[] = graph.nodes.map((node) => {
      const column = maxDepth - node.depth
      const row = rowsPerColumn.get(column) ?? 0
      rowsPerColumn.set(column, row + 1)
      const item = itemByName.get(node.id)
      return {
        id: node.id,
        type: 'item',
        position: { x: column * COLUMN_WIDTH, y: row * ROW_HEIGHT },
        data: { label: item?.displayName ?? node.id, quantity: node.quantity, crafts: node.crafts, isBase: node.isBase, texture: item?.texture ?? null, collapsed: node.collapsed, hasIngredients: node.hasIngredients, dimmed: highlighted !== null && !highlighted.has(node.id), onToggle: () => toggle(node.id) },
      }
    })
    const flowEdges: Edge[] = graph.edges.map((edge) => {
      const active = highlighted !== null && highlighted.has(edge.source) && highlighted.has(edge.target)
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.quantity.toLocaleString(),
        animated: active,
        style: { stroke: active ? 'var(--primary)' : 'var(--muted-foreground)', strokeWidth: active ? 2 : 1, opacity: highlighted && !active ? 0.25 : 1 },
        labelStyle: { fill: 'var(--foreground)', fontSize: 11 },
        labelBgStyle: { fill: 'var(--card)' },
      }
    })
    return { nodes: flowNodes, edges: flowEdges }
  }, [graph, highlighted, itemByName])

  const exportImage = async (format: 'png' | 'svg') => {
    const viewport = wrapperRef.current?.querySelector<HTMLElement>('.react-flow__viewport')
    if (!viewport) return
    const width = 1600
    const height = 1000
    const bounds = getNodesBounds(nodes)
    const transform = getViewportForBounds(bounds, width, height, 0.2, 2, 0.1)
    const { toPng, toSvg } = await import('html-to-image')
    const options = {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      width,
      height,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})` },
    }
    const dataUrl = format === 'png' ? await toPng(viewport, options) : await toSvg(viewport, options)
    await downloadDataUrl(dataUrl, `crafting-graph.${format}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Click an item to highlight its path · use − / + to collapse or expand ingredients · scroll to zoom, drag to pan</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void exportImage('png')}><Download />PNG</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void exportImage('svg')}><Download />SVG</Button>
        </div>
      </div>
      <div ref={wrapperRef} className="h-[60vh] min-h-96 overflow-hidden rounded-lg border border-border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode={isDark ? 'dark' : 'light'}
          fitView
          minZoom={0.1}
          nodesConnectable={false}
          onNodeClick={(_, node) => setHighlight((current) => (current === node.id ? null : node.id))}
          onPaneClick={() => setHighlight(null)}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  )
}
