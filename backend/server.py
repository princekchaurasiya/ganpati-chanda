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
ExpenseCategory = Literal["Materials", "Food", "Decoration", "Rent", "Utilities", "Transport", "Mandap", "Murti", "Banner", "Police & BMC", "Documents", "Other"]


class ChandaBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    mobile: Optional[str] = None
    amount: float
    received_amount: float = 0
    collector: str
    payment_mode: PaymentMode = "Cash"
    status: Status = "Collected"
    date: str
    receipt_book_id: Optional[str] = None
    receipt_book_name: Optional[str] = None
    receipt_no: Optional[int] = None
    note: Optional[str] = None


class ChandaCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    mobile: Optional[str] = None
    amount: float
    received_amount: Optional[float] = None
    collector: str
    payment_mode: PaymentMode = "Cash"
    status: Status = "Collected"
    date: str
    receipt_book_id: Optional[str] = None
    receipt_no: Optional[int] = None
    note: Optional[str] = None


class ChandaUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    mobile: Optional[str] = None
    amount: Optional[float] = None
    received_amount: Optional[float] = None
    collector: Optional[str] = None
    payment_mode: Optional[PaymentMode] = None
    status: Optional[Status] = None
    date: Optional[str] = None
    receipt_book_id: Optional[str] = None
    receipt_no: Optional[int] = None
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


class ExpenseBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    description: str
    vendor: Optional[str] = None
    category: ExpenseCategory = "Other"
    total_bill: float
    amount_paid: float = 0
    group_funds_used: float = 0
    personal_contribution: float = 0
    paid_by: str
    payment_mode: PaymentMode = "Cash"
    date: str
    note: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    description: Optional[str] = None
    vendor: Optional[str] = None
    category: Optional[ExpenseCategory] = None
    total_bill: Optional[float] = None
    amount_paid: Optional[float] = None
    group_funds_used: Optional[float] = None
    personal_contribution: Optional[float] = None
    paid_by: Optional[str] = None
    payment_mode: Optional[PaymentMode] = None
    date: Optional[str] = None
    note: Optional[str] = None
    voided: Optional[bool] = None


