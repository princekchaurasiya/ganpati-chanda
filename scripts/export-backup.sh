#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT="${1:-$ROOT/data/chanda-backup-2026-09-15.json}"

if [[ ! -x "$ROOT/backend/.venv/bin/python" ]]; then
  echo "Run ./scripts/setup.sh first (Python venv is missing)." >&2
  exit 1
fi

"$ROOT/backend/.venv/bin/python" "$ROOT/scripts/export_backup.py" --out "$OUT"
