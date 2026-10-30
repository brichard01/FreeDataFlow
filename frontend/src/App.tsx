import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

type IconNode = Node<{ label: string; icon: string; hasIn: boolean; hasOut: boolean; order?: number }, 'icon'>

// Icon on top, name below; edges enter on the left and leave on the right (handles only where edges exist).
// `order` shows the script's position in the pipeline being built, as a badge on the icon.
function IconNodeView({ data }: NodeProps<IconNode>) {
  return (
    <div style={{ width: NODE_WIDTH, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {data.hasIn && <Handle type="target" position={Position.Left} style={{ top: 20 }} />}
      <div style={{ position: 'relative' }}>
        <Icon icon={data.icon} width={40} height={40} />
        {data.order !== undefined && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -10,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: 'black',
              color: 'white',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {data.order}
          </span>
        )}
      </div>
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

// Runs a script through POST /api/run and resolves to its final status (never rejects).
async function runScript(script: string): Promise<RunStatus> {
  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script }),
    })
    if (!res.ok) throw new Error(`POST /api/run failed: ${res.status}`)
    const { returncode } = (await res.json()) as { returncode: number }
    return returncode === 0 ? { state: 'done' } : { state: 'failed', message: `Exit code ${returncode}` }
  } catch (err) {
    return { state: 'failed', message: (err as Error).message }
  }
}

// Runs one script and shows its status; calls onFinished so the graph can reload.
function RunButton({ script, onFinished }: { script: string; onFinished: () => void }) {
  const [status, setStatus] = useState<RunStatus>({ state: 'idle' })
  const look = RUN_LOOK[status.state]

  const runFile = async () => {
    setStatus({ state: 'running' })
    setStatus(await runScript(script))
    onFinished()
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

// Right side panel, slides in when open.
function SidePanel({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
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
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ position: 'absolute', top: 8, right: 8, border: 'none', background: 'none', cursor: 'pointer' }}
      >
        <Icon icon="lucide:x" width={20} height={20} />
      </button>
      {children}
    </aside>
  )
}

// Panel content for a clicked node: icon and name on top, Run file for scripts.
function NodeDetails({ node, onRunFinished }: { node: IconNode; onRunFinished: () => void }) {
  return (
    <>
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 16px 16px' }}>
        <Icon icon={node.data.icon} width={56} height={56} />
        <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', wordBreak: 'break-word' }}>{node.data.label}</div>
      </header>
      {node.id.startsWith('script:') && <RunButton key={node.id} script={node.data.label} onFinished={onRunFinished} />}
    </>
  )
}

const barButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  border: 'none',
  background: 'none',
  font: 'inherit',
  color: 'white',
  cursor: 'pointer',
}

const PIPELINE_NAME = /^[a-z0-9_]+$/