class Expense(ExpenseBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voided: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TransferBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    from_member: str
    to_member: str
    amount: float
    date: str
    note: Optional[str] = None


class TransferCreate(TransferBase):
    pass


class TransferUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    from_member: Optional[str] = None
    to_member: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    note: Optional[str] = None
    voided: Optional[bool] = None


class Transfer(TransferBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voided: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ReimbursementBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    paid_by: str  # member paying from group cash
    to_member: str  # member receiving reimbursement for personal contribution
    amount: float
    payment_mode: PaymentMode = "Cash"
    date: str
    note: Optional[str] = None


class ReimbursementCreate(ReimbursementBase):
    pass


class ReimbursementUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    paid_by: Optional[str] = None
    to_member: Optional[str] = None
    amount: Optional[float] = None
    payment_mode: Optional[PaymentMode] = None
    date: Optional[str] = None
    note: Optional[str] = None
    voided: Optional[bool] = None


class Reimbursement(ReimbursementBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    voided: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ReceiptBook(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Book 1"
    prefix: Optional[str] = None  # e.g., "B1"
    start_no: int = 1
    end_no: int = 50
    assigned_to: Optional[str] = None
    note: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ReceiptBookCreate(BaseModel):
    name: str
    prefix: Optional[str] = None
    start_no: int = 1
    end_no: int = 50
    assigned_to: Optional[str] = None
    note: Optional[str] = None


class ReceiptBookUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: Optional[str] = None
    prefix: Optional[str] = None
    start_no: Optional[int] = None
    end_no: Optional[int] = None
    assigned_to: Optional[str] = None
    note: Optional[str] = None


# ============= Balance Helpers =============
async def compute_held(member: str, exclude_transfer_id: Optional[str] = None,
                       exclude_expense_id: Optional[str] = None,
                       exclude_reimb_id: Optional[str] = None) -> float:
    chandas = await db.chandas.find({"voided": {"$ne": True}, "collector": member}, {"_id": 0}).to_list(50000)
    received = sum(c.get("received_amount", 0) for c in chandas)

    t_out = await db.transfers.find({"voided": {"$ne": True}, "from_member": member}, {"_id": 0}).to_list(50000)
    if exclude_transfer_id:
        t_out = [t for t in t_out if t["id"] != exclude_transfer_id]
    transferred_out = sum(t["amount"] for t in t_out)

    t_in = await db.transfers.find({"voided": {"$ne": True}, "to_member": member}, {"_id": 0}).to_list(50000)
    if exclude_transfer_id:
        t_in = [t for t in t_in if t["id"] != exclude_transfer_id]
    transferred_in = sum(t["amount"] for t in t_in)

    exps = await db.expenses.find({"voided": {"$ne": True}, "paid_by": member}, {"_id": 0}).to_list(50000)
    if exclude_expense_id:
        exps = [e for e in exps if e["id"] != exclude_expense_id]
    group_funds_paid = sum(e.get("group_funds_used", 0) for e in exps)

    reimbs = await db.reimbursements.find({"voided": {"$ne": True}, "paid_by": member}, {"_id": 0}).to_list(50000)
    if exclude_reimb_id:
        reimbs = [r for r in reimbs if r["id"] != exclude_reimb_id]
    reimbursement_paid_out = sum(r["amount"] for r in reimbs)

    return received - transferred_out + transferred_in - group_funds_paid - reimbursement_paid_out


async def compute_reimb_due(member: str, exclude_reimb_id: Optional[str] = None) -> float:
    exps = await db.expenses.find({"voided": {"$ne": True}, "paid_by": member}, {"_id": 0}).to_list(50000)
    personal = sum(e.get("personal_contribution", 0) for e in exps)
    reimbs = await db.reimbursements.find({"voided": {"$ne": True}, "to_member": member}, {"_id": 0}).to_list(50000)
    if exclude_reimb_id:
        reimbs = [r for r in reimbs if r["id"] != exclude_reimb_id]
    reimbursement_received = sum(r["amount"] for r in reimbs)
    return personal - reimbursement_received


async def _resolve_receipt_book_snapshot(book_id: Optional[str], receipt_no: Optional[int], exclude_chanda_id: Optional[str] = None):
    if not book_id:
        return None, None
    book = await db.receipt_books.find_one({"id": book_id}, {"_id": 0})
    if not book:
        raise HTTPException(400, "Receipt book not found")
    if receipt_no is None:
        return book["name"], None
    if receipt_no < book["start_no"] or receipt_no > book["end_no"]:
        raise HTTPException(400, f"Receipt {receipt_no} is outside {book['name']} range ({book['start_no']}-{book['end_no']})")
    q = {"receipt_book_id": book_id, "receipt_no": receipt_no, "voided": {"$ne": True}}
    if exclude_chanda_id:
        q["id"] = {"$ne": exclude_chanda_id}
    dup = await db.chandas.find_one(q, {"_id": 0})
    if dup:
        raise HTTPException(400, f"{book['name']} / Receipt {receipt_no} already used for {dup.get('name')}")
    return book["name"], receipt_no


# ============= Chanda Routes =============
@api_router.get("/")
async def root():
    return {"message": "Chanda Manager API", "version": "4.0"}


@api_router.post("/chanda", response_model=Chanda)
async def create_chanda(payload: ChandaCreate):
    data = payload.model_dump()
    if data["status"] == "Collected":
        if data.get("received_amount") is None:
            data["received_amount"] = data["amount"]
    else:
        data["received_amount"] = 0
    book_name, r_no = await _resolve_receipt_book_snapshot(data.get("receipt_book_id"), data.get("receipt_no"))
    data["receipt_book_name"] = book_name
    data["receipt_no"] = r_no
    chanda = Chanda(**data)
    if chanda.status == "Collected" and not chanda.collected_at:
        chanda.collected_at = datetime.now(timezone.utc).isoformat()
    await db.chandas.insert_one(chanda.model_dump())
    return chanda


@api_router.get("/chanda", response_model=List[Chanda])
async def list_chandas():
    docs = await db.chandas.find({}, {"_id": 0}).sort("date", -1).to_list(50000)
    for d in docs:
        if "received_amount" not in d:
            d["received_amount"] = d["amount"] if d.get("status") == "Collected" else 0
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
    new_status = update_data.get("status", existing.get("status"))
    new_amount = update_data.get("amount", existing.get("amount"))
    if "status" in update_data and "received_amount" not in update_data:
        update_data["received_amount"] = new_amount if new_status == "Collected" else 0
    if new_status == "Collected" and not existing.get("collected_at"):
        update_data["collected_at"] = datetime.now(timezone.utc).isoformat()
    if new_status == "Pending":
        update_data["collected_at"] = None
        update_data["received_amount"] = 0
    if "receipt_book_id" in update_data or "receipt_no" in update_data:
        merged_book = update_data.get("receipt_book_id", existing.get("receipt_book_id"))
        merged_no = update_data.get("receipt_no", existing.get("receipt_no"))
        book_name, r_no = await _resolve_receipt_book_snapshot(merged_book, merged_no, exclude_chanda_id=chanda_id)
        update_data["receipt_book_name"] = book_name
        update_data["receipt_no"] = r_no
    await db.chandas.update_one({"id": chanda_id}, {"$set": update_data})
    return await db.chandas.find_one({"id": chanda_id}, {"_id": 0})


@api_router.post("/chanda/{chanda_id}/receive", response_model=Chanda)
async def receive_chanda(chanda_id: str):
    existing = await db.chandas.find_one({"id": chanda_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Entry not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.chandas.update_one({"id": chanda_id}, {"$set": {
        "status": "Collected", "received_amount": existing["amount"],
        "collected_at": now, "updated_at": now,
    }})
    return await db.chandas.find_one({"id": chanda_id}, {"_id": 0})


@api_router.post("/chanda/{chanda_id}/void", response_model=Chanda)
async def void_chanda(chanda_id: str):
    existing = await db.chandas.find_one({"id": chanda_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Entry not found")
    await db.chandas.update_one({"id": chanda_id}, {"$set": {"voided": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.chandas.find_one({"id": chanda_id}, {"_id": 0})


@api_router.post("/chanda/{chanda_id}/unvoid", response_model=Chanda)
async def unvoid_chanda(chanda_id: str):
    existing = await db.chandas.find_one({"id": chanda_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Entry not found")
    await db.chandas.update_one({"id": chanda_id}, {"$set": {"voided": False, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.chandas.find_one({"id": chanda_id}, {"_id": 0})


@api_router.delete("/chanda/{chanda_id}")
async def delete_chanda(chanda_id: str):
    res = await db.chandas.delete_one({"id": chanda_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Entry not found")
    return {"ok": True}


# ============= Receipt Book Routes =============
@api_router.get("/receipt-books", response_model=List[ReceiptBook])
async def list_receipt_books():
    return await db.receipt_books.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@api_router.post("/receipt-books", response_model=ReceiptBook)
async def create_receipt_book(payload: ReceiptBookCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    dup = await db.receipt_books.find_one({"name": name}, {"_id": 0})
    if dup:
        raise HTTPException(400, "A receipt book with this name already exists")
    prefix = (payload.prefix or "").strip() or "".join(w[0] for w in name.split() if w).upper() or name[:2].upper()
    if payload.end_no < payload.start_no:
        raise HTTPException(400, "end_no must be ≥ start_no")
    book = ReceiptBook(name=name, prefix=prefix, start_no=payload.start_no, end_no=payload.end_no,
                      assigned_to=(payload.assigned_to or None), note=payload.note)
    await db.receipt_books.insert_one(book.model_dump())
    return book


@api_router.put("/receipt-books/{book_id}", response_model=ReceiptBook)
async def update_receipt_book(book_id: str, payload: ReceiptBookUpdate):
    existing = await db.receipt_books.find_one({"id": book_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Receipt book not found")
    update_data = payload.model_dump()
    # None-valued fields on required scalars mean "not sent" — skip them.
    # For nullable fields (assigned_to, note), None means "clear the value".
    for req in ("name", "prefix", "start_no", "end_no"):
        if update_data.get(req) is None:
            update_data.pop(req, None)
    if "name" in update_data:
        update_data["name"] = update_data["name"].strip()
        dup = await db.receipt_books.find_one({"name": update_data["name"], "id": {"$ne": book_id}}, {"_id": 0})
        if dup:
            raise HTTPException(400, "A receipt book with this name already exists")
    merged = {**existing, **update_data}
    if merged.get("end_no", 0) < merged.get("start_no", 0):
        raise HTTPException(400, "end_no must be ≥ start_no")
    await db.receipt_books.update_one({"id": book_id}, {"$set": update_data})
    # cascade name change to snapshot on chandas
    if "name" in update_data and update_data["name"] != existing["name"]:
        await db.chandas.update_many({"receipt_book_id": book_id}, {"$set": {"receipt_book_name": update_data["name"]}})
    return await db.receipt_books.find_one({"id": book_id}, {"_id": 0})


@api_router.get("/receipt-books/{book_id}/next")
async def next_receipt_no(book_id: str):
    book = await db.receipt_books.find_one({"id": book_id}, {"_id": 0})
    if not book:
        raise HTTPException(404, "Receipt book not found")
    used = await db.chandas.find({"receipt_book_id": book_id, "voided": {"$ne": True}, "receipt_no": {"$exists": True}}, {"_id": 0, "receipt_no": 1}).to_list(50000)
    used_nos = set(u.get("receipt_no") for u in used if u.get("receipt_no") is not None)
    for n in range(book["start_no"], book["end_no"] + 1):
        if n not in used_nos:
            return {"next": n, "used_count": len(used_nos), "total": book["end_no"] - book["start_no"] + 1}
    return {"next": None, "used_count": len(used_nos), "total": book["end_no"] - book["start_no"] + 1}


@api_router.delete("/receipt-books/{book_id}")
async def delete_receipt_book(book_id: str):
    in_use = await db.chandas.count_documents({"receipt_book_id": book_id})
    if in_use > 0:
        raise HTTPException(400, f"Cannot delete — {in_use} chanda entries reference this book")
    res = await db.receipt_books.delete_one({"id": book_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Receipt book not found")
    return {"ok": True}


# ============= Collector Routes =============
@api_router.get("/collectors", response_model=List[Collector])
async def list_collectors():
    return await db.collectors.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@api_router.post("/collectors", response_model=Collector)
async def create_collector(payload: CollectorCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    existing = await db.collectors.find_one({"name": name}, {"_id": 0})
    if existing:
        raise HTTPException(400, f"A collector named '{name}' already exists")
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
    dup = await db.collectors.find_one({"name": new_name, "id": {"$ne": collector_id}}, {"_id": 0})
    if dup:
        raise HTTPException(400, "A collector with this name already exists")
    await db.collectors.update_one({"id": collector_id}, {"$set": {"name": new_name}})
    ts = datetime.now(timezone.utc).isoformat()
    await db.chandas.update_many({"collector": old_name}, {"$set": {"collector": new_name, "updated_at": ts}})
    await db.expenses.update_many({"paid_by": old_name}, {"$set": {"paid_by": new_name, "updated_at": ts}})
    await db.transfers.update_many({"from_member": old_name}, {"$set": {"from_member": new_name, "updated_at": ts}})
    await db.transfers.update_many({"to_member": old_name}, {"$set": {"to_member": new_name, "updated_at": ts}})
    await db.reimbursements.update_many({"paid_by": old_name}, {"$set": {"paid_by": new_name, "updated_at": ts}})
    await db.reimbursements.update_many({"to_member": old_name}, {"$set": {"to_member": new_name, "updated_at": ts}})
    return await db.collectors.find_one({"id": collector_id}, {"_id": 0})


@api_router.delete("/collectors/{collector_id}")
async def delete_collector(collector_id: str):
    res = await db.collectors.delete_one({"id": collector_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Collector not found")
    return {"ok": True}


# ============= Expense Routes =============
def _validate_expense_split(data: dict):
    if data.get("amount_paid", 0) < 0 or data.get("total_bill", 0) < 0:
        raise HTTPException(400, "Amounts cannot be negative")
    if data.get("group_funds_used", 0) < 0 or data.get("personal_contribution", 0) < 0:
        raise HTTPException(400, "Payment source amounts cannot be negative")
    if data.get("amount_paid", 0) > data.get("total_bill", 0) + 1e-6:
        raise HTTPException(400, "Amount Paid cannot exceed Total Bill")
    split_sum = data.get("group_funds_used", 0) + data.get("personal_contribution", 0)
    if abs(split_sum - data.get("amount_paid", 0)) > 0.01:
        raise HTTPException(400, f"Group Funds + Personal Contribution must equal Amount Paid ({split_sum:.0f} ≠ {data.get('amount_paid', 0):.0f})")


@api_router.post("/expenses", response_model=Expense)
async def create_expense(payload: ExpenseCreate):
    data = payload.model_dump()
    _validate_expense_split(data)
    if data["group_funds_used"] > 0:
        held = await compute_held(data["paid_by"])
        if data["group_funds_used"] > held + 1e-6:
            raise HTTPException(400, f"{data['paid_by']} has only ₹{held:.0f} group cash available — cannot use ₹{data['group_funds_used']:.0f}")
    exp = Expense(**data)
    await db.expenses.insert_one(exp.model_dump())
    return exp


@api_router.get("/expenses", response_model=List[Expense])
async def list_expenses():
    docs = await db.expenses.find({}, {"_id": 0}).sort("date", -1).to_list(10000)
    for d in docs:
        if "total_bill" not in d:
            d["total_bill"] = d.get("amount", 0)
        if "amount_paid" not in d:
            d["amount_paid"] = d.get("amount", 0)
        if "group_funds_used" not in d:
            d["group_funds_used"] = d.get("amount_paid", 0)
        if "personal_contribution" not in d:
            d["personal_contribution"] = 0
        if "paid_by" not in d or d.get("paid_by") is None:
            d["paid_by"] = ""
    return docs


@api_router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, payload: ExpenseUpdate):
    existing = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Expense not found")
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = {**existing, **update_data}
    _validate_expense_split(merged)
    if not merged.get("voided") and merged.get("group_funds_used", 0) > 0:
        held = await compute_held(merged["paid_by"], exclude_expense_id=expense_id)
        if merged["group_funds_used"] > held + 1e-6:
            raise HTTPException(400, f"{merged['paid_by']} has only ₹{held:.0f} group cash available")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.expenses.update_one({"id": expense_id}, {"$set": update_data})
    return await db.expenses.find_one({"id": expense_id}, {"_id": 0})


@api_router.post("/expenses/{expense_id}/void", response_model=Expense)
async def void_expense(expense_id: str):
    existing = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Expense not found")
    await db.expenses.update_one({"id": expense_id}, {"$set": {"voided": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.expenses.find_one({"id": expense_id}, {"_id": 0})


@api_router.post("/expenses/{expense_id}/unvoid", response_model=Expense)
async def unvoid_expense(expense_id: str):
    existing = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Expense not found")
    if existing.get("group_funds_used", 0) > 0:
        held = await compute_held(existing["paid_by"], exclude_expense_id=expense_id)
        if existing["group_funds_used"] > held + 1e-6:
            raise HTTPException(400, f"Cannot restore — {existing['paid_by']} would overdraw")
    await db.expenses.update_one({"id": expense_id}, {"$set": {"voided": False, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.expenses.find_one({"id": expense_id}, {"_id": 0})


@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str):
    res = await db.expenses.delete_one({"id": expense_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Expense not found")
    return {"ok": True}


# ============= Transfer Routes =============
@api_router.post("/transfers", response_model=Transfer)
async def create_transfer(payload: TransferCreate):
    data = payload.model_dump()
    if data["amount"] <= 0:
        raise HTTPException(400, "Amount must be positive")
    if data["from_member"] == data["to_member"]:
        raise HTTPException(400, "From and To members must differ")
    held = await compute_held(data["from_member"])
    if data["amount"] > held + 1e-6:
        raise HTTPException(400, f"{data['from_member']} has only ₹{held:.0f} available")
    tr = Transfer(**data)
    await db.transfers.insert_one(tr.model_dump())
    return tr


@api_router.get("/transfers", response_model=List[Transfer])
async def list_transfers():
    return await db.transfers.find({}, {"_id": 0}).sort("date", -1).to_list(10000)


@api_router.put("/transfers/{transfer_id}", response_model=Transfer)
async def update_transfer(transfer_id: str, payload: TransferUpdate):
    existing = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Transfer not found")
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = {**existing, **update_data}
    if merged["from_member"] == merged["to_member"]:
        raise HTTPException(400, "From and To members must differ")
    if not merged.get("voided"):
        held = await compute_held(merged["from_member"], exclude_transfer_id=transfer_id)
        if merged["amount"] > held + 1e-6:
            raise HTTPException(400, f"{merged['from_member']} would overdraw")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.transfers.update_one({"id": transfer_id}, {"$set": update_data})
    return await db.transfers.find_one({"id": transfer_id}, {"_id": 0})


@api_router.post("/transfers/{transfer_id}/void", response_model=Transfer)
async def void_transfer(transfer_id: str):
    existing = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Transfer not found")
    await db.transfers.update_one({"id": transfer_id}, {"$set": {"voided": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.transfers.find_one({"id": transfer_id}, {"_id": 0})


@api_router.post("/transfers/{transfer_id}/unvoid", response_model=Transfer)
async def unvoid_transfer(transfer_id: str):
    existing = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Transfer not found")
    held = await compute_held(existing["from_member"], exclude_transfer_id=transfer_id)
    if existing["amount"] > held + 1e-6:
        raise HTTPException(400, f"Cannot restore — {existing['from_member']} would overdraw")
    await db.transfers.update_one({"id": transfer_id}, {"$set": {"voided": False, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.transfers.find_one({"id": transfer_id}, {"_id": 0})


@api_router.delete("/transfers/{transfer_id}")
async def delete_transfer(transfer_id: str):
    res = await db.transfers.delete_one({"id": transfer_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Transfer not found")
    return {"ok": True}


# ============= Reimbursement Routes =============
@api_router.post("/reimbursements", response_model=Reimbursement)
async def create_reimbursement(payload: ReimbursementCreate):
    data = payload.model_dump()
    if data["amount"] <= 0:
        raise HTTPException(400, "Amount must be positive")
    if data["paid_by"] == data["to_member"]:
        raise HTTPException(400, "Cannot reimburse yourself")
    held = await compute_held(data["paid_by"])
    if data["amount"] > held + 1e-6:
        raise HTTPException(400, f"{data['paid_by']} has only ₹{held:.0f} group cash to reimburse")
    due = await compute_reimb_due(data["to_member"])
    if data["amount"] > due + 1e-6:
        raise HTTPException(400, f"{data['to_member']} is owed only ₹{due:.0f} — cannot reimburse ₹{data['amount']:.0f}")
    r = Reimbursement(**data)
    await db.reimbursements.insert_one(r.model_dump())
    return r


@api_router.get("/reimbursements", response_model=List[Reimbursement])
async def list_reimbursements():
    return await db.reimbursements.find({}, {"_id": 0}).sort("date", -1).to_list(10000)


@api_router.put("/reimbursements/{reimb_id}", response_model=Reimbursement)
async def update_reimbursement(reimb_id: str, payload: ReimbursementUpdate):
    existing = await db.reimbursements.find_one({"id": reimb_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Reimbursement not found")
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = {**existing, **update_data}
    if merged["paid_by"] == merged["to_member"]:
        raise HTTPException(400, "Cannot reimburse yourself")
    if not merged.get("voided"):
        held = await compute_held(merged["paid_by"], exclude_reimb_id=reimb_id)
        if merged["amount"] > held + 1e-6:
            raise HTTPException(400, f"{merged['paid_by']} would overdraw group cash")
        due = await compute_reimb_due(merged["to_member"], exclude_reimb_id=reimb_id)
        if merged["amount"] > due + 1e-6:
            raise HTTPException(400, f"{merged['to_member']} is owed only ₹{due:.0f}")
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.reimbursements.update_one({"id": reimb_id}, {"$set": update_data})
    return await db.reimbursements.find_one({"id": reimb_id}, {"_id": 0})


@api_router.post("/reimbursements/{reimb_id}/void", response_model=Reimbursement)
async def void_reimbursement(reimb_id: str):
    existing = await db.reimbursements.find_one({"id": reimb_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Reimbursement not found")
    await db.reimbursements.update_one({"id": reimb_id}, {"$set": {"voided": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.reimbursements.find_one({"id": reimb_id}, {"_id": 0})


@api_router.post("/reimbursements/{reimb_id}/unvoid", response_model=Reimbursement)
async def unvoid_reimbursement(reimb_id: str):
    existing = await db.reimbursements.find_one({"id": reimb_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Reimbursement not found")
    held = await compute_held(existing["paid_by"], exclude_reimb_id=reimb_id)
    if existing["amount"] > held + 1e-6:
        raise HTTPException(400, f"{existing['paid_by']} would overdraw")
    due = await compute_reimb_due(existing["to_member"], exclude_reimb_id=reimb_id)
    if existing["amount"] > due + 1e-6:
        raise HTTPException(400, f"{existing['to_member']} not owed enough")
    await db.reimbursements.update_one({"id": reimb_id}, {"$set": {"voided": False, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.reimbursements.find_one({"id": reimb_id}, {"_id": 0})


@api_router.delete("/reimbursements/{reimb_id}")
async def delete_reimbursement(reimb_id: str):
    res = await db.reimbursements.delete_one({"id": reimb_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Reimbursement not found")
    return {"ok": True}


# ============= Member Summary =============
async def build_member_summaries():
    collectors = await db.collectors.find({}, {"_id": 0}).to_list(1000)
    names = set(c["name"] for c in collectors)
    for d in await db.chandas.find({"voided": {"$ne": True}}, {"_id": 0, "collector": 1}).to_list(50000):
        names.add(d["collector"])
    for d in await db.expenses.find({"voided": {"$ne": True}}, {"_id": 0, "paid_by": 1}).to_list(50000):
        if d.get("paid_by"): names.add(d["paid_by"])
    for d in await db.transfers.find({"voided": {"$ne": True}}, {"_id": 0}).to_list(50000):
        names.add(d["from_member"]); names.add(d["to_member"])
    for d in await db.reimbursements.find({"voided": {"$ne": True}}, {"_id": 0}).to_list(50000):
        names.add(d["paid_by"]); names.add(d["to_member"])

    result = []
    for name in sorted(names):
        chandas = await db.chandas.find({"voided": {"$ne": True}, "collector": name}, {"_id": 0}).to_list(50000)
        total_promised = sum(c["amount"] for c in chandas)
        total_received = sum(c.get("received_amount", 0) for c in chandas)
        total_pending = total_promised - total_received
        count_collections = len(chandas)

        t_out = await db.transfers.find({"voided": {"$ne": True}, "from_member": name}, {"_id": 0}).to_list(50000)
        transferred_out = sum(t["amount"] for t in t_out)
        t_in = await db.transfers.find({"voided": {"$ne": True}, "to_member": name}, {"_id": 0}).to_list(50000)
        transferred_in = sum(t["amount"] for t in t_in)

        exps = await db.expenses.find({"voided": {"$ne": True}, "paid_by": name}, {"_id": 0}).to_list(50000)
        group_funds_paid = sum(e.get("group_funds_used", 0) for e in exps)
        personal_contribution = sum(e.get("personal_contribution", 0) for e in exps)

        r_out = await db.reimbursements.find({"voided": {"$ne": True}, "paid_by": name}, {"_id": 0}).to_list(50000)
        reimbursement_paid_out = sum(r["amount"] for r in r_out)
        r_in = await db.reimbursements.find({"voided": {"$ne": True}, "to_member": name}, {"_id": 0}).to_list(50000)
        reimbursement_received = sum(r["amount"] for r in r_in)

        current_held = received_group_calc = total_received - transferred_out + transferred_in - group_funds_paid - reimbursement_paid_out
        reimbursement_due = personal_contribution - reimbursement_received

        result.append({
            "name": name,
            "total_promised": total_promised,
            "total_received": total_received,
            "total_pending": total_pending,
            "count_collections": count_collections,
            "transferred_out": transferred_out,
            "transferred_in": transferred_in,
            "group_funds_paid": group_funds_paid,
            "personal_contribution": personal_contribution,
            "reimbursement_paid_out": reimbursement_paid_out,
            "reimbursement_received": reimbursement_received,
            "reimbursement_due": reimbursement_due,
            "paid_to_expenses": group_funds_paid + personal_contribution,  # back-compat total
            "current_held": current_held,
        })
    return result


@api_router.get("/members/summary")
async def members_summary():
    return {"members": await build_member_summaries()}


@api_router.get("/members/{name}")
async def member_detail(name: str):
    chandas = await db.chandas.find({"collector": name}, {"_id": 0}).sort("date", -1).to_list(50000)
    t_out = await db.transfers.find({"from_member": name}, {"_id": 0}).sort("date", -1).to_list(50000)
    t_in = await db.transfers.find({"to_member": name}, {"_id": 0}).sort("date", -1).to_list(50000)
    exps = await db.expenses.find({"paid_by": name}, {"_id": 0}).sort("date", -1).to_list(50000)
    r_out = await db.reimbursements.find({"paid_by": name}, {"_id": 0}).sort("date", -1).to_list(50000)
    r_in = await db.reimbursements.find({"to_member": name}, {"_id": 0}).sort("date", -1).to_list(50000)
    summaries = await build_member_summaries()
    summary = next((s for s in summaries if s["name"] == name), None)
    if summary is None:
        raise HTTPException(404, "Member not found in any transaction")
    return {
        "summary": summary,
        "chandas": chandas,
        "transfers_out": t_out,
        "transfers_in": t_in,
        "expenses": exps,
        "reimbursements_out": r_out,  # reimbursements this member paid to others
        "reimbursements_in": r_in,    # reimbursements this member received
    }


# ============= Ledger =============
@api_router.get("/ledger")
async def ledger():
    entries = []
    async for c in db.chandas.find({}, {"_id": 0}):
        entries.append({
            "date": c["date"], "type": "chanda",
            "from_party": c["name"], "to_party": c["collector"],
            "amount": c.get("received_amount", 0), "promised": c["amount"],
            "status": c.get("status"), "voided": c.get("voided", False),
            "payment_mode": c.get("payment_mode"), "ref_id": c["id"],
            "created_at": c.get("created_at"),
        })
    async for t in db.transfers.find({}, {"_id": 0}):
        entries.append({
            "date": t["date"], "type": "transfer",
            "from_party": t["from_member"], "to_party": t["to_member"],
            "amount": t["amount"], "voided": t.get("voided", False),
            "ref_id": t["id"], "note": t.get("note"),
            "created_at": t.get("created_at"),
        })
    async for e in db.expenses.find({}, {"_id": 0}):
        entries.append({
            "date": e["date"], "type": "expense",
            "from_party": e.get("paid_by") or "-",
            "to_party": e.get("vendor") or e["description"],
            "amount": e.get("amount_paid", 0),
            "group_funds_used": e.get("group_funds_used", 0),
            "personal_contribution": e.get("personal_contribution", 0),
            "total_bill": e.get("total_bill", 0),
            "voided": e.get("voided", False), "ref_id": e["id"],
            "description": e["description"],
            "created_at": e.get("created_at"),
        })
    async for r in db.reimbursements.find({}, {"_id": 0}):
        entries.append({
            "date": r["date"], "type": "reimbursement",
            "from_party": r["paid_by"], "to_party": r["to_member"],
            "amount": r["amount"], "voided": r.get("voided", False),
            "payment_mode": r.get("payment_mode"), "ref_id": r["id"],
            "note": r.get("note"),
            "created_at": r.get("created_at"),
        })
    entries.sort(key=lambda x: (x.get("created_at") or "", x["date"], x.get("ref_id", "")), reverse=True)
    return {"entries": entries}


# ============= Dashboard =============
@api_router.get("/dashboard")
async def dashboard():
    chandas = await db.chandas.find({"voided": {"$ne": True}}, {"_id": 0}).to_list(50000)
    expenses = await db.expenses.find({"voided": {"$ne": True}}, {"_id": 0}).to_list(50000)
    transfers = await db.transfers.find({"voided": {"$ne": True}}, {"_id": 0}).to_list(50000)
    reimbs = await db.reimbursements.find({"voided": {"$ne": True}}, {"_id": 0}).to_list(50000)

    total_promised = sum(c["amount"] for c in chandas)
    total_received = sum(c.get("received_amount", 0) for c in chandas)
    total_pending = total_promised - total_received
    count_collected = sum(1 for c in chandas if c.get("status") == "Collected")
    count_pending = sum(1 for c in chandas if c.get("status") == "Pending")

    by_mode = {}
    for c in chandas:
        by_mode[c["payment_mode"]] = by_mode.get(c["payment_mode"], 0) + c.get("received_amount", 0)
    by_collector = {}
    for c in chandas:
        by_collector[c["collector"]] = by_collector.get(c["collector"], 0) + c.get("received_amount", 0)

    total_bill = sum(e.get("total_bill", 0) for e in expenses)
    total_paid = sum(e.get("amount_paid", 0) for e in expenses)
    total_payable = total_bill - total_paid
    total_group_funds_used = sum(e.get("group_funds_used", 0) for e in expenses)
    total_personal_contribution = sum(e.get("personal_contribution", 0) for e in expenses)
    total_reimbursed = sum(r["amount"] for r in reimbs)
    total_reimbursement_outstanding = total_personal_contribution - total_reimbursed

    by_expense_category = {}
    for e in expenses:
        by_expense_category[e["category"]] = by_expense_category.get(e["category"], 0) + e.get("amount_paid", 0)

    cash_held = total_received - total_group_funds_used - total_reimbursed
    remaining_balance = cash_held

    return {
        "chanda": {
            "total_promised": total_promised,
            "total_received": total_received,
            "total_pending": total_pending,
            "count_collected": count_collected,
            "count_pending": count_pending,
            "count_total": len(chandas),
            "by_payment_mode": by_mode,
            "by_collector": by_collector,
        },
        "expenses": {
            "total_bill": total_bill,
            "total_paid": total_paid,
            "total_payable": total_payable,
            "group_funds_used": total_group_funds_used,
            "personal_contribution": total_personal_contribution,
            "count": len(expenses),
            "by_category": by_expense_category,
        },
        "transfers": {"count": len(transfers), "total_amount": sum(t["amount"] for t in transfers)},
        "reimbursements": {
            "total_reimbursed": total_reimbursed,
            "total_personal_contribution": total_personal_contribution,
            "outstanding": total_reimbursement_outstanding,
            "count": len(reimbs),
        },
        "money_position": {
            "cash_held": cash_held,
            "total_paid_to_expenses_group": total_group_funds_used,
            "total_paid_to_expenses": total_paid,
        },
        "balance": remaining_balance,
        "members": await build_member_summaries(),
        # back-compat flat fields
        "total_expected": total_promised,
        "total_collected": total_received,
        "total_pending": total_pending,
        "count_collected": count_collected,
        "count_pending": count_pending,
        "count_total": len(chandas),
        "by_payment_mode": by_mode,
        "by_collector": by_collector,
        "total_expenses": total_paid,
        "count_expenses": len(expenses),
        "by_expense_category": by_expense_category,
    }


# ============= Backup =============
@api_router.get("/backup")
async def backup():
    return {
        "version": 5,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "chandas": await db.chandas.find({}, {"_id": 0}).to_list(50000),
        "collectors": await db.collectors.find({}, {"_id": 0}).to_list(1000),
        "expenses": await db.expenses.find({}, {"_id": 0}).to_list(50000),
        "transfers": await db.transfers.find({}, {"_id": 0}).to_list(50000),
        "reimbursements": await db.reimbursements.find({}, {"_id": 0}).to_list(50000),
        "receipt_books": await db.receipt_books.find({}, {"_id": 0}).to_list(1000),
    }


class RestorePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    chandas: List[dict] = []
    collectors: List[dict] = []
    expenses: List[dict] = []
    transfers: List[dict] = []
    reimbursements: List[dict] = []
    receipt_books: List[dict] = []
    mode: Literal["replace", "merge"] = "merge"


@api_router.post("/restore")
async def restore(payload: RestorePayload):
    if payload.mode == "replace":
        for coll in ("chandas", "collectors", "expenses", "transfers", "reimbursements", "receipt_books"):
            await db[coll].delete_many({})
    for coll, items in [
        ("chandas", payload.chandas), ("collectors", payload.collectors),
        ("expenses", payload.expenses), ("transfers", payload.transfers),
        ("reimbursements", payload.reimbursements), ("receipt_books", payload.receipt_books),
    ]:
        for it in items:
            it.pop("_id", None)
            if "id" not in it:
                it["id"] = str(uuid.uuid4())
            await db[coll].update_one({"id": it["id"]}, {"$set": it}, upsert=True)
    return {
        "ok": True,
        "chandas_restored": len(payload.chandas),
        "collectors_restored": len(payload.collectors),
        "expenses_restored": len(payload.expenses),
        "transfers_restored": len(payload.transfers),
        "reimbursements_restored": len(payload.reimbursements),
        "receipt_books_restored": len(payload.receipt_books),
    }


# ============= Seed (idempotent) =============
@api_router.post("/seed")
async def seed():
    existing = await db.chandas.count_documents({})
    if existing > 0:
        return {"seeded": False, "reason": "data already exists"}
    default_collectors = ["Monu", "Shrikant", "Amit Sharma", "Pooja Iyer"]
    for name in default_collectors:
        await db.collectors.insert_one(Collector(name=name).model_dump())
    book1 = ReceiptBook(name="Book 1", prefix="B1", start_no=1, end_no=50, assigned_to="Monu")
    book2 = ReceiptBook(name="Book 2", prefix="B2", start_no=51, end_no=100, assigned_to="Shrikant")
    await db.receipt_books.insert_one(book1.model_dump())
    await db.receipt_books.insert_one(book2.model_dump())
    today = date.today().isoformat()
    demo_chandas = [
        {"name": "Ramesh Kumar", "mobile": "98111 22001", "amount": 2000, "collector": "Shrikant", "payment_mode": "Cash", "status": "Collected", "receipt_book_id": book2.id, "receipt_book_name": book2.name, "receipt_no": 51},
        {"name": "Anita Sharma", "mobile": "98111 22002", "amount": 3000, "collector": "Monu", "payment_mode": "UPI", "status": "Collected", "receipt_book_id": book1.id, "receipt_book_name": book1.name, "receipt_no": 1},
        {"name": "Vijay Singh", "mobile": "98111 22003", "amount": 5000, "collector": "Monu", "payment_mode": "Cash", "status": "Collected", "receipt_book_id": book1.id, "receipt_book_name": book1.name, "receipt_no": 2},
        {"name": "Sunita Devi", "amount": 2000, "collector": "Monu", "payment_mode": "UPI", "status": "Collected", "receipt_book_id": book1.id, "receipt_book_name": book1.name, "receipt_no": 3},
        {"name": "Prakash Jain", "amount": 5000, "collector": "Amit Sharma", "payment_mode": "Bank Transfer", "status": "Pending"},
    ]
    for d in demo_chandas:
        entry_data = {**d, "date": today, "received_amount": d["amount"] if d["status"] == "Collected" else 0}
        entry = Chanda(**entry_data)
        if entry.status == "Collected":
            entry.collected_at = datetime.now(timezone.utc).isoformat()
        await db.chandas.insert_one(entry.model_dump())
    await db.transfers.insert_one(Transfer(
        from_member="Shrikant", to_member="Monu", amount=2000, date=today,
        note="Handing over collection to Monu",
    ).model_dump())
    await db.expenses.insert_one(Expense(
        description="Murti Purchase", vendor="Murti Wale", category="Decoration",
        total_bill=65000, amount_paid=12000, group_funds_used=12000, personal_contribution=0,
        paid_by="Monu", payment_mode="Cash", date=today, note="Advance payment",
    ).model_dump())
    return {"seeded": True, "chandas": len(demo_chandas), "collectors": len(default_collectors), "transfers": 1, "expenses": 1}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware, allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def migrate_legacy():
    async for c in db.chandas.find({"received_amount": {"$exists": False}}):
        received = c.get("amount", 0) if c.get("status") == "Collected" else 0
        await db.chandas.update_one({"_id": c["_id"]}, {"$set": {"received_amount": received}})
    async for e in db.expenses.find({"total_bill": {"$exists": False}}):
        legacy = e.get("amount", 0)
        await db.expenses.update_one({"_id": e["_id"]}, {"$set": {
            "total_bill": legacy, "amount_paid": legacy,
            "group_funds_used": legacy, "personal_contribution": 0,
        }})
    async for e in db.expenses.find({"group_funds_used": {"$exists": False}}):
        amt = e.get("amount_paid", 0)
        await db.expenses.update_one({"_id": e["_id"]}, {"$set": {"group_funds_used": amt, "personal_contribution": 0}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
