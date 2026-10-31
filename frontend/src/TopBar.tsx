import { useState } from 'react'
import { Icon } from '@iconify/react'

// "Pipeline" button (click = new pipeline) with a hover menu: New Pipeline, then the saved pipelines.
function PipelineMenu({ names, onNew, onOpen }: { names: string[]; onNew: () => void; onOpen: (name: string) => void }) {
  const [open, setOpen] = useState(false)

  const item = (key: string, label: string, onClick: () => void) => (
    <button
      key={key}
      className="menu-item"
      onClick={() => {
        setOpen(false)
        onClick()
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="menu-wrapper" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        className="topbar-button"
        onClick={() => {
          setOpen(false)
          onNew()
        }}
      >
        Pipeline
      </button>
      {open && (
        <div className="menu">
          {item('new', 'New Pipeline', onNew)}
          <div className="menu-divider" />
          <div className="menu-heading">Saved Pipelines</div>
          {names.length === 0 && <div className="menu-empty">None yet</div>}
          {names.map((name) => item(`saved:${name}`, name, () => onOpen(name)))}
        </div>
      )}
    </div>
  )
}

// Top bar: flow icon reloads the page; "Pipeline" menu to build or open pipelines.
export function TopBar({
  pipelineNames,
  onNewPipeline,
  onOpenPipeline,
}: {
  pipelineNames: string[]
  onNewPipeline: () => void
  onOpenPipeline: (name: string) => void
}) {
  return (
    <nav className="topbar">
      <button className="topbar-button" onClick={() => window.location.reload()} aria-label="Reload">
        <Icon icon="lucide:workflow" width={24} height={24} />
      </button>
      <PipelineMenu names={pipelineNames} onNew={onNewPipeline} onOpen={onOpenPipeline} />
    </nav>
  )
}
