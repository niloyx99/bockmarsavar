"""
License CRUD and validation logic.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import License, LicenseDevice, LicenseStatus, new_license_key
from app.schemas import LicenseCreate, LicenseUpdate, ValidateResponse, ValidateResult

# Default validity when clients do not send expiry_date (no UI field for this).
DEFAULT_LICENSE_VALIDITY_DAYS = 365


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    """Normalize datetimes from the DB (SQLite may return naive values)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def list_licenses(db: Session) -> list[License]:
    """Return all licenses with device counts preloaded."""
    stmt = (
        select(License)
        .options(selectinload(License.devices))
        .order_by(License.created_at.desc())
    )
    return list(db.scalars(stmt).unique().all())


def get_license_by_id(db: Session, license_id: int) -> License | None:
    """Fetch one license by primary key."""
    return db.get(License, license_id)


def get_license_by_key(db: Session, license_key: str) -> License | None:
    """Fetch license by public key string."""
    stmt = select(License).where(License.license_key == license_key)
    return db.scalars(stmt).first()


def create_license(db: Session, data: LicenseCreate) -> License:
    """Create a new license with generated 6-digit key."""
    if data.expiry_date is not None:
        expiry = data.expiry_date
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
    else:
        expiry = _utcnow() + timedelta(days=DEFAULT_LICENSE_VALIDITY_DAYS)

    # Generate a unique 6-digit key (retry on collision).
    key = None
    for _ in range(20):
        candidate = new_license_key()
        if get_license_by_key(db, candidate) is None:
            key = candidate
            break
    if key is None:
        raise RuntimeError("Failed to generate unique license key")

    lic = License(
        license_key=key,
        username=data.username.strip(),
        plan=(data.plan or "").strip(),
        device_limit=data.device_limit,
        status=LicenseStatus.ACTIVE,
        expiry_date=expiry,
    )
    db.add(lic)
    db.commit()
    db.refresh(lic)
    return lic


def update_license(db: Session, lic: License, data: LicenseUpdate) -> License:
    """Apply partial updates to a license."""
    if data.username is not None:
        lic.username = data.username.strip()
    if data.plan is not None:
        lic.plan = data.plan.strip()
    if data.device_limit is not None:
        lic.device_limit = data.device_limit
    if data.status is not None:
        lic.status = data.status
    if data.expiry_date is not None:
        ed = data.expiry_date
        if ed.tzinfo is None:
            ed = ed.replace(tzinfo=timezone.utc)
        lic.expiry_date = ed
    db.commit()
    db.refresh(lic)
    return lic


def set_blocked(db: Session, lic: License, blocked: bool) -> License:
    """Set license status to blocked or active."""
    lic.status = LicenseStatus.BLOCKED if blocked else LicenseStatus.ACTIVE
    db.commit()
    db.refresh(lic)
    return lic


def toggle_block(db: Session, lic: License) -> License:
    """Flip blocked state."""
    blocked = lic.status != LicenseStatus.BLOCKED
    return set_blocked(db, lic, blocked)


def delete_license(db: Session, lic: License) -> None:
    """Permanently remove a license and its devices."""
    db.delete(lic)
    db.commit()


def count_devices_for_license(db: Session, license_id: int) -> int:
    """Return number of registered HWIDs for a license."""
    stmt = select(func.count()).select_from(LicenseDevice).where(
        LicenseDevice.license_id == license_id
    )
    return int(db.scalar(stmt) or 0)


def validate_license(
    db: Session,
    license_key: str,
    hwid: str,
) -> ValidateResponse:
    """
    Validate key + HWID: exists, not blocked, not expired, device limit.
    If HWID already known for this license, always valid (when license ok).
    If new HWID and under limit, register device and return valid.
    """
    key = license_key.strip()
    hw = hwid.strip()
    lic = get_license_by_key(db, key)
    if lic is None:
        return ValidateResponse(
            valid=False,
            result=ValidateResult.INVALID_KEY,
            message="License key not found.",
        )
    if lic.status == LicenseStatus.BLOCKED:
        return ValidateResponse(
            valid=False,
            result=ValidateResult.BLOCKED,
            message="License is blocked.",
        )
    now = _utcnow()
    if _as_utc(lic.expiry_date) < now:
        return ValidateResponse(
            valid=False,
            result=ValidateResult.EXPIRED,
            message="License has expired.",
        )

    stmt = select(LicenseDevice).where(
        LicenseDevice.license_id == lic.id,
        LicenseDevice.hwid == hw,
    )
    existing = db.scalars(stmt).first()
    if existing is not None:
        return ValidateResponse(
            valid=True,
            result=ValidateResult.VALID,
            message="License valid for this device.",
        )

    used = count_devices_for_license(db, lic.id)
    if used >= lic.device_limit:
        return ValidateResponse(
            valid=False,
            result=ValidateResult.DEVICE_LIMIT,
            message="Device limit reached for this license.",
        )

    db.add(LicenseDevice(license_id=lic.id, hwid=hw))
    db.commit()
    return ValidateResponse(
        valid=True,
        result=ValidateResult.VALID,
        message="License valid; device registered.",
    )
