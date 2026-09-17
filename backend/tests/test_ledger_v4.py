"""Backend tests for v4 Ledger: Chanda (promised vs received), Transfers, Personal
Contribution + Reimbursement, Members Summary, Dashboard, Ledger, Backup v4."""
import os
import pytest
import requests
from datetime import date

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"
TODAY = date.today().isoformat()


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module", autouse=True)
def clean_slate(s):
    # Wipe all collections before tests run
    r = s.post(f"{API}/restore", json={
        "chandas": [], "collectors": [], "expenses": [],
        "transfers": [], "reimbursements": [], "mode": "replace",
    })
    assert r.status_code == 200
    # Also register collectors we'll use
    for name in ["Shrikant", "Monu"]:
        s.post(f"{API}/collectors", json={"name": name})
    yield


def _member(summary_json, name):
    for m in summary_json["members"]:
        if m["name"] == name:
            return m
    return None


# ============ Chanda: promised vs received ============
def test_chanda_pending_zero_received(s):
    r = s.post(f"{API}/chanda", json={
        "name": "TEST_Pend", "amount": 1000, "collector": "Shrikant",
        "status": "Pending", "date": TODAY,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "Pending"
    assert body["received_amount"] == 0
    cid = body["id"]
    # Now receive it
    r2 = s.post(f"{API}/chanda/{cid}/receive")
    assert r2.status_code == 200
    b2 = r2.json()
    assert b2["status"] == "Collected"
    assert b2["received_amount"] == 1000
    s.delete(f"{API}/chanda/{cid}")


def test_chanda_collected_default_received(s):
    r = s.post(f"{API}/chanda", json={
        "name": "TEST_Col", "amount": 500, "collector": "Shrikant",
        "status": "Collected", "date": TODAY,
    })
    assert r.status_code == 200
    assert r.json()["received_amount"] == 500
    s.delete(f"{API}/chanda/{r.json()['id']}")


# ============ Transfer validations ============
def test_transfer_rejects_overdraw(s):
    # Shrikant has ₹0 now (previous tests cleaned up); create fresh:
    c = s.post(f"{API}/chanda", json={
        "name": "TEST_TF1", "amount": 100, "collector": "Shrikant",
        "status": "Collected", "date": TODAY,
    }).json()
    r = s.post(f"{API}/transfers", json={
        "from_member": "Shrikant", "to_member": "Monu",
        "amount": 500, "date": TODAY,
    })
    assert r.status_code == 400
    assert "available" in r.text.lower() or "only" in r.text.lower()
    s.delete(f"{API}/chanda/{c['id']}")


def test_transfer_rejects_same_member(s):
    r = s.post(f"{API}/transfers", json={
        "from_member": "Monu", "to_member": "Monu",
        "amount": 10, "date": TODAY,
    })
    assert r.status_code == 400


# ============ Expense validations ============
def test_expense_split_mismatch(s):
    r = s.post(f"{API}/expenses", json={
        "description": "TEST_SplitBad", "category": "Other",
        "total_bill": 1000, "amount_paid": 500,
        "group_funds_used": 200, "personal_contribution": 200,  # 400 != 500
        "paid_by": "Monu", "date": TODAY,
    })
    assert r.status_code == 400


def test_expense_paid_exceeds_bill(s):
    r = s.post(f"{API}/expenses", json={
        "description": "TEST_Over", "category": "Other",
        "total_bill": 100, "amount_paid": 200,
        "group_funds_used": 200, "personal_contribution": 0,
        "paid_by": "Monu", "date": TODAY,
    })
    assert r.status_code == 400


def test_expense_group_exceeds_held(s):
    # Monu has 0 held here (nothing collected yet in this test order); use fresh setup
    r = s.post(f"{API}/expenses", json={
        "description": "TEST_NoHeld", "category": "Other",
        "total_bill": 100, "amount_paid": 100,
        "group_funds_used": 100, "personal_contribution": 0,
        "paid_by": "Monu", "date": TODAY,
    })
    assert r.status_code == 400


# ============ Reimbursement validations ============
def test_reimb_self(s):
    r = s.post(f"{API}/reimbursements", json={
        "paid_by": "Monu", "to_member": "Monu", "amount": 1, "date": TODAY,
    })
    assert r.status_code == 400


def test_reimb_no_due(s):
    r = s.post(f"{API}/reimbursements", json={
        "paid_by": "Shrikant", "to_member": "Monu", "amount": 1, "date": TODAY,
    })
    assert r.status_code == 400  # Monu owed 0


# ============ ACCEPTANCE SCENARIO end-to-end ============
def test_acceptance_scenario(s):
    # Fresh slate
    r = s.post(f"{API}/restore", json={
        "chandas": [], "collectors": [], "expenses": [],
        "transfers": [], "reimbursements": [], "mode": "replace",
    })
    assert r.status_code == 200
    for name in ["Shrikant", "Monu"]:
        s.post(f"{API}/collectors", json={"name": name})

    # (b) Add Chanda Shrikant 2000, Monu 10000
    s.post(f"{API}/chanda", json={"name": "Donor A", "amount": 2000, "collector": "Shrikant", "status": "Collected", "date": TODAY})
    s.post(f"{API}/chanda", json={"name": "Donor B", "amount": 10000, "collector": "Monu", "status": "Collected", "date": TODAY})
    d = s.get(f"{API}/dashboard").json()
    assert d["chanda"]["total_received"] == 12000
    assert d["total_collected"] == 12000

    # (c) Transfer Shrikant -> Monu 2000
    tr = s.post(f"{API}/transfers", json={"from_member": "Shrikant", "to_member": "Monu", "amount": 2000, "date": TODAY})
    assert tr.status_code == 200
    d = s.get(f"{API}/dashboard").json()
    assert d["chanda"]["total_received"] == 12000, "Transfer must NOT change total_received"
    ms = s.get(f"{API}/members/summary").json()
    assert _member(ms, "Shrikant")["current_held"] == 0
    assert _member(ms, "Monu")["current_held"] == 12000

    # (d) Expense Murti Wale total_bill=65000, paid=12000 group=12000 personal=0, paid_by=Monu
    ex = s.post(f"{API}/expenses", json={
        "description": "Murti", "vendor": "Murti Wale", "category": "Decoration",
        "total_bill": 65000, "amount_paid": 12000,
        "group_funds_used": 12000, "personal_contribution": 0,
        "paid_by": "Monu", "date": TODAY,
    })
    assert ex.status_code == 200, ex.text
    d = s.get(f"{API}/dashboard").json()
    assert d["expenses"]["total_bill"] == 65000
    assert d["expenses"]["total_paid"] == 12000
    assert d["expenses"]["total_payable"] == 53000
    ms = s.get(f"{API}/members/summary").json()
    monu = _member(ms, "Monu")
    assert monu["current_held"] == 0
    assert monu["group_funds_paid"] == 12000

    # (e) Monu +Chanda 15000, then expense 30000 group=15000 personal=15000
    s.post(f"{API}/chanda", json={"name": "Donor C", "amount": 15000, "collector": "Monu", "status": "Collected", "date": TODAY})
    ex2 = s.post(f"{API}/expenses", json={
        "description": "Big Expense", "category": "Materials",
        "total_bill": 30000, "amount_paid": 30000,
        "group_funds_used": 15000, "personal_contribution": 15000,
        "paid_by": "Monu", "date": TODAY,
    })
    assert ex2.status_code == 200, ex2.text
    ms = s.get(f"{API}/members/summary").json()
    monu = _member(ms, "Monu")
    assert monu["reimbursement_due"] == 15000
    assert monu["current_held"] == 0

    # (f) Shrikant collects 20000; reimburses Monu 15000
    s.post(f"{API}/chanda", json={"name": "Donor D", "amount": 20000, "collector": "Shrikant", "status": "Collected", "date": TODAY})
    rb = s.post(f"{API}/reimbursements", json={
        "paid_by": "Shrikant", "to_member": "Monu", "amount": 15000, "date": TODAY,
    })
    assert rb.status_code == 200, rb.text
    ms = s.get(f"{API}/members/summary").json()
    monu = _member(ms, "Monu")
    shri = _member(ms, "Shrikant")
    assert monu["reimbursement_due"] == 0
    assert monu["reimbursement_received"] == 15000
    assert monu["net_position"] == 0
    assert shri["current_held"] == 5000
    d = s.get(f"{API}/dashboard").json()
    assert d["chanda"]["total_received"] == 47000  # 2000+10000+15000+20000
    assert d["reimbursements"]["total_reimbursed"] == 15000
    assert d["reimbursements"]["outstanding"] == 0
    assert d["money_position"]["cash_held"] == 47000 - 27000 - 15000  # 5000
    assert d["balance"] == 5000


# ============ Ledger ============
def test_ledger_has_all_types(s):
    r = s.get(f"{API}/ledger")
    assert r.status_code == 200
    entries = r.json()["entries"]
    types = {e["type"] for e in entries}
    assert {"chanda", "transfer", "expense", "reimbursement"}.issubset(types)
    # date desc
    dates = [e["date"] for e in entries]
    assert dates == sorted(dates, reverse=True)


# ============ Backup v4 ============
def test_backup_v4(s):
    r = s.get(f"{API}/backup")
    assert r.status_code == 200
    b = r.json()
    assert b["version"] >= 4
    for k in ("chandas", "collectors", "expenses", "transfers", "reimbursements", "receipt_books", "event_transfers"):
        assert k in b and isinstance(b[k], list)


def test_restore_replace_wipes_all(s):
    r = s.post(f"{API}/restore", json={
        "chandas": [], "collectors": [], "expenses": [],
        "transfers": [], "reimbursements": [], "mode": "replace",
    })
    assert r.status_code == 200
    assert s.get(f"{API}/chanda").json() == []
    assert s.get(f"{API}/expenses").json() == []
    assert s.get(f"{API}/transfers").json() == []
    assert s.get(f"{API}/reimbursements").json() == []
