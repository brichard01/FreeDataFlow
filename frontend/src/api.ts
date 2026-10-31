// All calls to the Python server (fdf ui).

export type Flow = {
  assets: Record<string, { read: unknown; write: unknown }>
  scripts: Record<string, { inputs: string[]; outputs: string[] }>
}

export type Pipeline = { scripts: string[] }

export type RunStatus = { state: 'idle' } | { state: 'running' } | { state: 'done' } | { state: 'failed'; message: string }

export async function fetchFlow(): Promise<Flow> {
  const res = await fetch('/api/flow')
  if (!res.ok) throw new Error(`GET /api/flow failed: ${res.status}`)
  return res.json()
}

// Runs a script through POST /api/run and resolves to its final status (never rejects).
export async function runScript(script: string): Promise<RunStatus> {
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

// Names of all saved pipelines; an empty list if the request fails.
export async function fetchPipelineNames(): Promise<string[]> {
  try {
    const res = await fetch('/api/pipelines')
    return res.ok ? res.json() : []
  } catch {
    return []
  }
}

export async function fetchPipeline(name: string): Promise<Pipeline> {
  const res = await fetch(`/api/pipelines/${name}`)
  if (!res.ok) throw new Error(`GET /api/pipelines/${name} failed: ${res.status}`)
  return res.json()
}

// Throws with the server's message (invalid name, already exists...) on failure.
export async function savePipeline(name: string, scripts: string[], overwrite: boolean): Promise<void> {
  const res = await fetch('/api/pipelines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, scripts, overwrite }),
  })
  if (!res.ok) throw new Error(((await res.json()) as { detail?: string }).detail ?? `Save failed: ${res.status}`)
}
