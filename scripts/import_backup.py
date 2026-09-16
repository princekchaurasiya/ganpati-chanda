#!/usr/bin/env python3
"""Replace local MongoDB with a Chanda JSON backup (Settings export format)."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / "backend" / ".env")

COLLECTIONS = (
    "chandas",
    "collectors",
    "expenses",
    "transfers",
    "reimbursements",
    "receipt_books",
    "event_transfers",
)


def import_backup(path: Path, mode: str) -> dict[str, int]:
    payload = json.loads(path.read_text())
    mongo_url = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
    db_name = os.environ.get("DB_NAME", "ganpati_chanda")
    client = MongoClient(mongo_url)
    db = client[db_name]
    counts: dict[str, int] = {}

    if mode == "replace":
        for name in COLLECTIONS:
            db[name].delete_many({})

    for name in COLLECTIONS:
        items = payload.get(name) or []
        counts[name] = len(items)
        for item in items:
            item.pop("_id", None)
            if "id" not in item:
                continue
            db[name].update_one({"id": item["id"]}, {"$set": item}, upsert=True)

    client.close()
    return counts


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a Chanda JSON backup into MongoDB")
    parser.add_argument(
        "backup",
        nargs="?",
        default=str(ROOT / "data" / "chanda-backup-2026-09-15.json"),
        help="Path to backup JSON",
    )
    parser.add_argument("--mode", choices=("replace", "merge"), default="replace")
    args = parser.parse_args()
    path = Path(args.backup)
    if not path.is_file():
        print(f"Backup not found: {path}", file=sys.stderr)
        return 1
    counts = import_backup(path, args.mode)
    print(f"Imported {path.name} ({args.mode})")
    for name, n in counts.items():
        print(f"  {name}: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
