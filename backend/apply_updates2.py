"""Batch 2:
8. Monu 15,000 mandap expense (group)
9-10. Monu -> Atul 4275 transfer + Atul 4275 frame/lokhand expense (group)
11-13. Mogli's 3 expenses: 25k mandap-token + 5k murti + 5k mandal certificate = 35k
14-15. Two new chandas under prince (no receipt, Collected): Dhaniram Gupta 2100, Mr Chaurasiya 1500
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


def expense_doc(desc, vendor, paid_by, amount, note=None):
    return {
        "id": str(uuid.uuid4()),
        "description": desc, "vendor": vendor, "category": "Other",
        "total_bill": float(amount), "amount_paid": float(amount),
        "group_funds_used": float(amount), "personal_contribution": 0.0,
        "paid_by": paid_by, "payment_mode": "Cash", "date": TODAY,
        "note": note, "voided": False,
        "created_at": utc_now(), "updated_at": utc_now(),
    }


def transfer_doc(from_m, to_m, amount, note=None):
    return {
        "id": str(uuid.uuid4()),
        "from_member": from_m, "to_member": to_m,
        "amount": float(amount), "date": TODAY, "note": note,
        "voided": False,
        "created_at": utc_now(), "updated_at": utc_now(),
    }


def chanda_doc(name, amount, collector, note=None):
    """Chanda without receipt book — Collected in Cash."""
    return {
        "id": str(uuid.uuid4()),
        "name": name, "mobile": None,
        "amount": float(amount), "received_amount": float(amount),
        "collector": collector, "payment_mode": "Cash", "status": "Collected",
        "date": TODAY,
        "receipt_book_id": None, "receipt_book_name": None, "receipt_no": None,
        "voided": False,
        "created_at": utc_now(),
    }


async def main():
    # 8. Monu 15k mandap
    await db.expenses.insert_one(expense_doc("Mandap token (Monu ki taraf se)", "Mandap wala", "Monu", 15000.0))
    print("+ expense: Mandap Rs.15000 by Monu")

    # 9. Transfer Monu -> Atul 4275
    await db.transfers.insert_one(transfer_doc("Monu", "Atul", 4275.0, "Frame + Lokhand samaan lene ke liye"))
    print("+ transfer: Monu -> Atul Rs.4275")

    # 10. Expense Atul 4275 frame/lokhand
    await db.expenses.insert_one(expense_doc("Frame + Lokhand samaan", "Frame/Lokhand vendor", "Atul", 4275.0,
                                             note="Monu ne Atul ko diya, Atul ne saman kharida"))
    print("+ expense: Frame/Lokhand Rs.4275 by Atul")

    # 11-13. Mogli 3 expenses
    await db.expenses.insert_one(expense_doc("Mandap token payment", "Mandap wala", "Mogli", 25000.0,
                                             note="Mogli ki taraf se token amount"))
    print("+ expense: Mandap Rs.25000 by Mogli")

    await db.expenses.insert_one(expense_doc("Murti purchase (Mogli)", "Murti wala", "Mogli", 5000.0))
    print("+ expense: Murti Rs.5000 by Mogli")

    await db.expenses.insert_one(expense_doc("Mandal certificate + memorandum", "Certificate wala", "Mogli", 5000.0))
    print("+ expense: Mandal Certificate Rs.5000 by Mogli")

    # 14-15. Two chandas under prince, no receipt, Collected
    await db.chandas.insert_one(chanda_doc("Dhaniram Gupta", 2100.0, "prince", note=None))
    print("+ chanda: Dhaniram Gupta Rs.2100 -> prince (no receipt, Collected)")

    await db.chandas.insert_one(chanda_doc("Mr Chaurasiya (Brijesh bhai ka dost)", 1500.0, "prince"))
    print("+ chanda: Mr Chaurasiya Rs.1500 -> prince (no receipt, Collected)")


if __name__ == "__main__":
    asyncio.run(main())
