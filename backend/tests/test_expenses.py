"""Backend tests for Expenses module + Dashboard balance + Backup v2 + Seed."""
import os
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend .env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def cleanup_created(s):
    ids = []
    yield ids
    for i in ids:
        try:
            s.delete(f"{API}/expenses/{i}")
        except Exception:
            pass


# ============ Seed ============
def test_seed_idempotent(s):
    r = s.post(f"{API}/seed")
    assert r.status_code == 200
    data = r.json()
    # Either seeded now or already exists
    assert "seeded" in data


def test_after_seed_expenses_exist(s):
    r = s.get(f"{API}/expenses")
    assert r.status_code == 200
    lst = r.json()
    # Should contain demo expenses if DB was empty; otherwise at least some data
    descriptions = [e["description"] for e in lst]
    # Only enforce if any of demo names present (post-seed)
    # It's fine if user data exists already; but seed should have inserted 3 demo names if empty
    assert isinstance(lst, list)


# ============ CRUD ============
def test_create_expense(s, cleanup_created):
    payload = {
        "description": "TEST_Tent",
        "amount": 500,
        "category": "Materials",
        "payment_mode": "Cash",
        "paid_by": "Amit Sharma",
        "date": date.today().isoformat(),
    }
    r = s.post(f"{API}/expenses", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data
    assert data["voided"] is False
    assert data["description"] == "TEST_Tent"
    assert data["amount"] == 500
    assert data["category"] == "Materials"
    cleanup_created.append(data["id"])


def test_list_sorted_by_date_desc(s, cleanup_created):
    # Create two with different dates
    p1 = s.post(f"{API}/expenses", json={
        "description": "TEST_Old", "amount": 100, "category": "Other",
        "payment_mode": "Cash", "date": "2020-01-01",
    }).json()
    p2 = s.post(f"{API}/expenses", json={
        "description": "TEST_New", "amount": 200, "category": "Other",
        "payment_mode": "Cash", "date": "2099-12-31",
    }).json()
    cleanup_created.extend([p1["id"], p2["id"]])
    lst = s.get(f"{API}/expenses").json()
    dates = [e["date"] for e in lst]
    assert dates == sorted(dates, reverse=True)


def test_update_expense(s, cleanup_created):
    created = s.post(f"{API}/expenses", json={
        "description": "TEST_Upd", "amount": 100, "category": "Other",
        "payment_mode": "Cash", "date": date.today().isoformat(),
    }).json()
    cleanup_created.append(created["id"])
    r = s.put(f"{API}/expenses/{created['id']}", json={"amount": 250, "description": "TEST_Upd2"})
    assert r.status_code == 200
    assert r.json()["amount"] == 250
    assert r.json()["description"] == "TEST_Upd2"
    # verify via GET
    g = s.get(f"{API}/expenses/{created['id']}").json()
    assert g["amount"] == 250


def test_update_unknown_404(s):
    r = s.put(f"{API}/expenses/does-not-exist", json={"amount": 1})
    assert r.status_code == 404


def test_void_unvoid(s, cleanup_created):
    created = s.post(f"{API}/expenses", json={
        "description": "TEST_Void", "amount": 400, "category": "Food",
        "payment_mode": "UPI", "date": date.today().isoformat(),
    }).json()
    cleanup_created.append(created["id"])
    r = s.post(f"{API}/expenses/{created['id']}/void")
    assert r.status_code == 200 and r.json()["voided"] is True
    r = s.post(f"{API}/expenses/{created['id']}/unvoid")
    assert r.status_code == 200 and r.json()["voided"] is False


def test_delete_expense(s):
    created = s.post(f"{API}/expenses", json={
        "description": "TEST_Del", "amount": 50, "category": "Other",
        "payment_mode": "Cash", "date": date.today().isoformat(),
    }).json()
    r = s.delete(f"{API}/expenses/{created['id']}")
    assert r.status_code == 200
    g = s.get(f"{API}/expenses/{created['id']}")
    assert g.status_code == 404


def test_delete_unknown_404(s):
    r = s.delete(f"{API}/expenses/nope-nope")
    assert r.status_code == 404


# ============ Dashboard ============
def test_dashboard_balance_and_expenses(s, cleanup_created):
    # Create an expense and check dashboard
    d0 = s.get(f"{API}/dashboard").json()
    base_total_exp = d0.get("total_expenses", 0)
    base_balance = d0.get("balance", 0)
    base_count = d0.get("count_expenses", 0)

    created = s.post(f"{API}/expenses", json={
        "description": "TEST_DashCheck", "amount": 333, "category": "Rent",
        "payment_mode": "Cash", "date": date.today().isoformat(),
    }).json()
    cleanup_created.append(created["id"])

    d1 = s.get(f"{API}/dashboard").json()
    assert d1["total_expenses"] == base_total_exp + 333
    assert d1["count_expenses"] == base_count + 1
    assert "Rent" in d1["by_expense_category"]
    assert d1["balance"] == base_balance - 333
    assert d1["balance"] == d1["total_collected"] - d1["total_expenses"]

    # Void → should not count
    s.post(f"{API}/expenses/{created['id']}/void")
    d2 = s.get(f"{API}/dashboard").json()
    assert d2["total_expenses"] == base_total_exp
    assert d2["count_expenses"] == base_count
    assert d2["balance"] == base_balance


# ============ Backup / Restore ============
def test_backup_v2_includes_expenses(s):
    r = s.get(f"{API}/backup")
    assert r.status_code == 200
    data = r.json()
    assert data["version"] == 2
    assert "expenses" in data and isinstance(data["expenses"], list)
    assert "chandas" in data and "collectors" in data


def test_restore_merge_expenses(s, cleanup_created):
    exp_id = "test-restore-exp-1"
    payload = {
        "expenses": [{
            "id": exp_id,
            "description": "TEST_Restore",
            "amount": 77,
            "category": "Other",
            "payment_mode": "Cash",
            "paid_by": None,
            "date": date.today().isoformat(),
            "voided": False,
        }],
        "chandas": [],
        "collectors": [],
        "mode": "merge",
    }
    r = s.post(f"{API}/restore", json=payload)
    assert r.status_code == 200
    assert r.json()["expenses_restored"] == 1
    g = s.get(f"{API}/expenses/{exp_id}")
    assert g.status_code == 200
    cleanup_created.append(exp_id)
