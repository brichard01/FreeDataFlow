"""fdf command line."""

import argparse
import os
import subprocess
import sys

from freedataflow import registry


def run(script: str, script_args: list[str] | None = None) -> int:
    """Run a script with recording on, after clearing its previous entry. Returns its exit code."""
    registry.remove_script(script)
    env = {**os.environ, "FDF_RECORD": "1"}
    return subprocess.run([sys.executable, script, *(script_args or [])], env=env).returncode


def main() -> int:
    parser = argparse.ArgumentParser(prog="fdf")
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("run", help="Run a Python script and record its reads/writes")
    run.add_argument("script", help="Python file to run")
    run.add_argument("args", nargs=argparse.REMAINDER, help="Arguments passed to the script")

    ui = commands.add_parser("ui", help="Start the web interface")
    ui.add_argument("--port", type=int, default=8000)

    args = parser.parse_args()

    if args.command == "run":
        return run(args.script, args.args)
    if args.command == "ui":
        import uvicorn

        uvicorn.run("freedataflow.ui.server:app", port=args.port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
