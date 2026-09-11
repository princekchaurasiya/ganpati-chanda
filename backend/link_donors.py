"""Link existing chandas to team members (donor_member field) where the donor
name obviously refers to a member. Manual overrides can be applied later via UI.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# Explicit overrides for known typos / aliases (donor name → member name)
ALIAS_MAP = {
    "mogali": "Mogli",
    "mintu bhai": "Mintu",
    "pravin bhai": "pravin",
    "manoj chaurasiya": "Manoj",
    "monu chaurasiya": "Monu",
    "prince chaurasiya": "prince",
    "prince chaurasiya (siyaram)": "prince",
}


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    members = await db.collectors.find({}, {"_id": 0, "name": 1}).to_list(1000)
    member_names = {m["name"].lower().strip(): m["name"] for m in members}

    updated = 0
    async for c in db.chandas.find({"voided": {"$ne": True}}, {"_id": 0, "id": 1, "name": 1, "donor_member": 1}):
        if c.get("donor_member"):
            continue  # already linked
        donor_key = (c.get("name") or "").lower().strip()
        target = None
        # 1) exact match to a member (case-insensitive)
        if donor_key in member_names:
            target = member_names[donor_key]
        # 2) alias overrides
        elif donor_key in ALIAS_MAP:
            target = ALIAS_MAP[donor_key]
        if target:
            await db.chandas.update_one({"id": c["id"]}, {"$set": {"donor_member": target}})
            print(f"linked: {c['name']:30s} → {target}")
            updated += 1

    print(f"\nTotal linked: {updated}")

    # Verify: per-member donations
    print("\n=== Per-member donations (member gave own chanda) ===")
    for _, mname in member_names.items():
        count = await db.chandas.count_documents({"voided": {"$ne": True}, "donor_member": mname})
        if count:
            docs = await db.chandas.find({"voided": {"$ne": True}, "donor_member": mname}, {"_id": 0, "name": 1, "amount": 1, "event": 1}).to_list(50)
            total = sum(d["amount"] for d in docs)
            print(f"  {mname:25s} {count} entries · total Rs.{total:,.0f}")


if __name__ == "__main__":
    asyncio.run(main())