// Centered dialog to name and save a pipeline (POST /api/pipelines).
// Prefilled with the opened pipeline's name. An existing name is only replaced if Overwrite is checked.
// Rendered in document.body: the sliding panel's transform would otherwise trap position: fixed.
function SaveDialog({
  initialName,
  scripts,
  onClose,
  onSaved,
}: {
  initialName: string | null
  scripts: string[]
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const [name, setName] = useState(initialName ?? '')
  const [overwrite, setOverwrite] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = PIPELINE_NAME.test(name)

  const save = async () => {
    if (!valid) return
    try {
      const res = await fetch('/api/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scripts, overwrite }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { detail?: string }).detail ?? `Save failed: ${res.status}`)
      onSaved(name)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        fontFamily: "'Inter Variable', sans-serif",
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        style={{ width: 360, background: 'white', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>Save pipeline</div>
        <input
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          placeholder="pipeline_name"
          style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, font: 'inherit' }}
        />
        {name !== '' && !valid && (
          <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>Only lowercase letters, digits and _ are allowed.</p>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => {
              setOverwrite(e.target.checked)
              setError(null)
            }}
          />
          Overwrite
        </label>
        {error && <p style={{ margin: 0, fontSize: 13, color: '#dc2626' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6, background: 'white', font: 'inherit', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            style={{
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: valid ? 'black' : '#9ca3af',
              color: 'white',
              font: 'inherit',
              fontWeight: 600,
              cursor: valid ? 'pointer' : 'default',
            }}
          >
            Save
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

// Panel content while building a pipeline: numbered scripts, then Run at the bottom
// which runs them one after another and stops at the first failure.
function PipelinePanel({
  name,
  scripts,
  onReorder,
  onFinished,
  onSaved,
}: {
  name: string | null
  scripts: string[]
  onReorder: (scripts: string[]) => void
  onFinished: () => void
  onSaved: (name: string) => void
}) {
  // Index of the row being dragged; rows swap live as it moves over them.
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [statuses, setStatuses] = useState<Record<string, RunStatus>>({})
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAs, setSavedAs] = useState<string | null>(null)

  const runAll = async () => {
    setRunning(true)
    setStatuses({})
    for (const script of scripts) {
      setStatuses((s) => ({ ...s, [script]: { state: 'running' } }))
      const status = await runScript(script)
      setStatuses((s) => ({ ...s, [script]: status }))
      if (status.state === 'failed') break
    }
    setRunning(false)
    onFinished()
  }

  return (
    <>
      <header style={{ padding: '32px 16px 16px', fontSize: 16, fontWeight: 600 }}>{name ?? 'New Pipeline'}</header>
      <ol style={{ flex: 1, overflowY: 'auto', margin: 0, padding: '0 16px', listStyle: 'none' }}>
        {scripts.map((script, i) => {
          const status = statuses[script]
          return (
            <li
              key={script}
              draggable={!running}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', script) // Firefox needs data to start a drag
                setDragIndex(i)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragIndex === null || dragIndex === i) return
                const next = [...scripts]
                next.splice(i, 0, next.splice(dragIndex, 1)[0])
                onReorder(next)
                setDragIndex(i)
              }}
              onDragEnd={() => setDragIndex(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                fontSize: 14,
                cursor: running ? 'default' : 'grab',
                opacity: dragIndex === i ? 0.4 : 1,
              }}
            >
              <Icon icon="lucide:grip-vertical" width={16} height={16} color="#9ca3af" />
              <span style={{ width: 18, fontWeight: 600 }}>{i + 1}</span>
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{script}</span>
              {status && status.state !== 'idle' && (
                <Icon icon={RUN_LOOK[status.state].icon} width={16} height={16} color={RUN_LOOK[status.state].color} />
              )}
            </li>
          )
        })}
      </ol>
      <footer style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, borderTop: '1px solid #eee' }}>
        {savedAs && <p style={{ margin: 0, fontSize: 13, color: '#16a34a' }}>Saved as {savedAs}</p>}
        <button
          onClick={() => setSaving(true)}
          disabled={scripts.length === 0}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #ddd',
            borderRadius: 6,
            background: 'white',
            font: 'inherit',
            fontWeight: 600,
            cursor: scripts.length === 0 ? 'default' : 'pointer',
          }}
        >
          Save
        </button>
        {saving && (
          <SaveDialog
            initialName={name}
            scripts={scripts}
            onClose={() => setSaving(false)}
            onSaved={(name) => {
              setSaving(false)
              setSavedAs(name)
              onSaved(name)
            }}
          />
        )}
        <button
          onClick={runAll}
          disabled={running || scripts.length === 0}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 12px',
            border: 'none',
            borderRadius: 6,
            background: running || scripts.length === 0 ? '#9ca3af' : '#16a34a',
            color: 'white',
            font: 'inherit',
            fontWeight: 600,
            cursor: running || scripts.length === 0 ? 'default' : 'pointer',
          }}
        >
          <Icon icon={running ? 'svg-spinners:180-ring' : 'lucide:play'} width={18} height={18} />
          {running ? 'Running…' : 'Run'}
        </button>
      </footer>
    </>
  )
}

const menuItemStyle = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'none',
  font: 'inherit',
  fontSize: 14,
  textAlign: 'left' as const,
  cursor: 'pointer',
}

// Hover menu under "Pipeline": New Pipeline, then the saved pipelines (fetched each time it opens).
function PipelineMenu({ names, onNew, onOpen }: { names: string[]; onNew: () => void; onOpen: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const item = (key: string, label: string, onClick: () => void) => (
    <button
      key={key}
      onClick={() => {
        setOpen(false)
        onClick()
      }}
      onMouseEnter={() => setHovered(key)}
      onMouseLeave={() => setHovered(null)}
      style={{ ...menuItemStyle, background: hovered === key ? '#f3f4f6' : 'none' }}
    >
      {label}
    </button>
  )

  return (
    <div onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} style={{ position: 'relative', height: '100%', display: 'flex' }}>
      <button
        onClick={() => {
          setOpen(false)
          onNew()
        }}
        style={{ ...barButtonStyle, fontSize: 14, fontWeight: 500 }}
      >
        Pipeline
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            minWidth: 200,
            padding: '4px 0',
            background: 'white',
            borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          }}
        >
          {item('new', 'New Pipeline', onNew)}
          <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
          <div style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Saved Pipelines</div>
          {names.length === 0 && (
            <div style={{ padding: '4px 12px 8px', fontSize: 13, color: '#9ca3af' }}>None yet</div>
          )}
          {names.map((name) => item(`saved:${name}`, name, () => onOpen(name)))}
        </div>
      )}
    </div>
  )
}

