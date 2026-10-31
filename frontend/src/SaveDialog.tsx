import { useState } from 'react'
import { createPortal } from 'react-dom'
import { savePipeline } from './api'

const PIPELINE_NAME = /^[a-z0-9_]+$/

// Centered dialog to name and save a pipeline.
// Prefilled with the opened pipeline's name. An existing name is only replaced if Overwrite is checked.
// Rendered in document.body: the sliding panel's transform would otherwise trap position: fixed.
export function SaveDialog({
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
      await savePipeline(name, scripts, overwrite)
      onSaved(name)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return createPortal(
    <div className="dialog-backdrop" onClick={onClose}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="dialog-title">Save pipeline</div>
        <input
          className="dialog-input"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          placeholder="pipeline_name"
        />
        {name !== '' && !valid && <p className="error-text">Only lowercase letters, digits and _ are allowed.</p>}
        <label className="dialog-checkbox">
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
        {error && <p className="error-text">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={!valid}>
            Save
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
