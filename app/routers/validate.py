"""
Public license validation endpoint (GET and POST).
"""

from fastapi import APIRouter, Query

from app.config import get_settings
from app.deps import DbSession
from app.mongo import get_mongo_db
from app.schemas import ValidateRequest, ValidateResponse
from app.services import license_service as svc
from app.services import mongo_license_service as msvc

router = APIRouter(tags=["validate"])
settings = get_settings()


@router.get("/validate", response_model=ValidateResponse)
async def validate_get(
    db: DbSession,
    license_key: str = Query(..., min_length=1, max_length=36),
    hwid: str = Query(..., min_length=1, max_length=512),
) -> ValidateResponse:
    """
    Validate license key and hardware ID (query parameters).
    """
    if settings.mongodb_uri:
        mdb = get_mongo_db()
        return await msvc.validate_license(mdb, license_key, hwid)
    return svc.validate_license(db, license_key, hwid)


@router.post("/validate", response_model=ValidateResponse)
async def validate_post(
    db: DbSession,
    body: ValidateRequest,
) -> ValidateResponse:
    """
    Validate license key and hardware ID (JSON body).
    """
    if settings.mongodb_uri:
        mdb = get_mongo_db()
        return await msvc.validate_license(mdb, body.license_key, body.hwid)
    return svc.validate_license(db, body.license_key, body.hwid)
