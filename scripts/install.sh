#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

chmod +x scripts/*.sh
./scripts/setup.sh
./scripts/start-mongo.sh
./scripts/import-backup.sh
(cd frontend && CI=false GENERATE_SOURCEMAP=false yarn build)
echo "Install complete. Start the app (UI + API on one port) with:"
echo "  ./scripts/start-app.sh"
