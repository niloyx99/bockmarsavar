"""
Database engine and session factory.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()

# SQLite needs check_same_thread=False for FastAPI sync usage.
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for request-scoped dependency injection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
