"""One-shot script: wipe all dummy chanda/expense/transfer/reimbursement data
and import the user's real chanda list from the uploaded spreadsheet."""
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

# Rows exactly as provided by the user (Excel).
# Each tuple: (name, amount, collector, mode, status, iso_date, hour_ist)
# We stagger hours within each date so ledger ordering is stable.
ROWS = [
    ("Kundan Bhai", 5051, "Monu", "UPI", "Collected", "2026-09-09", 10),
    ("Rishi pradhan", 501, "Ramakant amit brijesh", "Cash", "Collected", "2026-09-08", 9),
    ("Manoj chaurasiya", 501, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 10),
    ("Rajendra prasad Chaurasia", 2100, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 11),
    ("Ravi chaurasia", 1101, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 12),
    ("Shankar Chaurasiya", 1101, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 13),
    ("Pawan chaurasiya", 1101, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 14),
    ("Suresh chaurasiya", 501, "Ramakant amit brijesh", "UPI", "Pending", "2026-09-08", 15),
    ("Rajendra yadav", 251, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 16),
    ("Sunil kanaujiya", 501, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 17),
    ("Ajay sharma", 251, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 18),
    ("Ramlal yadav", 551, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 19),
    ("Shitlaprasad Chaurasiya", 1101, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 20),
    ("Satyam Chaurasiya", 1101, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 21),
    ("Divya chaurasiya", 501, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 8),
    ("Kanta yadav", 501, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 7),
    ("Rinku dhuriya", 501, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 6),
    ("Ayush shukla", 501, "Ramakant amit brijesh", "Cash", "Collected", "2026-09-08", 5),
    ("Brijesh dhuriya", 551, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 4),
    ("Sunil", 251, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 3),
    ("Shubham", 251, "Ramakant amit brijesh", "UPI", "Collected", "2026-09-08", 2),
    ("Deepak", 251, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 1),
    ("Prince maurya", 151, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 22),
    ("Sejal kanaujiya", 251, "Ramakant amit brijesh", "Cash", "Collected", "2026-09-08", 23),
    ("Vijay Chaurasiya", 551, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 0),
    ("Mohan Chaurasiya", 501, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 11),
    ("Munnilal vishwakarma", 251, "Ramakant amit brijesh", "Cash", "Collected", "2026-09-08", 12),
    ("Munn bhai", 1, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 13),
    ("Palak", 1, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 14),
    ("Surabhi", 1, "Ramakant amit brijesh", "Cash", "Pending", "2026-09-08", 15),
    ("Mogali", 5000, "Mogli", "Cash", "Collected", "2026-09-07", 10),
    ("Prince Chaurasiya", 5001, "Mogli", "UPI", "Collected", "2026-09-06", 9),
    ("Pravin bhai", 5100, "Monu", "UPI", "Collected", "2026-09-06", 10),
    ("Omkar group", 5001, "Monu", "UPI", "Collected", "2026-09-06", 11),
    ("Kalpesh (mogli friend)", 2000, "Shrikant", "Cash", "Collected", "2026-09-06", 12),
    ("Monu Chaurasiya", 5000, "Mogli", "UPI", "Collected", "2026-09-02", 10),
    ("Nizamuddin", 20000, "Mogli", "UPI", "Collected", "2026-09-02", 11),
    ("Ramanand", 5001, "Mogli", "UPI", "Collected", "2026-09-01", 10),
]


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
    return doc["id"]


async def main():
    print("Wiping dummy data...")
    for coll in ("chandas", "expenses", "transfers", "reimbursements"):
        res = await db[coll].delete_many({})
        print(f"  {coll}: deleted {res.deleted_count}")

    print("Ensuring collectors exist...")
    for name in ("Monu", "Shrikant", "Ramakant amit brijesh", "Mogli"):
        cid = await ensure_collector(name)
        print(f"  {name}: {cid}")

    print(f"Inserting {len(ROWS)} chandas...")
    docs = []
    for name, amount, collector, mode, status, date_iso, hour in ROWS:
        y, m, d = [int(x) for x in date_iso.split("-")]
        created_ist = datetime(y, m, d, hour, 0, 0, tzinfo=IST)
        created_utc = created_ist.astimezone(timezone.utc)
        received = float(amount) if status == "Collected" else 0.0
        docs.append({
            "id": str(uuid.uuid4()),
            "name": name.strip(),
            "mobile": None,
            "amount": float(amount),
            "received_amount": received,
            "collector": collector,
            "payment_mode": mode,
            "status": status,
            "date": date_iso,
            "receipt_book_id": None,
            "receipt_book_name": None,
            "receipt_no": None,
            "voided": False,
            "created_at": created_utc.isoformat(),
        })
    if docs:
        await db.chandas.insert_many(docs)
    print(f"Inserted {len(docs)} chandas.")

    total_p = sum(x["amount"] for x in docs)
    total_r = sum(x["received_amount"] for x in docs)
    print(f"Total Promised: ₹{total_p:,.0f}  Received: ₹{total_r:,.0f}  Pending: ₹{total_p-total_r:,.0f}")


if __name__ == "__main__":
    asyncio.run(main())
