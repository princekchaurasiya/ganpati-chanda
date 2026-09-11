"""Re-model Dahi Handi:
Old: 7 expense rows (Mogli 3500 group + 6 helpers 3500 personal-contribution -> reimbursement due)
New: 1 expense row (Mogli 7000 group cash Dahi Handi)
     + 6 chanda entries (helpers donated to Mogli as chanda)

Any future Mogli deficit will be reimbursed from Ganpati Mandap fund (user said so).
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
def utc_now(): return datetime.now(timezone.utc).isoformat()

HELPERS = [
    ("Raghav", 500),
    ("Ramakant amit brijesh", 500),
    ("pravin", 500),
    ("Aashique Ali", 1000),
    ("Manoj", 500),
    ("Mintu", 500),
]

async def main():
    # 1. Delete all Dahi Handi expenses (7 rows)
    r = await db.expenses.delete_many({"description": "Dahi Handi"})
    print(f"deleted {r.deleted_count} old Dahi Handi expense rows")

    # 2. Create ONE Dahi Handi expense — Mogli 7000 from group cash
    await db.expenses.insert_one({
        "id": str(uuid.uuid4()),
        "description": "Dahi Handi", "vendor": "Dahi Handi vendor",
        "category": "Dahi Handi",
        "total_bill": 7000.0, "amount_paid": 7000.0,
        "group_funds_used": 7000.0, "personal_contribution": 0.0,
        "paid_by": "Mogli", "payment_mode": "Cash", "date": TODAY,
        "note": "Dahi Handi expense — helpers' contributions logged as chanda entries",
        "voided": False,
        "created_at": utc_now(), "updated_at": utc_now(),
    })
    print("+ 1 expense: Dahi Handi Rs.7000 by Mogli (group cash)")

    # 3. Create 6 chanda entries from helpers to Mogli (collector)
    for idx, (helper, amt) in enumerate(HELPERS):
        created_ist = datetime.now(IST).replace(second=0, microsecond=0) + timedelta(minutes=idx)
        await db.chandas.insert_one({
            "id": str(uuid.uuid4()),
            "name": helper, "mobile": None,
            "amount": float(amt), "received_amount": float(amt),
            "collector": "Mogli",
            "payment_mode": "Cash", "status": "Collected",
            "date": TODAY,
            "receipt_book_id": None, "receipt_book_name": None, "receipt_no": None,
            "voided": False,
            "created_at": created_ist.astimezone(timezone.utc).isoformat(),
        })
        print(f"+ chanda: {helper} Rs.{amt} -> Mogli (Cash, Collected)")

asyncio.run(main())
