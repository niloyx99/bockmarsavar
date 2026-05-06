"""
Application configuration via environment variables.
Supports SQLite (default) and PostgreSQL via DATABASE_URL.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Secret for signing session cookies (admin login).
    secret_key: str = "dev-only-change-in-production"
    # Plain password for admin UI/API (set in production).
    admin_password: str = "admin"

    # SQLAlchemy URL: sqlite:///./data/licenses.db or postgresql+psycopg2://...
    database_url: str = "sqlite:///./data/licenses.db"

    # If set, MongoDB is used for storage instead of SQLAlchemy.
    # Example: mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
    mongodb_uri: str | None = None
    mongodb_db: str = "license_server"

    # Session cookie name for admin.
    session_cookie_name: str = "license_admin_session"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
