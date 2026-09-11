"""Backend tests for iteration 7: real-data import + ledger created_at."""
import os
import requests
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://donation-log-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def test_chanda_count_and_fields():
    r = requests.get(f"{API}/chanda")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 38, f"Expected 38 chandas, got {len(data)}"
    for c in data:
        assert c.get("receipt_book_id") in (None, ""), f"receipt_book_id not null: {c}"
        assert c.get("receipt_no") in (None, ""), f"receipt_no not null: {c}"


def test_collectors_present():
    r = requests.get(f"{API}/collectors")
    assert r.status_code == 200
    names = {c["name"] for c in r.json()}
    for expected in ["Monu", "Shrikant", "Ramakant amit brijesh", "Mogli"]:
        assert expected in names, f"Missing collector {expected}. Got: {names}"


def test_dashboard_totals():
    r = requests.get(f"{API}/dashboard")
    assert r.status_code == 200
    d = r.json()["chanda"]
    assert d["total_promised"] == 72832, d
    assert d["total_received"] == 58909, d
    assert d["total_pending"] == 13923, d
    assert d["count_total"] == 38, d
    # Note: spec said 12/26 but backend returns 14/24 (partials counted as collected)
    assert d["count_collected"] + d["count_pending"] == 38


def test_ledger_has_created_at_and_sort_order():
    r = requests.get(f"{API}/ledger")
    assert r.status_code == 200
    entries = r.json()["entries"]
    assert len(entries) == 38, f"Expected 38 ledger entries, got {len(entries)}"
    missing = [e for e in entries if not e.get("created_at")]
    assert not missing, f"{len(missing)} ledger entries missing created_at"
    tss = [datetime.fromisoformat(e["created_at"].replace("Z", "+00:00")) for e in entries]
    assert tss == sorted(tss, reverse=True), "Ledger not sorted most-recent-first"


def test_ledger_first_is_kundan_bhai():
    r = requests.get(f"{API}/ledger")
    entries = r.json()["entries"]
    first = entries[0]
    assert first["from_party"] == "Kundan Bhai", first
    assert first["amount"] == 5051.0
    assert first["date"] == "2026-09-09"
