#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP="${1:-$ROOT/data/chanda-backup-2026-09-15.json}"

if [[ ! -x "$ROOT/backend/.venv/bin/python" ]]; then
  echo "Run ./scripts/setup.sh first (Python venv is missing)." >&2
  exit 1
fi

./scripts/start-mongo.sh
"$ROOT/backend/.venv/bin/python" "$ROOT/scripts/import_backup.py" "$BACKUP" --mode replace
"$ROOT/backend/.venv/bin/python" - << PY
import json
from pathlib import Path
p = Path(r"""$BACKUP""")
d = json.loads(p.read_text())
s = d.get("summary") or {}
print("Ye data ghar pe dashboard pe aana chahiye:")
if s:
    print(f"  Remaining ~ Rs.{round(s.get('remaining_balance') or 0)}")
    print(f"  Chanda received Rs.{round(s.get('chanda_received') or 0)}")
    print(f"  Group paid Rs.{round(s.get('group_funds_used') or 0)}")
else:
    ch = [c for c in d.get("chandas") or [] if not c.get("voided")]
    ex = [e for e in d.get("expenses") or [] if not e.get("voided")]
    recv = sum(c.get("received_amount") or 0 for c in ch)
    group = sum(e.get("group_funds_used") or 0 for e in ex)
    print(f"  Remaining ~ Rs.{round(recv - group)}")
    print(f"  Chanda received Rs.{round(recv)}")
print("Agar numbers match nahi hue to Settings → Restore se isi JSON ko Replace karo.")
PY
