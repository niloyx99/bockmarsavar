"""
SQLAlchemy ORM models for licenses and registered devices (HWID).
"""

import enum
import secrets
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    """Timezone-aware UTC now."""
    return datetime.now(timezone.utc)


class LicenseStatus(str, enum.Enum):
    """License lifecycle status."""

    ACTIVE = "active"
    BLOCKED = "blocked"


class License(Base):
    """
    A customer license: unique key, limits, and validity window.
    """

    __tablename__ = "licenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Public license identifier (6-digit numeric string).
    license_key: Mapped[str] = mapped_column(
        String(6), unique=True, index=True, nullable=False
    )
    username: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    plan: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    device_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Store enum values as strings for SQLite + PostgreSQL without native PG enums.
    status: Mapped[LicenseStatus] = mapped_column(
        Enum(
            LicenseStatus,
            values_callable=lambda obj: [m.value for m in obj],
            native_enum=False,
        ),
        nullable=False,
        default=LicenseStatus.ACTIVE,
    )
    expiry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    devices: Mapped[list["LicenseDevice"]] = relationship(
        "LicenseDevice",
        back_populates="license",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<License {self.license_key[:8]}... {self.status}>"


class LicenseDevice(Base):
    """
    Registered hardware ID for a license (enforces device_limit).
    """

    __tablename__ = "license_devices"
    __table_args__ = (UniqueConstraint("license_id", "hwid", name="uq_license_hwid"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    license_id: Mapped[int] = mapped_column(
        ForeignKey("licenses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hwid: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    license: Mapped["License"] = relationship("License", back_populates="devices")


def new_license_key() -> str:
    """Generate a 6-digit numeric license key string."""
    return f"{secrets.randbelow(1_000_000):06d}"
