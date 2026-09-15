#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PORT="${PORT:-45211}"
./scripts/start-mongo.sh

if [[ ! -f frontend/build/index.html ]]; then
  echo "Building frontend…"
  (cd frontend && CI=false GENERATE_SOURCEMAP=false yarn build)
fi

# Preview talks to 127.0.0.1 (IPv4). Do not bind only to :: — uvicorn then
# refuses IPv4 and the Preview card shows "can't connect".
exec backend/.venv/bin/python scripts/serve.py
