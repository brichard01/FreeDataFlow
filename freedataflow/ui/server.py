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
    """Run a script already known in dataflow.json and wait for it to finish."""
    if request.script not in registry.load().get("scripts", {}):
        raise HTTPException(status_code=404, detail=f"Unknown script: {request.script}")
    return {"returncode": run(request.script)}


# Mounted last so /api routes take precedence. Missing until `npm run build` is run.
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
