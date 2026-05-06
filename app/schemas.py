"""
Pydantic schemas for API request/response validation.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.models import LicenseStatus


class LicenseCreate(BaseModel):
    """Payload for creating a license."""

    username: str = Field(..., min_length=1, max_length=255)
    plan: str = Field(default="", max_length=255, description="Amount / plan label")
    device_limit: int = Field(..., ge=1, le=10_000)
    expiry_date: datetime | None = Field(
        default=None,
        description="Optional explicit expiry (UTC). If omitted, server default validity applies.",
    )


class LicenseUpdate(BaseModel):
    """Payload for editing a license (all fields optional)."""

    username: str | None = Field(default=None, min_length=1, max_length=255)
    plan: str | None = Field(default=None, max_length=255)
    device_limit: int | None = Field(default=None, ge=1, le=10_000)
    status: LicenseStatus | None = None
    expiry_date: datetime | None = None


class LicenseOut(BaseModel):
    """License representation returned to clients."""

    model_config = {"from_attributes": True}

    id: int
    license_key: str
    username: str
    plan: str
    device_limit: int
    status: LicenseStatus
    expiry_date: datetime
    created_at: datetime
    registered_devices: int = Field(
        default=0, description="Count of distinct HWIDs registered."
    )


class ValidateRequest(BaseModel):
    """POST body for /validate."""

    license_key: str = Field(..., min_length=1, max_length=36)
    hwid: str = Field(..., min_length=1, max_length=512)


class ValidateResult(str, Enum):
    """Machine-readable validation outcomes."""

    VALID = "valid"
    INVALID_KEY = "invalid_key"
    BLOCKED = "blocked"
    EXPIRED = "expired"
    DEVICE_LIMIT = "device_limit"


class ValidateResponse(BaseModel):
    """Unified validation response."""

    valid: bool
    result: ValidateResult
    message: str


class AdminLoginRequest(BaseModel):
    """Admin login form body."""

    password: str = Field(..., min_length=1)
