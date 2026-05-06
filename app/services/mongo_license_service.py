"""
MongoDB implementation of license CRUD + validation.

Collections:
- licenses: one document per license key
- license_devices: one document per (license_key, hwid)
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError
from pymongo import ReturnDocument

from app.models import LicenseStatus, new_license_key
from app.mongo import utcnow
from app.schemas import LicenseCreate, LicenseOut, LicenseUpdate, ValidateResponse, ValidateResult

DEFAULT_LICENSE_VALIDITY_DAYS = 365


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _doc_to_out(doc: dict, registered_devices: int) -> LicenseOut:
    return LicenseOut(
        id=int(doc["id"]),
        license_key=str(doc["license_key"]),
        username=str(doc["username"]),
        plan=str(doc.get("plan", "")),
        device_limit=int(doc["device_limit"]),
        status=LicenseStatus(str(doc["status"])),
        expiry_date=_as_utc(doc["expiry_date"]),
        created_at=_as_utc(doc["created_at"]),
        registered_devices=int(registered_devices),
    )


async def _count_devices(db: AsyncIOMotorDatabase, license_key: str) -> int:
    return int(await db["license_devices"].count_documents({"license_key": license_key}))


async def list_licenses(db: AsyncIOMotorDatabase) -> list[LicenseOut]:
    out: list[LicenseOut] = []
    async for doc in db["licenses"].find({}, sort=[("created_at", -1)]):
        used = await _count_devices(db, doc["license_key"])
        out.append(_doc_to_out(doc, used))
    return out


async def create_license(db: AsyncIOMotorDatabase, data: LicenseCreate) -> LicenseOut:
    if data.expiry_date is not None:
        expiry = data.expiry_date
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
    else:
        expiry = utcnow() + timedelta(days=DEFAULT_LICENSE_VALIDITY_DAYS)

    # Use an integer id for UI compatibility (auto-increment via counters).
    counters = db["counters"]
    seq = await counters.find_one_and_update(
        {"_id": "licenses"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    next_id = int(seq["seq"])

    # Generate a unique 6-digit key (retry on collision).
    for _ in range(30):
        doc = {
            "id": next_id,
            "license_key": new_license_key(),
            "username": data.username.strip(),
            "plan": (data.plan or "").strip(),
            "device_limit": int(data.device_limit),
            "status": LicenseStatus.ACTIVE.value,
            "expiry_date": expiry,
            "created_at": utcnow(),
        }
        try:
            await db["licenses"].insert_one(doc)
            return _doc_to_out(doc, registered_devices=0)
        except DuplicateKeyError:
            continue
    raise RuntimeError("Failed to generate unique license key")


async def update_license(db: AsyncIOMotorDatabase, license_id: int, data: LicenseUpdate) -> LicenseOut:
    update: dict = {}
    if data.username is not None:
        update["username"] = data.username.strip()
    if data.plan is not None:
        update["plan"] = data.plan.strip()
    if data.device_limit is not None:
        update["device_limit"] = int(data.device_limit)
    if data.status is not None:
        update["status"] = data.status.value
    if data.expiry_date is not None:
        ed = data.expiry_date
        if ed.tzinfo is None:
            ed = ed.replace(tzinfo=timezone.utc)
        update["expiry_date"] = ed

    doc = await db["licenses"].find_one_and_update(
        {"id": int(license_id)},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise KeyError("License not found")
    used = await _count_devices(db, doc["license_key"])
    return _doc_to_out(doc, used)


async def toggle_block(db: AsyncIOMotorDatabase, license_id: int) -> LicenseOut:
    doc = await db["licenses"].find_one({"id": int(license_id)})
    if not doc:
        raise KeyError("License not found")
    blocked = doc.get("status") == LicenseStatus.BLOCKED.value
    new_status = LicenseStatus.ACTIVE.value if blocked else LicenseStatus.BLOCKED.value
    doc = await db["licenses"].find_one_and_update(
        {"id": int(license_id)},
        {"$set": {"status": new_status}},
        return_document=ReturnDocument.AFTER,
    )
    used = await _count_devices(db, doc["license_key"])
    return _doc_to_out(doc, used)


async def delete_license(db: AsyncIOMotorDatabase, license_id: int) -> None:
    doc = await db["licenses"].find_one({"id": int(license_id)})
    if not doc:
        raise KeyError("License not found")
    key = doc["license_key"]
    await db["licenses"].delete_one({"id": int(license_id)})
    await db["license_devices"].delete_many({"license_key": key})


async def validate_license(db: AsyncIOMotorDatabase, license_key: str, hwid: str) -> ValidateResponse:
    key = license_key.strip()
    hw = hwid.strip()
    lic = await db["licenses"].find_one({"license_key": key})
    if not lic:
        return ValidateResponse(
            valid=False,
            result=ValidateResult.INVALID_KEY,
            message="License key not found.",
        )
    if lic.get("status") == LicenseStatus.BLOCKED.value:
        return ValidateResponse(
            valid=False,
            result=ValidateResult.BLOCKED,
            message="License is blocked.",
        )

    now = utcnow()
    if _as_utc(lic["expiry_date"]) < now:
        return ValidateResponse(
            valid=False,
            result=ValidateResult.EXPIRED,
            message="License has expired.",
        )

    existing = await db["license_devices"].find_one({"license_key": key, "hwid": hw})
    if existing:
        return ValidateResponse(
            valid=True,
            result=ValidateResult.VALID,
            message="License valid for this device.",
        )

    used = await _count_devices(db, key)
    if used >= int(lic["device_limit"]):
        return ValidateResponse(
            valid=False,
            result=ValidateResult.DEVICE_LIMIT,
            message="Device limit reached for this license.",
        )

    await db["license_devices"].insert_one({"license_key": key, "hwid": hw, "created_at": utcnow()})
    return ValidateResponse(
        valid=True,
        result=ValidateResult.VALID,
        message="License valid; device registered.",
    )

