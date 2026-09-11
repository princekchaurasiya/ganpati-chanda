"""Authoritative refresh from user's uploaded Excel (chanda-2026-09-11 (1).xlsx).
Wipes chandas + re-imports 78 entries exactly.
"""
import asyncio, os, uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

IST = timezone(timedelta(hours=5, minutes=30))
MONTHS = {m: i+1 for i, m in enumerate(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"])}


def parse_date(s):
    d, mon, y = s.strip().split()
    return f"{int(y):04d}-{MONTHS[mon]:02d}-{int(d):02d}"


def norm_mode(m):
    if not m: return "Cash"
    m = str(m).strip().lower()
    if "gpay" in m or "upi" in m or "phonepe" in m: return "UPI"
    if "bank" in m: return "Bank Transfer"
    if "cash" in m: return "Cash"
    return "Other"


def norm_collector(name):
    if not name: return name
    n = name.strip()
    if n.lower() == "pravin bhai": return "pravin"
    if n.lower() == "mogli": return "Mogli"
    return n


# (book_str_or_None, receipt_no_or_None, name, amount, collector, mode_raw, status, date_str)
ROWS = [
    ("Book 2", 93, "Jain Plating", 1100, "Monu", "Gpay", "Collected", "11 Sep 2026"),
    ("Book 2", 94, "Kishor Bhoye", 1100, "Mogli", "Cash", "Pending", "11 Sep 2026"),
    ("Book 2", 95, "samshad ali", 1500, "mukesh", "Cash", "Pending", "11 Sep 2026"),
    ("Book 2", 96, "om kumar", 500, "prince", "Cash", "Collected", "11 Sep 2026"),
    ("Book 2", 97, "vriendra bhai", 500, "pravin", "Cash", "Pending", "11 Sep 2026"),
    ("Book 2", 98, "krishna mold", 500, "pravin", "Cash", "Pending", "11 Sep 2026"),
    ("Book 2", 99, "brijesh kahar", 500, "pravin", "Cash", "Pending", "11 Sep 2026"),
    ("Book 2", 100, "rajan prajapati", 500, "prince", "Cash", "Collected", "11 Sep 2026"),
    ("Book 4", 151, "ajeet singh", 1100, "pravin", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 152, "santosh bangle", 751, "pravin", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 153, "pradip jain", 551, "pravin", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 154, "abhishek plastic", 251, "prince", "Cash", "Collected", "11 Sep 2026"),
    ("Book 4", 155, "hemant dhuriya", 501, "mukesh", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 156, "ram vilash sharma", 1100, "mukesh", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 157, "anil agarwal", 1100, "prince", "Cash", "Collected", "11 Sep 2026"),
    ("Book 4", 158, "munnalal gupta", 501, "mukesh", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 159, "raj dairy", 501, "prince", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 160, "sahablal yadav", 1100, "mukesh", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 161, "vijay varma", 2100, "mukesh", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 162, "dinesh chaurasiya", 3500, "mukesh", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 163, "dinanath gupta", 501, "prince", "Cash", "Collected", "11 Sep 2026"),
    ("Book 4", 164, "krishna hotel", 1100, "Mogli", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 165, "ambika ceramic", 5100, "amar", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 166, "hitesh metal", 2100, "prince", "Cash", "Collected", "11 Sep 2026"),
    ("Book 4", 167, "dhanlaxmi enterprises", 501, "prince", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 168, "prabhunath jaiswal", 501, "prince", "Cash", "Collected", "11 Sep 2026"),
    ("Book 4", 169, "roahan chaurasiya panawala", 501, "mukesh", "Cash", "Pending", "11 Sep 2026"),
    ("Book 4", 170, "raju singh", 551, "dinesh chaurasiya", "Cash", "Pending", "11 Sep 2026"),
    ("Book 2", None, "Kundan Bhai", 5051, "Monu", "UPI", "Collected", "9 Sep 2026"),
    ("Book 2", 53, "Rishi pradhan", 501, "Ramakant amit brijesh", "Cash", "Collected", "8 Sep 2026"),
    ("Book 2", 52, "Manoj chaurasiya", 501, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 54, "Rajendra prasad Chaurasia", 2100, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 55, "Ravi chaurasia", 1101, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 56, "Shankar Chaurasiya", 1101, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 57, "Pawan chaurasiya", 1101, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 58, "Suresh chaurasiya", 501, "Ramakant amit brijesh", "UPI", "Pending", "8 Sep 2026"),
    ("Book 2", 59, "Rajendra yadav", 251, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 60, "Sunil kanaujiya", 501, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 61, "Ajay sharma", 251, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 62, "Ramlal yadav", 551, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 63, "Shitlaprasad Chaurasiya", 1111, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 64, "Satyam Chaurasiya", 1111, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 65, "Divya chaurasiya", 501, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 66, "Kanta yadav", 501, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 67, "Rinku dhuriya", 501, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 68, "Ayush shukla", 501, "Ramakant amit brijesh", "Cash", "Collected", "8 Sep 2026"),
    ("Book 2", 69, "Brijesh dhuriya", 551, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 70, "Sunil", 251, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 71, "Shubham", 251, "Ramakant amit brijesh", "UPI", "Collected", "8 Sep 2026"),
    ("Book 2", 72, "Deepak", 251, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 73, "Prince maurya", 151, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 74, "Sejal kanaujiya", 251, "Ramakant amit brijesh", "Cash", "Collected", "8 Sep 2026"),
    ("Book 2", 78, "Vijay Chaurasiya", 551, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 79, "Mohan Chaurasiya", 501, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 80, "Chunnilal vishwakarma", 251, "Ramakant amit brijesh", "Cash", "Collected", "8 Sep 2026"),
    ("Book 2", 75, "Munna bhai", 0, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 76, "Palak", 0, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 77, "Surabhi", 0, "Ramakant amit brijesh", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", None, "Mogali", 5000, "Mogli", "Cash", "Collected", "7 Sep 2026"),
    ("Book 2", None, "Prince Chaurasiya", 5001, "Mogli", "UPI", "Collected", "6 Sep 2026"),
    ("Book 2", None, "Pravin bhai", 5100, "Monu", "UPI", "Collected", "6 Sep 2026"),
    ("Book 2", None, "Omkar group", 5001, "Monu", "UPI", "Collected", "6 Sep 2026"),
    ("Book 2", 51, "Kalpesh (mogli friend)", 2000, "Shrikant", "Cash", "Collected", "6 Sep 2026"),
    ("Book 2", None, "Monu Chaurasiya", 5000, "Mogli", "UPI", "Collected", "2 Sep 2026"),
    ("Book 2", None, "Nizamuddin", 20000, "Mogli", "UPI", "Collected", "2 Sep 2026"),
    ("Book 2", None, "Ramanand", 5001, "Mogli", "UPI", "Collected", "1 Sep 2026"),
    # 81-92 => user confirmed Book 2
    ("Book 2", 81, "Gopi Chauhan", 1100, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 82, "Alok chhotelal rajbhar", 1100, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    # user: Prem is paid (Collected), mode Cash
    ("Book 2", 83, "Prem Jaiswal Falwale", 501, "Prince", "Cash", "Collected", "8 Sep 2026"),
    ("Book 2", 84, "Shankar bhai bhangarwale", 1100, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 85, "Dhaniram Gupta POP Wale", 2100, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 86, "Manish Enterprises Kanchawala", 1100, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 87, "Nijam Bhai", 501, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 88, "Prince Chaurasiya (Siyaram)", 501, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 89, "Arun Babu", 500, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 90, "Ram parvesh Yadav", 1100, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 91, "Hariom Gupta Chinese bhel", 1100, "Manoj", "Cash", "Pending", "8 Sep 2026"),
    ("Book 2", 92, "Bhairunath Icecream", 1100, "Manoj", "Cash", "Pending", "8 Sep 2026"),
]


async def ensure_collector(name):
    if not name: return None
    existing = await db.collectors.find_one({"name": name}, {"_id": 0})
    if existing: return existing["id"]
    doc = {"id": str(uuid.uuid4()), "name": name, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.collectors.insert_one(doc)
    print(f"  + collector: {name}")
    return doc["id"]


async def ensure_book(name, prefix, start, end):
    existing = await db.receipt_books.find_one({"name": name}, {"_id": 0})
    if existing: return existing
    doc = {"id": str(uuid.uuid4()), "name": name, "prefix": prefix,
           "start_no": start, "end_no": end, "assigned_to": None, "note": None,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.receipt_books.insert_one(doc)
    print(f"  + book: {name}")
    return doc


async def main():
    print("Wiping chandas...")
    r = await db.chandas.delete_many({})
    print(f"  deleted {r.deleted_count}")

    print("Ensuring books...")
    book1 = await ensure_book("Book 1", "B1", 1, 50)
    book2 = await ensure_book("Book 2", "B2", 51, 100)
    book4 = await ensure_book("Book 4", "B4", 151, 200)
    books_by_name = {"Book 1": book1, "Book 2": book2, "Book 4": book4}

    print("Ensuring collectors...")
    collectors = set(norm_collector(r[4]) for r in ROWS)
    for c in sorted(collectors):
        await ensure_collector(c)

    print(f"Inserting {len(ROWS)} chandas...")
    docs = []
    for idx, (book_name, rno, name, amt, col_raw, mode_raw, status, date_str) in enumerate(ROWS):
        date_iso = parse_date(date_str)
        y, m, d = [int(x) for x in date_iso.split("-")]
        # created_at: date at 10 AM IST + idx minutes for stable order
        created_ist = datetime(y, m, d, 10, 0, 0, tzinfo=IST) + timedelta(minutes=idx)
        created_utc = created_ist.astimezone(timezone.utc)
        mode = norm_mode(mode_raw)
        collector = norm_collector(col_raw)
        book = books_by_name.get(book_name) if book_name else None
        received = float(amt) if status == "Collected" else 0.0
        docs.append({
            "id": str(uuid.uuid4()),
            "name": name.strip(),
            "mobile": None,
            "amount": float(amt),
            "received_amount": received,
            "collector": collector,
            "payment_mode": mode,
            "status": status,
            "date": date_iso,
            "receipt_book_id": book["id"] if book else None,
            "receipt_book_name": book["name"] if book else None,
            "receipt_no": int(rno) if rno not in (None, "") else None,
            "voided": False,
            "created_at": created_utc.isoformat(),
        })
    if docs:
        await db.chandas.insert_many(docs)

    total_p = sum(x["amount"] for x in docs)
    total_r = sum(x["received_amount"] for x in docs)
    print(f"Inserted {len(docs)} chandas.")
    print(f"Total Promised: Rs. {total_p:,.0f}  Received: Rs. {total_r:,.0f}  Pending: Rs. {total_p-total_r:,.0f}")


if __name__ == "__main__":
    asyncio.run(main())
