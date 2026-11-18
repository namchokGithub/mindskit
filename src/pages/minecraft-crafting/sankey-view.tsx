import { sankey, sankeyJustify, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from 'd3-sankey'
import { Download } from 'lucide-react'
import { useMemo, useRef } from 'react'

import { Button } from '@/components/ui/button'
import type { CraftPlan, McItem } from '@/features/minecraft/crafting'
import { buildCraftGraph } from '@/features/minecraft/graph'

import { downloadDataUrl, downloadSvgElement } from './export-image'

type FlowNode = { id: string; label: string; isBase: boolean }
type FlowLink = { source: string; target: string; value: number }

const WIDTH = 1000
// Theme tokens with fallbacks, so an exported SVG (without the app's CSS variables) still has colors.
const PALETTE = ['var(--primary, #7C3AED)', 'var(--brand-secondary, #0EA5E9)', 'var(--success, #16A34A)', 'var(--warning, #D97706)', 'var(--destructive, #DC2626)']

/** Material flow from raw materials (left) to the requested items (right); band width = quantity. */
export function CraftSankeyView({ plan, itemByName }: { plan: CraftPlan; itemByName: Map<string, McItem> }) {
  const svgRef = useRef<SVGSVGElement>(null)

  const layout = useMemo(() => {
    const graph = buildCraftGraph(plan)
    if (graph.edges.length === 0) return null
    const height = Math.max(320, graph.nodes.length * 26)
    const generator = sankey<FlowNode, FlowLink>()
      .nodeId((node) => node.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(12)
      .nodePadding(10)
      .extent([[1, 8], [WIDTH - 1, height - 8]])
    const result = generator({
      nodes: graph.nodes.map((node) => ({ id: node.id, label: itemByName.get(node.id)?.displayName ?? node.id, isBase: node.isBase })),
      links: graph.edges.map((edge) => ({ source: edge.source, target: edge.target, value: edge.quantity })),
    })
    return { ...result, height }
  }, [plan, itemByName])

  if (!layout) return <p className="py-10 text-center text-sm text-muted-foreground">The requested items are base materials, so there is no flow to show.</p>

  const colorFor = (node: SankeyNode<FlowNode, FlowLink>) => PALETTE[(node.depth ?? 0) % PALETTE.length]
  const exportPng = async () => {
    if (!svgRef.current) return
    const { toPng } = await import('html-to-image')
    await downloadDataUrl(await toPng(svgRef.current as unknown as HTMLElement, { backgroundColor: getComputedStyle(document.body).backgroundColor, pixelRatio: 2 }), 'crafting-sankey.png')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Band width shows how many of each ingredient flow into the next item.</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void exportPng()}><Download />PNG</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => svgRef.current && downloadSvgElement(svgRef.current, 'crafting-sankey.svg')}><Download />SVG</Button>
        </div>
      </div>
      <div className="overflow-auto rounded-lg border border-border bg-card p-2">
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${layout.height}`} width={WIDTH} height={layout.height} className="h-auto max-w-full" role="img" aria-label="Material flow diagram">
          <g fill="none">
            {layout.links.map((link: SankeyLink<FlowNode, FlowLink>, index) => (
              <path key={index} d={sankeyLinkHorizontal()(link) ?? undefined} stroke={colorFor(link.source as SankeyNode<FlowNode, FlowLink>)} strokeOpacity={0.35} strokeWidth={Math.max(1, link.width ?? 1)}>
                <title>{`${(link.source as FlowNode).label} → ${(link.target as FlowNode).label}: ${link.value.toLocaleString()}`}</title>
              </path>
            ))}
          </g>
          {layout.nodes.map((node) => (
            <g key={node.id}>
              <rect x={node.x0} y={node.y0} width={(node.x1 ?? 0) - (node.x0 ?? 0)} height={Math.max(1, (node.y1 ?? 0) - (node.y0 ?? 0))} fill={colorFor(node)} rx={2} />
              <text
                x={(node.x0 ?? 0) < WIDTH / 2 ? (node.x1 ?? 0) + 6 : (node.x0 ?? 0) - 6}
                y={((node.y0 ?? 0) + (node.y1 ?? 0)) / 2}
                dy="0.35em"
                textAnchor={(node.x0 ?? 0) < WIDTH / 2 ? 'start' : 'end'}
                fontSize={12}
                fill="currentColor"
                className="text-foreground"
              >
                {node.label} ({(node.value ?? 0).toLocaleString()})
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
