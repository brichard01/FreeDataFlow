"""FastAPI server behind `fdf ui`: JSON API + the built React frontend."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from freedataflow import registry
from freedataflow.cli import run

STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI()


@app.get("/api/flow")
def flow() -> dict:
    return registry.load()


class RunRequest(BaseModel):
    script: str


@app.post("/api/run")
def run_script(request: RunRequest) -> dict:
    """Run a script already known in flow.json and wait for it to finish."""
    if request.script not in registry.load().get("scripts", {}):
        raise HTTPException(status_code=404, detail=f"Unknown script: {request.script}")
    return {"returncode": run(request.script)}


@app.get("/api/pipelines")
def pipelines() -> list[str]:
    """Names of all saved pipelines."""
    return registry.list_pipelines()


@app.get("/api/pipelines/{name}")
def pipeline(name: str) -> dict:
    """Content of one saved pipeline."""
    try:
        return registry.load_pipeline(name)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail=str(err))


class PipelineRequest(BaseModel):
    name: str
    scripts: list[str]
    overwrite: bool = False


@app.post("/api/pipelines")
def save_pipeline(request: PipelineRequest) -> dict:
    """Save a pipeline to .freedataflow/pipelines/<name>.json (replace it only if overwrite)."""
    try:
        registry.save_pipeline(request.name, request.scripts, request.overwrite)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except FileExistsError as err:
        raise HTTPException(status_code=409, detail=str(err))
    return {"name": request.name}


# Mounted last so /api routes take precedence. Missing until `npm run build` is run.
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
