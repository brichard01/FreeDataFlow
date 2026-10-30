"""reads/writes markers.

They do nothing unless the FDF_RECORD environment variable is set (by the fdf
command). In that case they add the asset, the calling script and the
input/output link to dataflow.json, without ever removing or overwriting anything.
"""

import os
import sys

from freedataflow import registry


def reads(asset_id: str) -> None:
    """Declare that the calling file reads the asset."""
    if os.environ.get("FDF_RECORD"):
        registry.add_link(sys._getframe(1).f_code.co_filename, asset_id, "inputs")


def writes(asset_id: str) -> None:
    """Declare that the calling file writes the asset."""
    if os.environ.get("FDF_RECORD"):
        registry.add_link(sys._getframe(1).f_code.co_filename, asset_id, "outputs")
