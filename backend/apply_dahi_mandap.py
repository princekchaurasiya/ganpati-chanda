"""Batch:
A) Split Mogli Mandap 25000 into 5000 + 20000
B) Add new members: Raghav, Aashique Ali, Mintu
C) Dahi Handi 7000 expense (Mogli) — modeled as 7 rows so each helper's
   personal contribution shows up correctly:
   - Mogli 3500 group cash (from his +5002 held)
   - Raghav 500, Ramakant amit brijesh 500, pravin 500,
     Aashique Ali 1000, Manoj 500, Mintu 500  — each as personal_contribution
   Same description "Dahi Handi" & category "Dahi Handi" so they roll up together.
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


async def ensure_collector(name):
    existing = await db.collectors.find_one({"name": name}, {"_id": 0})
    if existing:
        return existing["id"]
    doc = {"id": str(uuid.uuid4()), "name": name, "created_at": utc_now()}
    await db.collectors.insert_one(doc)
    print(f"  + collector: {name}")
    return doc["id"]


def exp_doc(desc, vendor, category, paid_by, total_bill, amount_paid, group_funds_used, personal_contribution, note=None):
    return {
        "id": str(uuid.uuid4()),
        "description": desc, "vendor": vendor, "category": category,
        "total_bill": float(total_bill), "amount_paid": float(amount_paid),
        "group_funds_used": float(group_funds_used),
        "personal_contribution": float(personal_contribution),
        "paid_by": paid_by, "payment_mode": "Cash", "date": TODAY,
        "note": note, "voided": False,
        "created_at": utc_now(), "updated_at": utc_now(),
    }


async def main():
    # ---- A) Split Mogli Mandap 25000 ----
    old = await db.expenses.find_one({"description": "Mandap token payment", "voided": {"$ne": True}}, {"_id": 0})
    if old:
        await db.expenses.delete_one({"id": old["id"]})
        print(f"  - deleted old Mandap 25000 (id={old['id'][:8]})")
    await db.expenses.insert_one(exp_doc(
        desc="Mandap payment (Mogli — Part 1)", vendor="Mandap wala", category="Mandap",
        paid_by="Mogli", total_bill=5000, amount_paid=5000,
        group_funds_used=5000, personal_contribution=0,
        note="Split of earlier Rs.25000 → Part 1"
    ))
    await db.expenses.insert_one(exp_doc(
        desc="Mandap payment (Mogli — Part 2)", vendor="Mandap wala", category="Mandap",
        paid_by="Mogli", total_bill=20000, amount_paid=20000,
        group_funds_used=20000, personal_contribution=0,
        note="Split of earlier Rs.25000 → Part 2"
    ))
    print("  + Mandap split: 5000 + 20000 = 25000")

    # ---- B) New members ----
    for n in ("Raghav", "Aashique Ali", "Mintu"):
        await ensure_collector(n)

    # ---- C) Dahi Handi 7000 ----
    # Mogli 3500 group cash (has 5002 held after mandap split — unchanged total)
    await db.expenses.insert_one(exp_doc(
        desc="Dahi Handi", vendor="Dahi Handi vendor", category="Dahi Handi",
        paid_by="Mogli", total_bill=3500, amount_paid=3500,
        group_funds_used=3500, personal_contribution=0,
        note="Mogli's own group cash contribution to Dahi Handi (rest from helpers below)"
    ))
    print("  + Dahi Handi Rs.3500 by Mogli (group cash)")

    HELPERS = [
        ("Raghav", 500),
        ("Ramakant amit brijesh", 500),
        ("pravin", 500),
        ("Aashique Ali", 1000),
        ("Manoj", 500),
        ("Mintu", 500),
    ]
    for member, amt in HELPERS:
        await db.expenses.insert_one(exp_doc(
            desc="Dahi Handi", vendor="Dahi Handi vendor", category="Dahi Handi",
            paid_by=member, total_bill=amt, amount_paid=amt,
            group_funds_used=0, personal_contribution=amt,
            note=f"{member} gave Rs.{amt} from personal pocket for Dahi Handi (reimburse later)"
        ))
        print(f"  + Dahi Handi Rs.{amt} personal by {member}")

    total_dahi = 3500 + sum(a for _, a in HELPERS)
    print(f"\nDahi Handi total: Rs.{total_dahi}")


if __name__ == "__main__":
    asyncio.run(main())
