"""Compatibility entry point for the current metal/glass/neon family."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name("build_metal_neon.py")),run_name="__main__")
