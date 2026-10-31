"""Edit functions for the .freedataflow folder: flow.json and pipelines/<name>.json.

Script paths are stored relative to the current directory (the project root).
"""

import json
import os
import re
from pathlib import Path

FDF_DIR = ".freedataflow"
FLOW_FILE = "flow.json"
PIPELINES_DIR = "pipelines"
PIPELINE_NAME = re.compile(r"[a-z0-9_]+")


def load() -> dict:
    flow_path = Path.cwd() / FDF_DIR / FLOW_FILE
    return json.loads(flow_path.read_text(encoding="utf-8")) if flow_path.exists() else {}


def save(flow: dict) -> None:
    _write_json(Path.cwd() / FDF_DIR / FLOW_FILE, flow)
    

def script_path(file: str) -> str:
    return Path(os.path.relpath(file, Path.cwd())).as_posix()
    
    
def remove_script(script_file: str) -> None:
    """Remove a script so a new run starts from a clean entry."""
    flow = load()
    if flow.get("scripts", {}).pop(script_path(script_file), None) is not None:
        save(flow)
    
    
def add_link(script_file: str, asset_id: str, direction: str) -> None:
    """Add the asset and script (if missing) and link the asset as an "inputs" or "outputs" of the script."""
    flow = load()

    assets = flow.setdefault("assets", {})
    assets.setdefault(asset_id, {"read": None, "write": None})

    path = script_path(script_file)
    scripts = flow.setdefault("scripts", {})
    script = scripts.setdefault(path, {"inputs": [], "outputs": []})
    if asset_id not in script[direction]:
        script[direction].append(asset_id)

    save(flow)


def list_pipelines() -> list[str]:
    """Return the names of all saved pipelines, sorted."""
    return sorted(path.stem for path in (Path.cwd() / FDF_DIR / PIPELINES_DIR).glob("*.json"))


def load_pipeline(name: str) -> dict:
    """Return pipelines/<name>.json as {"scripts": [...]}."""
    if not PIPELINE_NAME.fullmatch(name):
        raise ValueError(f"Invalid pipeline name: {name!r} (use lowercase letters, digits and _)")
    path = Path.cwd() / FDF_DIR / PIPELINES_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Unknown pipeline: {name}")
    return json.loads(path.read_text(encoding="utf-8"))


def save_pipeline(name: str, scripts: list[str], overwrite: bool = False) -> None:
    """Write pipelines/<name>.json. Names are lowercase letters, digits and underscores.

    An existing pipeline is only replaced when overwrite is True.
    """
    if not PIPELINE_NAME.fullmatch(name):
        raise ValueError(f"Invalid pipeline name: {name!r} (use lowercase letters, digits and _)")
    path = Path.cwd() / FDF_DIR / PIPELINES_DIR / f"{name}.json"
    if path.exists() and not overwrite:
        raise FileExistsError(f"Pipeline already exists: {name}")
    _write_json(path, {"scripts": scripts})


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
