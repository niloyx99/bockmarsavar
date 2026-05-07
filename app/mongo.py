"""
MongoDB client and helpers (Motor).

When Settings.mongodb_uri is set, the application stores licenses and devices in MongoDB.
"""

from __future__ import annotations

from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, IndexModel

from app.config import get_settings

_client: AsyncIOMotorClient | None = None


def get_mongo_db() -> AsyncIOMotorDatabase:
    """
    Create (or reuse) a MongoDB database handle.

    Motor's client is thread-safe and intended to be long-lived.
    """
    global _client
    settings = get_settings()
    if not settings.mongodb_uri:
        raise RuntimeError("mongodb_uri is not configured")
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client[settings.mongodb_db]


def utcnow() -> datetime:
    """Timezone-aware UTC now for Mongo documents."""
    return datetime.now(timezone.utc)


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create indexes needed by the license server."""
    licenses = db["licenses"]
    devices = db["license_devices"]

    await licenses.create_indexes(
        [
            IndexModel([("license_key", ASCENDING)], unique=True, name="uniq_license_key"),
            IndexModel([("id", ASCENDING)], unique=True, name="uniq_license_id"),
            IndexModel([("username", ASCENDING)], name="idx_username"),
            IndexModel([("created_at", ASCENDING)], name="idx_created_at"),
        ]
    )

    await devices.create_indexes(
        [
            IndexModel(
                [("license_key", ASCENDING), ("hwid", ASCENDING)],
                unique=True,
                name="uniq_license_hwid",
            ),
            IndexModel([("license_key", ASCENDING)], name="idx_device_license_key"),
        ]
    )

