"""
Admin REST API for license management (JSON).
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.deps import CurrentAdmin, DbSession
from app.models import License
from app.schemas import LicenseCreate, LicenseOut, LicenseUpdate
from app.mongo import get_mongo_db
from app.services import license_service as svc
from app.services import mongo_license_service as msvc

router = APIRouter(prefix="/api/licenses", tags=["licenses"])
settings = get_settings()


def license_to_out(db: Session, lic: License) -> LicenseOut:
    """Map ORM license to API schema including device count."""
    if getattr(lic, "devices", None) is not None:
        registered = len(lic.devices)
    else:
        registered = svc.count_devices_for_license(db, lic.id)
    return LicenseOut(
        id=lic.id,
        license_key=lic.license_key,
        username=lic.username,
        plan=lic.plan,
        device_limit=lic.device_limit,
        status=lic.status,
        expiry_date=lic.expiry_date,
        created_at=lic.created_at,
        registered_devices=registered,
    )


def _get_lic_eager(db: Session, license_id: int) -> License | None:
    stmt = (
        select(License)
        .where(License.id == license_id)
        .options(selectinload(License.devices))
    )
    return db.scalars(stmt).first()


@router.get("", response_model=list[LicenseOut])
async def api_list_licenses(
    db: DbSession,
    _: CurrentAdmin,
) -> list[LicenseOut]:
    """List all licenses (newest first)."""
    if settings.mongodb_uri:
        mdb = get_mongo_db()
        return await msvc.list_licenses(mdb)
    rows = svc.list_licenses(db)
    return [license_to_out(db, r) for r in rows]


@router.post("", response_model=LicenseOut, status_code=status.HTTP_201_CREATED)
async def api_create_license(
    db: DbSession,
    _: CurrentAdmin,
    body: LicenseCreate,
) -> LicenseOut:
    """Create a new license and return it with key."""
    if settings.mongodb_uri:
        mdb = get_mongo_db()
        return await msvc.create_license(mdb, body)
    lic = svc.create_license(db, body)
    lic = _get_lic_eager(db, lic.id) or lic
    return license_to_out(db, lic)


@router.patch("/{license_id}", response_model=LicenseOut)
async def api_update_license(
    db: DbSession,
    _: CurrentAdmin,
    license_id: int,
    body: LicenseUpdate,
) -> LicenseOut:
    """Update editable fields on a license."""
    if settings.mongodb_uri:
        mdb = get_mongo_db()
        try:
            return await msvc.update_license(mdb, license_id, body)
        except KeyError:
            raise HTTPException(status_code=404, detail="License not found") from None
    lic = _get_lic_eager(db, license_id)
    if lic is None:
        raise HTTPException(status_code=404, detail="License not found")
    lic = svc.update_license(db, lic, body)
    lic = _get_lic_eager(db, lic.id) or lic
    return license_to_out(db, lic)


@router.post("/{license_id}/block", response_model=LicenseOut)
async def api_toggle_block(
    db: DbSession,
    _: CurrentAdmin,
    license_id: int,
) -> LicenseOut:
    """Toggle blocked status."""
    if settings.mongodb_uri:
        mdb = get_mongo_db()
        try:
            return await msvc.toggle_block(mdb, license_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="License not found") from None
    lic = _get_lic_eager(db, license_id)
    if lic is None:
        raise HTTPException(status_code=404, detail="License not found")
    lic = svc.toggle_block(db, lic)
    lic = _get_lic_eager(db, lic.id) or lic
    return license_to_out(db, lic)


@router.delete("/{license_id}", status_code=status.HTTP_204_NO_CONTENT)
async def api_delete_license(
    db: DbSession,
    _: CurrentAdmin,
    license_id: int,
) -> None:
    """Delete a license permanently."""
    if settings.mongodb_uri:
        mdb = get_mongo_db()
        try:
            await msvc.delete_license(mdb, license_id)
            return None
        except KeyError:
            raise HTTPException(status_code=404, detail="License not found") from None
    lic = db.get(License, license_id)
    if lic is None:
        raise HTTPException(status_code=404, detail="License not found")
    svc.delete_license(db, lic)