// Top bar: flow icon reloads the page; "Pipeline" menu to build or open pipelines.
function TopBar({
  pipelineNames,
  onNewPipeline,
  onOpenPipeline,
}: {
  pipelineNames: string[]
  onNewPipeline: () => void
  onOpenPipeline: (name: string) => void
}) {
  return (
    <nav
      style={{
        position: 'relative',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 48,
        padding: '0 12px',
        background: 'black',
      }}
    >
      <button onClick={() => window.location.reload()} aria-label="Reload" style={barButtonStyle}>
        <Icon icon="lucide:workflow" width={24} height={24} />
      </button>
      <PipelineMenu names={pipelineNames} onNew={onNewPipeline} onOpen={onOpenPipeline} />
    </nav>
  )
}

export default function App() {
  const [graph, setGraph] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  // Script ids of the pipeline being built, in click order; null when not building one.
  const [pipeline, setPipeline] = useState<string[] | null>(null)
  // Name of the saved pipeline shown in the panel; null for a new one.
  const [pipelineName, setPipelineName] = useState<string | null>(null)
  const [pipelineNames, setPipelineNames] = useState<string[]>([])
  // Bumped each time a pipeline is opened, to reset the panel (statuses, "Saved as").
  const [panelKey, setPanelKey] = useState(0)

  const loadFlow = () =>
    fetch('/api/flow')
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/flow failed: ${res.status}`)
        return res.json()
      })
      .then((flow: Flow) => setGraph(toGraph(flow)))
      .catch((err: Error) => setError(err.message))

  // Names only; loaded once, and again after a pipeline is saved.
  const loadPipelineNames = () =>
    fetch('/api/pipelines')
      .then((res) => (res.ok ? res.json() : []))
      .then(setPipelineNames)
      .catch(() => setPipelineNames([]))

  useEffect(() => {
    loadFlow()
    loadPipelineNames()
  }, [])

  const openPipeline = (name: string | null, scripts: string[]) => {
    setSelected(null)
    setPipelineName(name)
    setPanelKey((k) => k + 1)
    setPipeline(scripts.map((s) => `script:${s}`))
  }

  // Fetches one saved pipeline's content when it is clicked in the menu.
  const openSavedPipeline = (name: string) =>
    fetch(`/api/pipelines/${name}`)
      .then((res) => {
        if (!res.ok) throw new Error(`GET /api/pipelines/${name} failed: ${res.status}`)
        return res.json()
      })
      .then((p: { scripts: string[] }) => openPipeline(name, p.scripts))
      .catch((err: Error) => setError(err.message))

  const closePanel = () => {
    setSelected(null)
    setPipeline(null)
  }

  // While building a pipeline, clicking a script adds it, or removes it if already there;
  // otherwise a click opens the node details.
  const onNodeClick = (id: string) => {
    if (pipeline === null) setSelected(id)
    else if (pipeline.includes(id)) setPipeline(pipeline.filter((p) => p !== id))
    else if (id.startsWith('script:')) setPipeline([...pipeline, id])
  }

  const nodes = (graph?.nodes ?? []).map((n) => {
    const index = pipeline?.indexOf(n.id) ?? -1
    return index === -1 ? n : { ...n, data: { ...n.data, order: index + 1 } }
  })
  const selectedNode = nodes.find((n) => n.id === selected) as IconNode | undefined

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', fontFamily: "'Inter Variable', sans-serif" }}>
      <TopBar pipelineNames={pipelineNames} onNewPipeline={() => openPipeline(null, [])} onOpenPipeline={openSavedPipeline} />
      <main style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {error && <p style={{ padding: 16 }}>{error}</p>}
        {!error && !graph && <p style={{ padding: 16 }}>Loading…</p>}
        {graph && (
          <ReactFlow
            nodes={nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView
            nodesConnectable={false}
            onNodeClick={(_, node) => onNodeClick(node.id)}
            onPaneClick={() => setSelected(null)}
          >
            <Background />
            <Controls />
          </ReactFlow>
        )}
        <SidePanel open={selectedNode !== undefined || pipeline !== null} onClose={closePanel}>
          {pipeline !== null && (
            <PipelinePanel
              key={panelKey}
              name={pipelineName}
              scripts={pipeline.map((id) => id.slice('script:'.length))}
              onReorder={(scripts) => setPipeline(scripts.map((s) => `script:${s}`))}
              onFinished={loadFlow}
              onSaved={(name) => {
                setPipelineName(name)
                loadPipelineNames()
              }}
            />
          )}
          {pipeline === null && selectedNode && <NodeDetails node={selectedNode} onRunFinished={loadFlow} />}
        </SidePanel>
      </main>
    </div>
  )
}
