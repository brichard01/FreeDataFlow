"""Edit functions for dataflow.json.

Script paths are stored relative to the current directory (the project root).
"""

import json
import os
from pathlib import Path

FLOW_FILE = "dataflow.json"

def load() -> dict:
    flow_path = Path.cwd() / FLOW_FILE
    return json.loads(flow_path.read_text(encoding="utf-8")) if flow_path.exists() else {}


def save(flow: dict) -> None:
    (Path.cwd() / FLOW_FILE).write_text(json.dumps(flow, indent=2) + "\n", encoding="utf-8")
    

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
