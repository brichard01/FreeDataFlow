import { useState } from 'react'
import { Icon } from '@iconify/react'
import { runScript, type RunStatus } from './api'
import type { IconNode } from './IconNode'
import { RUN_LOOK } from './runLook'

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
    <div className="run-file">
      <button className="button" onClick={runFile} disabled={status.state === 'running'}>
        <Icon icon={look.icon} width={18} height={18} color={look.color} />
        {look.text}
      </button>
      {status.state === 'failed' && <p className="error-text">{status.message}</p>}
    </div>
  )
}

// Right side panel, slides in when open.
export function SidePanel({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className={open ? 'side-panel open' : 'side-panel'}>
      <button className="side-panel-close" onClick={onClose} aria-label="Close">
        <Icon icon="lucide:x" width={20} height={20} />
      </button>
      {children}
    </aside>
  )
}

// Panel content for a clicked node: icon and name on top, Run file for scripts.
export function NodeDetails({ node, onRunFinished }: { node: IconNode; onRunFinished: () => void }) {
  return (
    <>
      <header className="node-details">
        <Icon icon={node.data.icon} width={56} height={56} />
        <div className="node-details-name">{node.data.label}</div>
      </header>
      {node.id.startsWith('script:') && <RunButton key={node.id} script={node.data.label} onFinished={onRunFinished} />}
    </>
  )
}
