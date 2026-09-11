"""Batch fix + adds:
1. Fix receipt #74 collector: Ramakant amit brijesh -> prince
2. Add new member Atul
3. Expense: Monu paid Rs.12,000 to murti wala
4. Transfer: prince -> Ramakant amit brijesh Rs.500 (for police cash)
5. Expense: Ramakant amit brijesh paid Rs.500 to police
6. Transfer: prince -> Atul Rs.2,000 (banner work)
7. Transfer: Shrikant -> Monu Rs.2,000 (empties Shrikant)
"""
import asyncio, os, uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
IST = timezone(timedelta(hours=5, minutes=30))
TODAY = datetime.now(IST).date().isoformat()


def utc_now():
    return datetime.now(timezone.utc).isoformat()


async def ensure_collector(name):
    existing = await db.collectors.find_one({"name": name}, {"_id": 0})
    if existing:
        return existing["id"]
    doc = {"id": str(uuid.uuid4()), "name": name, "created_at": utc_now()}
    await db.collectors.insert_one(doc)
    print(f"  + collector: {name}")
    return doc["id"]


async def main():
    # 1) Fix receipt #74 collector
    book2 = await db.receipt_books.find_one({"name": "Book 2"}, {"_id": 0})
    r = await db.chandas.update_one(
        {"receipt_book_id": book2["id"], "receipt_no": 74, "voided": {"$ne": True}},
        {"$set": {"collector": "prince"}},
    )
    print(f"receipt #74 collector fix: modified={r.modified_count}")

    # 2) Add Atul
    await ensure_collector("Atul")

    # 3) Expense 12,000 murti wala paid by Monu
    exp1 = {
        "id": str(uuid.uuid4()),
        "description": "Murti (idol) purchase",
        "vendor": "Murti wala",
        "category": "Other",
        "total_bill": 12000.0,
        "amount_paid": 12000.0,
        "group_funds_used": 12000.0,
        "personal_contribution": 0.0,
        "paid_by": "Monu",
        "payment_mode": "Cash",
        "date": TODAY,
        "note": None,
        "voided": False,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.expenses.insert_one(exp1)
    print(f"  + expense: Murti Rs.12000 by Monu")

    # 4) Transfer prince -> Ramakant amit brijesh Rs.500 (for police cash)
    trf1 = {
        "id": str(uuid.uuid4()),
        "from_member": "prince",
        "to_member": "Ramakant amit brijesh",
        "amount": 500.0,
        "date": TODAY,
        "note": "Police cash (Brijesh ne prince se liya)",
        "voided": False,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.transfers.insert_one(trf1)
    print(f"  + transfer: prince -> Ramakant amit brijesh Rs.500")

    # 5) Expense 500 police wala paid by Ramakant amit brijesh
    exp2 = {
        "id": str(uuid.uuid4()),
        "description": "Police wale ko diya",
        "vendor": "Police",
        "category": "Other",
        "total_bill": 500.0,
        "amount_paid": 500.0,
        "group_funds_used": 500.0,
        "personal_contribution": 0.0,
        "paid_by": "Ramakant amit brijesh",
        "payment_mode": "Cash",
        "date": TODAY,
        "note": "Prince se liya paisa aage police ko diya",
        "voided": False,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.expenses.insert_one(exp2)
    print(f"  + expense: Police Rs.500 by Brijesh")

    # 6) Transfer prince -> Atul Rs.2,000 (banner)
    trf2 = {
        "id": str(uuid.uuid4()),
        "from_member": "prince",
        "to_member": "Atul",
        "amount": 2000.0,
        "date": TODAY,
        "note": "Banner ke kaam ke liye",
        "voided": False,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.transfers.insert_one(trf2)
    print(f"  + transfer: prince -> Atul Rs.2000")

    # 7) Transfer Shrikant -> Monu Rs.2,000
    trf3 = {
        "id": str(uuid.uuid4()),
        "from_member": "Shrikant",
        "to_member": "Monu",
        "amount": 2000.0,
        "date": TODAY,
        "note": "Shrikant ne saara paisa Monu ko de diya",
        "voided": False,
        "created_at": utc_now(),
        "updated_at": utc_now(),
    }
    await db.transfers.insert_one(trf3)
    print(f"  + transfer: Shrikant -> Monu Rs.2000")

    print("\nDone. Verifying totals...")


if __name__ == "__main__":
    asyncio.run(main())
