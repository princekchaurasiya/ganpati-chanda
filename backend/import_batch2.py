"""Import batch #2: 26 chandas across Book 2 (95-100) and Book 4 (151-170).
Also creates Book 4 (if missing) and 5 new collectors.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

IST = timezone(timedelta(hours=5, minutes=30))

# (book_no, receipt_no, donor, member, amount, status_word)
# status_word: "pending" | "paid" | "cash" | "" (empty)
ROWS = [
    ("BOOK 2", 95, "samshad ali", "mukesh", 1500, "pending"),
    ("BOOK 2", 96, "om kumar", "prince", 500, "cash"),
    ("BOOK 2", 97, "vriendra bhai", "pravin bhai", 500, "pending"),
    ("BOOK 2", 98, "krishna mold", "pravin bhai", 500, "pending"),
    ("BOOK 2", 99, "brijesh kahar", "pravin", 500, "pending"),   # user: Pending
    ("BOOK 2", 100, "rajan prajapati", "prince", 500, "cash"),
    ("BOOK 4", 151, "ajeet singh", "pravin", 1100, "pending"),
    ("BOOK 4", 152, "santosh bangle", "pravin", 751, "pending"),
    ("BOOK 4", 153, "pradip jain", "pravin", 551, "pending"),
    ("BOOK 4", 154, "abhishek plastic", "prince", 251, "paid"),
    ("BOOK 4", 155, "hemant dhuriya", "mukesh", 501, "pending"),
    ("BOOK 4", 156, "ram vilash sharma", "mukesh", 1100, "pending"),
    ("BOOK 4", 157, "anil agarwal", "prince", 1100, "paid"),
    ("BOOK 4", 158, "munnalal gupta", "mukesh", 501, "pending"),
    ("BOOK 4", 159, "raj dairy", "prince", 501, "pending"),
    ("BOOK 4", 160, "sahablal yadav", "mukesh", 1100, "pending"),
    ("BOOK 4", 161, "vijay varma", "mukesh", 2100, "pending"),
    ("BOOK 4", 162, "dinesh chaurasiya", "mukesh", 3500, "pending"),
    ("BOOK 4", 163, "dinanath gupta", "prince", 501, "paid"),
    ("BOOK 4", 164, "krishna hotel", "mogli", 1100, "pending"),
    ("BOOK 4", 165, "ambika ceramic", "amar", 5100, "pending"),
    ("BOOK 4", 166, "hitesh metal", "prince", 2100, "paid"),
    ("BOOK 4", 167, "dhanlaxmi enterprises", "prince", 501, "pending"),
    ("BOOK 4", 168, "prabhunath jaiswal", "prince", 501, "paid"),
    ("BOOK 4", 169, "roahan chaurasiya panawala", "mukesh", 501, "pending"),
    ("BOOK 4", 170, "raju singh", "dinesh chaurasiya", 551, "pending"),
]

# All same date per user: "aaj" -> today
TODAY = datetime.now(IST).date().isoformat()


def collector_map(name: str) -> str:
    """Normalize: pravin bhai + pravin -> pravin; mogli -> Mogli (capitalize)."""
    n = name.strip()
    if n.lower() in ("pravin bhai", "pravin"):
        return "pravin"
    if n.lower() == "mogli":
        return "Mogli"
    return n


def status_and_mode(word: str):
    """Return (status, payment_mode, received_amount_multiplier).
    - pending -> (Pending, Cash, 0)
    - paid    -> (Collected, Cash, 1)
    - cash    -> (Collected, Cash, 1)
    - blank   -> already handled row-99 -> Pending Cash 0
    """
    w = (word or "").strip().lower()
    if w == "pending" or w == "":
        return ("Pending", "Cash", 0.0)
    if w == "paid" or w == "cash":
        return ("Collected", "Cash", 1.0)
    return ("Pending", "Cash", 0.0)


async def ensure_collector(name: str):
    existing = await db.collectors.find_one({"name": name}, {"_id": 0})
    if existing:
        return existing["id"]
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.collectors.insert_one(doc)
    print(f"  + created collector: {name}")
    return doc["id"]


async def ensure_book(name: str, prefix: str, start: int, end: int, assigned_to=None):
    existing = await db.receipt_books.find_one({"name": name}, {"_id": 0})
    if existing:
        return existing["id"]
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "prefix": prefix,
        "start_no": start,
        "end_no": end,
        "assigned_to": assigned_to,
        "note": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.receipt_books.insert_one(doc)
    print(f"  + created book: {name} ({prefix}: {start}-{end})")
    return doc["id"]


async def main():
    # Clean up any TEST_ADD_XYZ collector if left over
    await db.collectors.delete_many({"name": {"$regex": "^TEST_"}})

    print("Ensuring books...")
    book2_id = await ensure_book("Book 2", "B2", 51, 100, assigned_to=None)
    book4_id = await ensure_book("Book 4", "B4", 151, 200, assigned_to=None)
    book_by_name = {"BOOK 2": ("Book 2", book2_id), "BOOK 4": ("Book 4", book4_id)}

    print("Ensuring collectors...")
    all_members = set(collector_map(r[3]) for r in ROWS)
    for m in sorted(all_members):
        await ensure_collector(m)

    print(f"Inserting {len(ROWS)} chandas dated {TODAY}...")
    inserted = 0
    skipped = 0
    for book_no, receipt_no, donor, member_raw, amount, status_word in ROWS:
        book_name, book_id = book_by_name[book_no]
        # duplicate guard on (book_id, receipt_no)
        dup = await db.chandas.find_one({
            "receipt_book_id": book_id,
            "receipt_no": int(receipt_no),
            "voided": {"$ne": True},
        }, {"_id": 0})
        if dup:
            print(f"  ! skipped {book_no}#{receipt_no} — already used by {dup.get('name')}")
            skipped += 1
            continue
        status, mode, mult = status_and_mode(status_word)
        collector = collector_map(member_raw)
        # created_at: use today's IST timestamp, staggered by (index) minutes for stable ordering
        idx = ROWS.index((book_no, receipt_no, donor, member_raw, amount, status_word))
        created_ist = datetime.now(IST).replace(second=0, microsecond=0) + timedelta(minutes=idx)
        created_utc = created_ist.astimezone(timezone.utc)
        doc = {
            "id": str(uuid.uuid4()),
            "name": donor.strip(),
            "mobile": None,
            "amount": float(amount),
            "received_amount": float(amount) * mult,
            "collector": collector,
            "payment_mode": mode,
            "status": status,
            "date": TODAY,
            "receipt_book_id": book_id,
            "receipt_book_name": book_name,
            "receipt_no": int(receipt_no),
            "voided": False,
            "created_at": created_utc.isoformat(),
        }
        await db.chandas.insert_one(doc)
        inserted += 1
    print(f"Done. inserted={inserted}, skipped={skipped}")


if __name__ == "__main__":
    asyncio.run(main())
