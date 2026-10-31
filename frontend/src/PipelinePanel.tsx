import { useState } from 'react'
import { Icon } from '@iconify/react'
import { runScript, type RunStatus } from './api'
import { RUN_LOOK } from './runLook'
import { SaveDialog } from './SaveDialog'

// Panel content while building a pipeline: numbered scripts, then Run at the bottom
// which runs them one after another and stops at the first failure.
export function PipelinePanel({
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
      <header className="pipeline-title">{name ?? 'New Pipeline'}</header>
      <ol className="pipeline-list">
        {scripts.map((script, i) => {
          const status = statuses[script]
          return (
            <li
              key={script}
              className={['pipeline-row', running && 'locked', dragIndex === i && 'dragging'].filter(Boolean).join(' ')}
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
            >
              <Icon icon="lucide:grip-vertical" width={16} height={16} color="#9ca3af" />
              <span className="pipeline-index">{i + 1}</span>
              <span className="pipeline-script">{script}</span>
              {status && status.state !== 'idle' && (
                <Icon icon={RUN_LOOK[status.state].icon} width={16} height={16} color={RUN_LOOK[status.state].color} />
              )}
            </li>
          )
        })}
      </ol>
      <footer className="pipeline-footer">
        {savedAs && <p className="saved-text">Saved as {savedAs}</p>}
        <button className="button button-full" onClick={() => setSaving(true)} disabled={scripts.length === 0}>
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
        <button className="button button-full button-run" onClick={runAll} disabled={running || scripts.length === 0}>
          <Icon icon={running ? 'svg-spinners:180-ring' : 'lucide:play'} width={18} height={18} />
          {running ? 'Running…' : 'Run'}
        </button>
      </footer>
    </>
  )
}
