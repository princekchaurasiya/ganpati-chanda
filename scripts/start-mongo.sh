#!/usr/bin/env bash
set -euo pipefail

if mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok" >/dev/null 2>&1; then
  echo "MongoDB already running on 127.0.0.1:27017"
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  docker compose up -d mongo
  echo "MongoDB started via Docker"
  exit 0
fi

DATA_DIR="${MONGODB_DATA_DIR:-/tmp/mongodb-data}"
LOG_FILE="${MONGODB_LOG_FILE:-/tmp/mongod.log}"
mkdir -p "$DATA_DIR"
mongod --dbpath "$DATA_DIR" --bind_ip 127.0.0.1 --port 27017 --fork --logpath "$LOG_FILE"
echo "MongoDB started at $DATA_DIR"
