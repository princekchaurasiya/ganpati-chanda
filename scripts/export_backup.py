#!/usr/bin/env python3
"""Dump live Mongo (or /api/backup) to the bundled JSON file for git + ghar import."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

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

DEFAULT_OUT = ROOT / "data" / "chanda-backup-2026-09-15.json"


def _from_mongo() -> dict:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
    db_name = os.environ.get("DB_NAME", "ganpati_chanda")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=4000)
    db = client[db_name]
    payload = {"version": 6, "exported_at": datetime.now(timezone.utc).isoformat()}
    for name in COLLECTIONS:
        items = []
        for doc in db[name].find({}, {"_id": 0}):
            items.append(doc)
        payload[name] = items
    client.close()
    return payload


def _from_api(url: str) -> dict:
    with urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode())


def summarize(payload: dict) -> dict:
    chandas = [c for c in (payload.get("chandas") or []) if not c.get("voided")]
    expenses = [e for e in (payload.get("expenses") or []) if not e.get("voided")]
    reimbs = [r for r in (payload.get("reimbursements") or []) if not r.get("voided")]
    received = sum(c.get("received_amount", 0) or 0 for c in chandas)
    promised = sum(c.get("amount", 0) or 0 for c in chandas)
    group = sum(e.get("group_funds_used", 0) or 0 for e in expenses)
    personal = sum(e.get("personal_contribution", 0) or 0 for e in expenses)
    paid = sum(e.get("amount_paid", 0) or 0 for e in expenses)
    reimbursed = sum(r.get("amount", 0) or 0 for r in reimbs)
    remaining = received - group - reimbursed
    return {
        "chanda_promised": promised,
        "chanda_received": received,
        "expense_paid": paid,
        "group_funds_used": group,
        "personal_contribution": personal,
        "remaining_balance": remaining,
        "counts": {name: len(payload.get(name) or []) for name in COLLECTIONS},
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Export Chanda JSON backup for git")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output JSON path")
    parser.add_argument("--api", default="http://127.0.0.1:45211/api/backup", help="Backup API URL")
    parser.add_argument("--mongo-only", action="store_true", help="Skip API, read Mongo only")
    args = parser.parse_args()

    payload = None
    if not args.mongo_only:
        try:
            payload = _from_api(args.api)
        except Exception as err:
            print(f"API backup failed ({err}); falling back to Mongo.", file=sys.stderr)
    if payload is None:
        payload = _from_mongo()

    payload["version"] = int(payload.get("version") or 6)
    payload["exported_at"] = datetime.now(timezone.utc).isoformat()
    payload["summary"] = summarize(payload)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    s = payload["summary"]
    print(f"Wrote {out} (v{payload['version']} {payload['exported_at']})")
    print(
        f"  received {s['chanda_received']:.0f} − group {s['group_funds_used']:.0f}"
        f" = remaining {s['remaining_balance']:.0f}"
    )
    for name, n in s["counts"].items():
        print(f"  {name}: {n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
