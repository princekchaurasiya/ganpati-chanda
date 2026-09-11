"""One-time migration: tag existing Chanda + Expense entries with an `event`.

Rules:
- Default all documents to "Ganpati Mandap".
- Mark the 6 Dahi Handi helper chandas (all chandas collected by Mogli on
  2026-09-12) as "Dahi Handi".
- Mark the "Dahi Handi" expense as "Dahi Handi" (category already tags it,
  but we also stamp the event field for uniform filtering).
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

DAHI_HANDI_CHANDA_IDS = [
    "daf4abdd-f779-445f-8421-9ab609da7c1c",  # Raghav 500
    "990cda2b-42c1-4102-b708-cdb71f0a6033",  # Ramakant amit brijesh 500
    "062e8188-cbbf-43f6-9916-0ce91f3e6a66",  # pravin 500
    "8ab70066-c5c6-49cf-aa61-aaf4a77ae32c",  # Aashique Ali 1000
    "8b52554b-e94a-4b0d-b660-e91efc13dfa8",  # Manoj 500
    "759be3bb-7501-422a-bffa-2b300da74c19",  # Mintu 500
]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    # Default everything to Ganpati Mandap first
    r1 = await db.chandas.update_many({}, {"$set": {"event": "Ganpati Mandap"}})
    r2 = await db.expenses.update_many({}, {"$set": {"event": "Ganpati Mandap"}})
    print(f"Set Ganpati Mandap: chandas={r1.modified_count}, expenses={r2.modified_count}")

    # Tag the 6 Dahi Handi helper chandas
    r3 = await db.chandas.update_many(
        {"id": {"$in": DAHI_HANDI_CHANDA_IDS}},
        {"$set": {"event": "Dahi Handi"}},
    )
    print(f"Dahi Handi chandas tagged: {r3.modified_count}")

    # Tag the Dahi Handi expense
    r4 = await db.expenses.update_many(
        {"category": "Dahi Handi"},
        {"$set": {"event": "Dahi Handi"}},
    )
    print(f"Dahi Handi expenses tagged: {r4.modified_count}")

    # Verify
    dahi_ch = await db.chandas.count_documents({"event": "Dahi Handi"})
    dahi_ex = await db.expenses.count_documents({"event": "Dahi Handi"})
    ganpati_ch = await db.chandas.count_documents({"event": "Ganpati Mandap"})
    ganpati_ex = await db.expenses.count_documents({"event": "Ganpati Mandap"})
    print("--- Verify ---")
    print(f"Dahi Handi: chandas={dahi_ch}, expenses={dahi_ex}")
    print(f"Ganpati Mandap: chandas={ganpati_ch}, expenses={ganpati_ex}")


if __name__ == "__main__":
    asyncio.run(main())
