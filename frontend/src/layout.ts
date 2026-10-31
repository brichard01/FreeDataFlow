import type { Edge, Node } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import type { Flow } from './api'
import { IconNodeView, type IconNode } from './IconNode'

const NODE_WIDTH = 140 // keep in sync with .node in styles.css
const NODE_HEIGHT = 80

const SCRIPT_ICON = 'logos:python'
const ASSET_ICON = 'lucide:database'

export const nodeTypes = { icon: IconNodeView }

export function toGraph(flow: Flow): { nodes: Node[]; edges: Edge[] } {
  const nodes: IconNode[] = [
    ...Object.keys(flow.assets ?? {}).map((id) => ({
      id: `asset:${id}`,
      type: 'icon' as const,
      data: { label: id, icon: ASSET_ICON, hasIn: false, hasOut: false },
      position: { x: 0, y: 0 },
    })),
    ...Object.keys(flow.scripts ?? {}).map((path) => ({
      id: `script:${path}`,
      type: 'icon' as const,
      data: { label: path, icon: SCRIPT_ICON, hasIn: false, hasOut: false },
      position: { x: 0, y: 0 },
    })),
  ]

  const edges: Edge[] = Object.entries(flow.scripts ?? {}).flatMap(([path, script]) => [
    ...script.inputs.map((id) => ({ id: `in:${id}->${path}`, source: `asset:${id}`, target: `script:${path}` })),
    ...script.outputs.map((id) => ({ id: `out:${path}->${id}`, source: `script:${path}`, target: `asset:${id}` })),
  ])

  const sources = new Set(edges.map((e) => e.source))
  const targets = new Set(edges.map((e) => e.target))
  for (const n of nodes) {
    n.data.hasIn = targets.has(n.id)
    n.data.hasOut = sources.has(n.id)
  }

  // dagre computes node positions, left to right
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 60 })
  g.setDefaultEdgeLabel(() => ({}))
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  // Heavier output edges keep each asset right next to the script that writes it
  edges.forEach((e) => g.setEdge(e.source, e.target, { weight: e.source.startsWith('script:') ? 2 : 1 }))
  dagre.layout(g)

  for (const n of nodes) {
    const { x, y } = g.node(n.id)
    n.position = { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 }
  }
  return { nodes, edges }
}
