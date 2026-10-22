"""Compatibility entry point for the current icon family."""
import runpy
from pathlib import Path
if __name__=="__main__":
 runpy.run_path(str(Path(__file__).with_name("build_ruby_iron.py")),run_name="__main__")
