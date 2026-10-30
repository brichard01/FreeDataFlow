import { useEffect, useState } from 'react'
import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { Icon } from '@iconify/react'
import dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'
import '@fontsource-variable/inter'

type Flow = {
  assets: Record<string, { read: unknown; write: unknown }>
  scripts: Record<string, { inputs: string[]; outputs: string[] }>
}

const NODE_WIDTH = 140
const NODE_HEIGHT = 80

const SCRIPT_ICON = 'logos:python'
const ASSET_ICON = 'lucide:database'

type IconNode = Node<{ label: string; icon: string; hasIn: boolean; hasOut: boolean }, 'icon'>

// Icon on top, name below; edges enter on the left and leave on the right (handles only where edges exist).
function IconNodeView({ data }: NodeProps<IconNode>) {
  return (
    <div style={{ width: NODE_WIDTH, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {data.hasIn && <Handle type="target" position={Position.Left} style={{ top: 20 }} />}
      <Icon icon={data.icon} width={40} height={40} />
      <div style={{ fontSize: 12, textAlign: 'center', wordBreak: 'break-word' }}>{data.label}</div>
      {data.hasOut && <Handle type="source" position={Position.Right} style={{ top: 20 }} />}
    </div>
  )
}

const nodeTypes = { icon: IconNodeView }

function toGraph(flow: Flow): { nodes: Node[]; edges: Edge[] } {
  const nodes: IconNode[] = [
    ...Object.keys(flow.assets ?? {}).map((id) => ({
      id: `asset:${id}`,
      type: 'icon' as const,
      data: { label: id, icon: ASSET_ICON, hasIn: false, hasOut: false },
      style: { cursor: 'pointer' },
      position: { x: 0, y: 0 },
    })),
    ...Object.keys(flow.scripts ?? {}).map((path) => ({
      id: `script:${path}`,
      type: 'icon' as const,
      data: { label: path, icon: SCRIPT_ICON, hasIn: false, hasOut: false },
      style: { cursor: 'pointer' },
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

const PANEL_WIDTH = 320

type RunStatus = { state: 'idle' } | { state: 'running' } | { state: 'done' } | { state: 'failed'; message: string }

const RUN_LOOK = {
  idle: { icon: 'lucide:play', color: '#16a34a', text: 'Run file' },
  running: { icon: 'svg-spinners:180-ring', color: '#6b7280', text: 'Running…' },
  done: { icon: 'lucide:check', color: '#16a34a', text: 'Done' },
  failed: { icon: 'lucide:x', color: '#dc2626', text: 'Failed' },
}

// Runs the script through POST /api/run and shows its status; calls onFinished so the graph can reload.
function RunButton({ script, onFinished }: { script: string; onFinished: () => void }) {
  const [status, setStatus] = useState<RunStatus>({ state: 'idle' })
  const look = RUN_LOOK[status.state]

  const runFile = () => {
    setStatus({ state: 'running' })
    fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`POST /api/run failed: ${res.status}`)
        const { returncode } = (await res.json()) as { returncode: number }
        setStatus(returncode === 0 ? { state: 'done' } : { state: 'failed', message: `Exit code ${returncode}` })
      })
      .catch((err: Error) => setStatus({ state: 'failed', message: err.message }))
      .finally(onFinished)
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={runFile}
        disabled={status.state === 'running'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          border: '1px solid #ddd',
          borderRadius: 6,
          background: 'white',
          font: 'inherit',
          cursor: status.state === 'running' ? 'default' : 'pointer',
        }}
      >
        <Icon icon={look.icon} width={18} height={18} color={look.color} />
        {look.text}
      </button>
      {status.state === 'failed' && <p style={{ color: '#dc2626', fontSize: 13 }}>{status.message}</p>}
    </div>
  )
}

// Right side panel, slides in when a node is selected: icon and name on top.
function SidePanel({ node, onClose, onRunFinished }: { node: IconNode | undefined; onClose: () => void; onRunFinished: () => void }) {
  const open = node !== undefined
  return (
    <aside
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        background: 'white',
        borderLeft: '1px solid #ddd',
        boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.08)',
        transform: open ? 'translateX(0)' : `translateX(${PANEL_WIDTH + 20}px)`,
        transition: 'transform 0.2s ease',
        zIndex: 10,
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'none', cursor: 'pointer' }}
      >
        <Icon icon="lucide:x" width={20} height={20} />
      </button>
      {node && (
        <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 16px 16px' }}>
          <Icon icon={node.data.icon} width={56} height={56} />
          <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', wordBreak: 'break-word' }}>{node.data.label}</div>
        </header>
      )}
      {node?.id.startsWith('script:') && (
        <RunButton key={node.id} script={node.data.label} onFinished={onRunFinished} />
      )}
    </aside>
  )
}

export default function App() {
  const [graph, setGraph] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const loadFlow = () =>
    fetch('/api/flow')
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/flow failed: ${res.status}`)
        return res.json()
      })
      .then((flow: Flow) => setGraph(toGraph(flow)))
      .catch((err: Error) => setError(err.message))

  useEffect(() => {
    loadFlow()
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, fontFamily: "'Inter Variable', sans-serif" }}>
      {error && <p style={{ padding: 16 }}>{error}</p>}
      {!error && !graph && <p style={{ padding: 16 }}>Loading…</p>}
      {graph && (
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          fitView
          nodesConnectable={false}
          onNodeClick={(_, node) => setSelected(node.id)}
          onPaneClick={() => setSelected(null)}
        >
          <Background />
          <Controls />
        </ReactFlow>
      )}
      <SidePanel
        node={graph?.nodes.find((n) => n.id === selected) as IconNode | undefined}
        onClose={() => setSelected(null)}
        onRunFinished={loadFlow}
      />
    </div>
  )
}
