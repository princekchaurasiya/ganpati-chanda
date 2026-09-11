"""Iteration 9 backend tests: duplicate collector rejection, Pooja Iyer presence, regression totals."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://donation-log-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def collectors():
    r = requests.get(f"{API}/collectors", timeout=30)
    assert r.status_code == 200
    return r.json()


def test_collectors_contains_pooja_iyer(collectors):
    names = [c["name"] for c in collectors]
    assert "Pooja Iyer" in names, f"Pooja Iyer missing. Got: {names}"


def test_collectors_expected_set(collectors):
    names = set(c["name"] for c in collectors)
    expected = {"Pooja Iyer", "Monu", "Shrikant", "Amit Sharma", "Mogli",
                "Ramakant amit brijesh", "mukesh", "prince", "pravin",
                "amar", "dinesh chaurasiya"}
    missing = expected - names
    assert not missing, f"Missing collectors: {missing}. All: {sorted(names)}"
    assert "pravin bhai" not in names
    assert "Book 3" not in names


def test_duplicate_collector_rejected():
    r = requests.post(f"{API}/collectors", json={"name": "Monu"}, timeout=30)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    detail = r.json().get("detail", "")
    assert "already exists" in detail.lower(), f"Detail lacks 'already exists': {detail}"


def test_create_and_delete_collector_lifecycle():
    name = "QA_TEST_ITER9"
    # cleanup any leftover
    existing = requests.get(f"{API}/collectors", timeout=30).json()
    for c in existing:
        if c["name"] == name:
            requests.delete(f"{API}/collectors/{c['id']}", timeout=30)

    r = requests.post(f"{API}/collectors", json={"name": name}, timeout=30)
    assert r.status_code == 200, r.text
    created = r.json()
    assert created["name"] == name
    cid = created["id"]

    # Duplicate now should fail
    r2 = requests.post(f"{API}/collectors", json={"name": name}, timeout=30)
    assert r2.status_code == 400

    # verify in list
    lst = requests.get(f"{API}/collectors", timeout=30).json()
    assert any(c["id"] == cid for c in lst)

    # cleanup
    d = requests.delete(f"{API}/collectors/{cid}", timeout=30)
    assert d.status_code == 200


def test_empty_name_rejected():
    r = requests.post(f"{API}/collectors", json={"name": "   "}, timeout=30)
    assert r.status_code == 400


def test_regression_chanda_receipts():
    r = requests.get(f"{API}/chanda", timeout=30)
    assert r.status_code == 200
    chandas = r.json()
    # Book 2 receipts 95..100
    book2_nos = sorted({c.get("receipt_no") for c in chandas
                        if c.get("receipt_book_name") == "Book 2" and c.get("receipt_no")})
    # Book 4 receipts 151..170
    book4_nos = sorted({c.get("receipt_no") for c in chandas
                        if c.get("receipt_book_name") == "Book 4" and c.get("receipt_no")})
    assert set(range(95, 101)).issubset(set(book2_nos)), f"Book 2 nos: {book2_nos}"
    assert set(range(151, 171)).issubset(set(book4_nos)), f"Book 4 nos: {book4_nos}"


def test_no_book_3():
    r = requests.get(f"{API}/receipt-books", timeout=30)
    assert r.status_code == 200
    names = [b["name"] for b in r.json()]
    assert "Book 3" not in names
