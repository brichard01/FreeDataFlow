import { useEffect, useState } from 'react'
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './styles.css'
import { fetchFlow, fetchPipeline, fetchPipelineNames } from './api'
import type { IconNode } from './IconNode'
import { nodeTypes, toGraph } from './layout'
import { PipelinePanel } from './PipelinePanel'
import { NodeDetails, SidePanel } from './SidePanel'
import { TopBar } from './TopBar'

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
    fetchFlow()
      .then((flow) => setGraph(toGraph(flow)))
      .catch((err: Error) => setError(err.message))

  // Names only; loaded once, and again after a pipeline is saved.
  const loadPipelineNames = () => fetchPipelineNames().then(setPipelineNames)

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
    fetchPipeline(name)
      .then((p) => openPipeline(name, p.scripts))
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
    <div className="app">
      <TopBar pipelineNames={pipelineNames} onNewPipeline={() => openPipeline(null, [])} onOpenPipeline={openSavedPipeline} />
      <main className="app-main">
        {error && <p className="message">{error}</p>}
        {!error && !graph && <p className="message">Loading…</p>}
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
