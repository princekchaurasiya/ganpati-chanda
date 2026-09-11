from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, date


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Chanda Manager API")
api_router = APIRouter(prefix="/api")


# ============= Models =============
PaymentMode = Literal["Cash", "UPI", "Bank Transfer", "Other"]
Status = Literal["Pending", "Collected"]


class ChandaBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    amount: float
    collector: str
    payment_mode: PaymentMode = "Cash"
    status: Status = "Collected"
    date: str  # ISO date string (YYYY-MM-DD)
    note: Optional[str] = None


class ChandaCreate(ChandaBase):
    pass


class ChandaUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    amount: Optional[float] = None
    collector: Optional[str] = None
    payment_mode: Optional[PaymentMode] = None
    status: Optional[Status] = None
    date: Optional[str] = None
    note: Optional[str] = None
    voided: Optional[bool] = None


class Chanda(ChandaBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voided: bool = False
    collected_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Collector(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CollectorCreate(BaseModel):
    name: str


class CollectorUpdate(BaseModel):
    name: str


# ============= Helpers =============
def clean_doc(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc.pop("_id")
    return doc


# ============= Chanda Routes =============
@api_router.get("/")
async def root():
    return {"message": "Chanda Manager API", "version": "1.0"}


@api_router.post("/chanda", response_model=Chanda)
async def create_chanda(payload: ChandaCreate):
    chanda = Chanda(**payload.model_dump())
    if chanda.status == "Collected" and not chanda.collected_at:
        chanda.collected_at = datetime.now(timezone.utc).isoformat()
    await db.chandas.insert_one(chanda.model_dump())
    return chanda


@api_router.get("/chanda", response_model=List[Chanda])
async def list_chandas():
    docs = await db.chandas.find({}, {"_id": 0}).sort("date", -1).to_list(10000)
    return docs


@api_router.get("/chanda/{chanda_id}", response_model=Chanda)
async def get_chanda(chanda_id: str):
    doc = await db.chandas.find_one({"id": chanda_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Entry not found")
    return doc


@api_router.put("/chanda/{chanda_id}", response_model=Chanda)
async def update_chanda(chanda_id: str, payload: ChandaUpdate):
    existing = await db.chandas.find_one({"id": chanda_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Entry not found")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # If status is being changed to Collected, stamp collected_at
    if update_data.get("status") == "Collected" and not existing.get("collected_at"):
        update_data["collected_at"] = datetime.now(timezone.utc).isoformat()
    if update_data.get("status") == "Pending":
        update_data["collected_at"] = None

    await db.chandas.update_one({"id": chanda_id}, {"$set": update_data})
    updated = await db.chandas.find_one({"id": chanda_id}, {"_id": 0})
    return updated


@api_router.post("/chanda/{chanda_id}/void", response_model=Chanda)
async def void_chanda(chanda_id: str):
    existing = await db.chandas.find_one({"id": chanda_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Entry not found")
    await db.chandas.update_one(
        {"id": chanda_id},
        {"$set": {"voided": True, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return await db.chandas.find_one({"id": chanda_id}, {"_id": 0})


@api_router.post("/chanda/{chanda_id}/unvoid", response_model=Chanda)
async def unvoid_chanda(chanda_id: str):
    existing = await db.chandas.find_one({"id": chanda_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Entry not found")
    await db.chandas.update_one(
        {"id": chanda_id},
        {"$set": {"voided": False, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return await db.chandas.find_one({"id": chanda_id}, {"_id": 0})


@api_router.delete("/chanda/{chanda_id}")
async def delete_chanda(chanda_id: str):
    res = await db.chandas.delete_one({"id": chanda_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Entry not found")
    return {"ok": True}


# ============= Collector Routes =============
@api_router.get("/collectors", response_model=List[Collector])
async def list_collectors():
    docs = await db.collectors.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return docs


@api_router.post("/collectors", response_model=Collector)
async def create_collector(payload: CollectorCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    existing = await db.collectors.find_one({"name": name}, {"_id": 0})
    if existing:
        return existing
    collector = Collector(name=name)
    await db.collectors.insert_one(collector.model_dump())
    return collector


@api_router.put("/collectors/{collector_id}", response_model=Collector)
async def update_collector(collector_id: str, payload: CollectorUpdate):
    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(400, "Name is required")
    existing = await db.collectors.find_one({"id": collector_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Collector not found")
    old_name = existing["name"]
    if old_name == new_name:
        return existing
    # Ensure not duplicating another collector
    dup = await db.collectors.find_one({"name": new_name, "id": {"$ne": collector_id}}, {"_id": 0})
    if dup:
        raise HTTPException(400, "A collector with this name already exists")
    await db.collectors.update_one({"id": collector_id}, {"$set": {"name": new_name}})
    # Cascade rename in existing chanda entries
    await db.chandas.update_many(
        {"collector": old_name},
        {"$set": {"collector": new_name, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return await db.collectors.find_one({"id": collector_id}, {"_id": 0})


@api_router.delete("/collectors/{collector_id}")
async def delete_collector(collector_id: str):
    res = await db.collectors.delete_one({"id": collector_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Collector not found")
    return {"ok": True}


# ============= Dashboard =============
@api_router.get("/dashboard")
async def dashboard():
    docs = await db.chandas.find({"voided": {"$ne": True}}, {"_id": 0}).to_list(10000)

    total_expected = sum(d["amount"] for d in docs)
    collected = [d for d in docs if d["status"] == "Collected"]
    pending = [d for d in docs if d["status"] == "Pending"]
    total_collected = sum(d["amount"] for d in collected)
    total_pending = sum(d["amount"] for d in pending)

    by_mode = {}
    for d in collected:
        by_mode[d["payment_mode"]] = by_mode.get(d["payment_mode"], 0) + d["amount"]

    by_collector = {}
    for d in collected:
        by_collector[d["collector"]] = by_collector.get(d["collector"], 0) + d["amount"]

    return {
        "total_expected": total_expected,
        "total_collected": total_collected,
        "total_pending": total_pending,
        "count_collected": len(collected),
        "count_pending": len(pending),
        "count_total": len(docs),
        "by_payment_mode": by_mode,
        "by_collector": by_collector,
    }


# ============= Backup =============
@api_router.get("/backup")
async def backup():
    chandas = await db.chandas.find({}, {"_id": 0}).to_list(10000)
    collectors = await db.collectors.find({}, {"_id": 0}).to_list(1000)
    return {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "chandas": chandas,
        "collectors": collectors,
    }


class RestorePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chandas: List[dict] = []
    collectors: List[dict] = []
    mode: Literal["replace", "merge"] = "merge"


@api_router.post("/restore")
async def restore(payload: RestorePayload):
    if payload.mode == "replace":
        await db.chandas.delete_many({})
        await db.collectors.delete_many({})

    inserted_chandas = 0
    for c in payload.chandas:
        c.pop("_id", None)
        if "id" not in c:
            c["id"] = str(uuid.uuid4())
        await db.chandas.update_one({"id": c["id"]}, {"$set": c}, upsert=True)
        inserted_chandas += 1

    inserted_collectors = 0
    for c in payload.collectors:
        c.pop("_id", None)
        if "id" not in c:
            c["id"] = str(uuid.uuid4())
        await db.collectors.update_one({"id": c["id"]}, {"$set": c}, upsert=True)
        inserted_collectors += 1

    return {
        "ok": True,
        "chandas_restored": inserted_chandas,
        "collectors_restored": inserted_collectors,
    }


# ============= Seed (idempotent) =============
@api_router.post("/seed")
async def seed():
    existing = await db.chandas.count_documents({})
    if existing > 0:
        return {"seeded": False, "reason": "data already exists"}

    default_collectors = ["Amit Sharma", "Rahul Verma", "Suresh Gupta", "Pooja Iyer"]
    for name in default_collectors:
        col = Collector(name=name)
        await db.collectors.insert_one(col.model_dump())

    today = date.today().isoformat()
    demo = [
        {"name": "Ramesh Kumar", "amount": 501, "collector": "Amit Sharma", "payment_mode": "Cash", "status": "Collected"},
        {"name": "Anita Sharma", "amount": 1100, "collector": "Rahul Verma", "payment_mode": "UPI", "status": "Collected"},
        {"name": "Vijay Singh", "amount": 2100, "collector": "Amit Sharma", "payment_mode": "Bank Transfer", "status": "Collected"},
        {"name": "Sunita Devi", "amount": 251, "collector": "Suresh Gupta", "payment_mode": "Cash", "status": "Pending"},
        {"name": "Prakash Jain", "amount": 5100, "collector": "Pooja Iyer", "payment_mode": "UPI", "status": "Collected"},
        {"name": "Meena Agarwal", "amount": 501, "collector": "Rahul Verma", "payment_mode": "Cash", "status": "Pending"},
        {"name": "Deepak Kapoor", "amount": 1100, "collector": "Amit Sharma", "payment_mode": "UPI", "status": "Collected"},
        {"name": "Kavita Malhotra", "amount": 251, "collector": "Suresh Gupta", "payment_mode": "Cash", "status": "Collected"},
    ]
    for d in demo:
        entry = Chanda(**d, date=today)
        if entry.status == "Collected":
            entry.collected_at = datetime.now(timezone.utc).isoformat()
        await db.chandas.insert_one(entry.model_dump())

    return {"seeded": True, "chandas": len(demo), "collectors": len(default_collectors)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
