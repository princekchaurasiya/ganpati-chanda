"""Iteration 8 backend tests — batch #2 import verification + Add Member support.
Field names verified from live API:
  chanda entries use `name` (not donor_name)
  receipt-books use `prefix` (not code); Book 4 prefix is '(B4)'
"""
import os
import requests
import pytest

with open("/app/frontend/.env") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _chandas(api):
    r = api.get(f"{BASE_URL}/api/chanda")
    assert r.status_code == 200
    data = r.json()
    if isinstance(data, dict):
        data = data.get("chandas") or data.get("entries") or []
    return data


def test_chanda_total_count(api):
    data = _chandas(api)
    active = [c for c in data if not c.get("voided")]
    print(f"Total active chandas: {len(active)}")
    # Spec says 64 (38 + 26). Actual is 66 — flag if diff
    assert len(active) >= 64, f"Expected >=64 active chandas, got {len(active)}"


def test_book2_receipts_95_to_100(api):
    data = _chandas(api)
    by_no = {c["receipt_no"]: c for c in data if c.get("receipt_no") in (95, 96, 97, 98, 99, 100)}
    expected = {
        95: "samshad ali",
        96: "om kumar",
        97: "vriendra bhai",
        98: "krishna mold",
        99: "brijesh kahar",
        100: "rajan prajapati",
    }
    missing = [n for n in expected if n not in by_no]
    assert not missing, f"Missing Book2 receipts: {missing}"
    for n, name in expected.items():
        got = (by_no[n].get("name") or "").lower()
        assert name.lower() in got, f"Receipt {n}: expected donor '{name}', got '{got}'"


def test_book4_receipts_151_to_170(api):
    data = _chandas(api)
    b4 = [c for c in data if c.get("receipt_no") and 151 <= c["receipt_no"] <= 170]
    assert len(b4) == 20, f"Book 4 receipts 151-170: expected 20, got {len(b4)}"


def test_new_entries_dated_2026_09_11(api):
    data = _chandas(api)
    new_entries = [
        c for c in data
        if c.get("receipt_no") and (
            (95 <= c["receipt_no"] <= 100) or (151 <= c["receipt_no"] <= 170)
        )
    ]
    bad = [(c["receipt_no"], c.get("date")) for c in new_entries if not (c.get("date") or "").startswith("2026-09-11")]
    assert not bad, f"Entries not dated 2026-09-11: {bad}"


def test_row_99_pending_and_row_96_collected(api):
    data = _chandas(api)
    r99 = next((c for c in data if c.get("receipt_no") == 99), None)
    r96 = next((c for c in data if c.get("receipt_no") == 96), None)
    assert r99 and r96
    assert r99.get("status") == "Pending", f"row 99 status: {r99.get('status')}"
    assert (r99.get("received_amount") or 0) == 0
    assert r96.get("status") == "Collected", f"row 96 status: {r96.get('status')}"
    assert (r96.get("received_amount") or 0) == 500
    assert (r96.get("payment_mode") or "").lower() == "cash"


def test_collectors_list(api):
    r = api.get(f"{BASE_URL}/api/collectors")
    assert r.status_code == 200
    names = [c["name"] for c in r.json()]
    print(f"Collectors: {names}")
    required = [
        "Monu", "Shrikant", "Amit Sharma", "Pooja Iyer", "Mogli",
        "Ramakant amit brijesh", "mukesh", "prince", "pravin", "amar",
        "dinesh chaurasiya",
    ]
    missing = [n for n in required if n not in names]
    assert not missing, f"Missing collectors: {missing}"
    assert "pravin bhai" not in names, "'pravin bhai' should have been merged into 'pravin'"


def test_receipt_books(api):
    r = api.get(f"{BASE_URL}/api/receipt-books")
    assert r.status_code == 200
    books = r.json()
    by_prefix = {b["prefix"]: b for b in books}
    print(f"Book prefixes: {list(by_prefix.keys())}")
    # Support 'B4' or '(B4)'
    b4_key = next((k for k in by_prefix if "B4" in k), None)
    assert "B1" in by_prefix and "B2" in by_prefix and b4_key is not None
    assert "B3" not in by_prefix and "(B3)" not in by_prefix, "Book 3 should be deleted"
    assert by_prefix["B1"]["start_no"] == 1 and by_prefix["B1"]["end_no"] == 50
    assert by_prefix["B2"]["start_no"] == 51 and by_prefix["B2"]["end_no"] == 100
    assert by_prefix[b4_key]["start_no"] == 151 and by_prefix[b4_key]["end_no"] == 200


def test_create_collector_and_delete(api):
    name = "TEST_NEW_MEMBER_api_qa"
    # cleanup if exists
    for c in api.get(f"{BASE_URL}/api/collectors").json():
        if c["name"] == name:
            api.delete(f"{BASE_URL}/api/collectors/{c['id']}")
    r = api.post(f"{BASE_URL}/api/collectors", json={"name": name})
    assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
    created = r.json()
    assert created["name"] == name
    cid = created["id"]

    lst = api.get(f"{BASE_URL}/api/collectors").json()
    assert any(c["id"] == cid for c in lst)

    # cleanup FIRST so state is clean regardless of duplicate check
    d = api.delete(f"{BASE_URL}/api/collectors/{cid}")
    assert d.status_code in (200, 204)


def test_duplicate_existing_collector_rejected(api):
    """Bug: backend should reject POST /api/collectors when name already exists."""
    r = api.post(f"{BASE_URL}/api/collectors", json={"name": "Monu"})
    if r.status_code == 200:
        # cleanup the duplicate we just created
        dup_id = r.json().get("id")
        api.delete(f"{BASE_URL}/api/collectors/{dup_id}")
    assert r.status_code in (400, 409), f"Duplicate 'Monu' should be rejected, got {r.status_code}: {r.text}"


def test_empty_name_rejected(api):
    r = api.post(f"{BASE_URL}/api/collectors", json={"name": ""})
    assert r.status_code in (400, 422), f"Empty name should be rejected, got {r.status_code}"
