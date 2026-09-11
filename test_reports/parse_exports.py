import pdfplumber, openpyxl, csv, json, sys, requests, os

BASE = "https://donation-log-2.preview.emergentagent.com"
D = "/app/test_reports/downloads"

# Ground truth
chandas = requests.get(f"{BASE}/api/chanda").json()
active = [c for c in chandas if not c.get("voided")]
pending = [c for c in active if c.get("status") == "Pending"]
ACTIVE_COUNT = len(active)
PENDING_COUNT = len(pending)
active_names = set(c.get("name","").strip().lower() for c in active)
pending_names = set(c.get("name","").strip().lower() for c in pending)
print(f"[GT] active={ACTIVE_COUNT}, pending={PENDING_COUNT}")

results = {"passed": [], "failed": []}
def check(name, cond, detail=""):
    (results["passed"] if cond else results["failed"]).append(f"{name}: {'OK' if cond else 'FAIL'} {detail}")
    print(("[PASS] " if cond else "[FAIL] ") + name + " " + detail)

# ---------- PDF ALL ----------
with pdfplumber.open(f"{D}/all_default.pdf") as pdf:
    all_text = ""
    all_rows = []
    for p in pdf.pages:
        all_text += (p.extract_text() or "") + "\n"
        for t in (p.extract_tables() or []):
            all_rows.extend(t)
    # First row is header; count data rows (name column non-empty & not "Name")
    header = None
    for r in all_rows:
        if r and r[0] and r[0].strip() == "Name":
            header = r
            break
    data_rows = [r for r in all_rows if r and r[0] and r[0].strip() != "Name"]
    check("PDF.title", "Chanda Collection Report" in all_text)
    check("PDF.total_entries_line", f"Total Entries: {ACTIVE_COUNT}" in all_text, f"(expected {ACTIVE_COUNT})")
    check("PDF.header_present", header is not None and header == ["Name","Amount","Collector","Payment Mode","Status","Date"], f"header={header}")
    check("PDF.row_count", len(data_rows) == ACTIVE_COUNT, f"got {len(data_rows)}")
    for donor in ["samshad ali","brijesh kahar","Kundan Bhai","Nizamuddin","Ramanand","rajan prajapati","hitesh metal"]:
        check(f"PDF.contains[{donor}]", donor.lower() in all_text.lower())
    # Verify some values
    rows_by_name = {}
    for r in data_rows:
        rows_by_name[r[0].strip().lower()] = r
    r = rows_by_name.get("samshad ali")
    check("PDF.samshad_ali_1500_Pending", r and "1,500" in r[1] and r[4] == "Pending", f"row={r}")
    r = rows_by_name.get("kundan bhai")
    check("PDF.Kundan_5051_Collected", r and "5,051" in r[1] and r[4] == "Collected", f"row={r}")
    r = rows_by_name.get("brijesh kahar")
    check("PDF.brijesh_500_Pending", r and "500" in r[1] and r[4] == "Pending", f"row={r}")

# ---------- EXCEL ALL ----------
wb = openpyxl.load_workbook(f"{D}/all_default.xlsx")
sn = wb.sheetnames[0]
check("XLSX.sheet_name", sn == "Chanda", f"got {sn}")
ws = wb[sn]
rows = list(ws.iter_rows(values_only=True))
header = list(rows[0])
check("XLSX.header", header == ["Name","Amount","Collector","Payment Mode","Status","Date"], f"got {header}")
data = rows[1:]
check("XLSX.row_count", len(data) == ACTIVE_COUNT, f"got {len(data)}")
# Amount numeric
amount_types_ok = all(isinstance(r[1], (int, float)) for r in data)
check("XLSX.amount_numeric", amount_types_ok)
# Sample validation
by_name = {str(r[0]).strip().lower(): r for r in data}
r = by_name.get("samshad ali")
check("XLSX.samshad_1500_Pending", r and r[1] == 1500 and r[4] == "Pending", f"row={r}")
r = by_name.get("kundan bhai")
check("XLSX.Kundan_5051_Collected", r and r[1] == 5051 and r[4] == "Collected", f"row={r}")
r = by_name.get("brijesh kahar")
check("XLSX.brijesh_500_Pending", r and r[1] == 500 and r[4] == "Pending", f"row={r}")

# ---------- CSV ALL ----------
with open(f"{D}/all_default.csv", "rb") as f:
    raw = f.read()
check("CSV.no_BOM", not raw.startswith(b"\xef\xbb\xbf"))
text = raw.decode("utf-8")
lines = text.split("\n")
check("CSV.total_lines_65", len(lines) == ACTIVE_COUNT + 1, f"got {len(lines)} (active={ACTIVE_COUNT}+1)")
check("CSV.header_exact", lines[0].strip() == "Name,Amount,Collector,Payment Mode,Status,Date", f"got={lines[0]!r}")

# ---------- PDF pending ----------
with pdfplumber.open(f"{D}/pending.pdf") as pdf:
    all_rows = []
    all_text = ""
    for p in pdf.pages:
        all_text += (p.extract_text() or "") + "\n"
        for t in (p.extract_tables() or []):
            all_rows.extend(t)
    data_rows = [r for r in all_rows if r and r[0] and r[0].strip() != "Name"]
    check("PDF.pending.total_entries", f"Total Entries: {PENDING_COUNT}" in all_text)
    check("PDF.pending.row_count", len(data_rows) == PENDING_COUNT, f"got {len(data_rows)} exp {PENDING_COUNT}")
    got_names = set(r[0].strip().lower() for r in data_rows)
    check("PDF.pending.name_set_match", got_names == pending_names, f"missing={pending_names-got_names} extra={got_names-pending_names}")

# ---------- Excel 4 cols ----------
wb2 = openpyxl.load_workbook(f"{D}/four_cols.xlsx")
ws2 = wb2["Chanda"]
rows2 = list(ws2.iter_rows(values_only=True))
check("XLSX.4col.header", list(rows2[0]) == ["Name","Collector","Payment Mode","Status"], f"got={list(rows2[0])}")
check("XLSX.4col.row_count", len(rows2)-1 == ACTIVE_COUNT)

print(json.dumps({"pass": len(results["passed"]), "fail": len(results["failed"]), "failures": results["failed"]}, indent=2))
