"""dff command line."""

import argparse
import os
import subprocess
import sys

from freedataflow import registry


def main() -> int:
    parser = argparse.ArgumentParser(prog="dff")
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("run", help="Run a Python script and record its reads/writes")
    run.add_argument("script", help="Python file to run")
    run.add_argument("args", nargs=argparse.REMAINDER, help="Arguments passed to the script")

    args = parser.parse_args()

    if args.command == "run":
        registry.remove_script(args.script)
        env = {**os.environ, "DFF_RECORD": "1"}
        return subprocess.run([sys.executable, args.script, *args.args], env=env).returncode
    return 0


if __name__ == "__main__":
    sys.exit(main())
