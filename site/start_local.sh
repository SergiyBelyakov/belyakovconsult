#!/usr/bin/env bash
set -eu
cd -- "$(dirname -- "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server 8000
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server 8000
else
  echo 'Python 3 is required for local preview. The deployed static site does not need Python.'
  exit 1
fi
