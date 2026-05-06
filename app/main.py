"""
FastAPI application entry: middleware, routers, templates, and DB bootstrap.
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.mongo import ensure_indexes, get_mongo_db
from app.routers import auth, licenses_api, validate


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize storage and create required indexes/tables."""
    settings = get_settings()

    if settings.mongodb_uri:
        db = get_mongo_db()
        await ensure_indexes(db)
    else:
        if settings.database_url.startswith("sqlite"):
            # e.g. sqlite:///./data/licenses.db
            path_part = settings.database_url.replace("sqlite:///", "", 1)
            if "/" in path_part or "\\" in path_part:
                directory = os.path.dirname(path_part)
                if directory:
                    os.makedirs(directory, exist_ok=True)
        Base.metadata.create_all(bind=engine)
    yield


settings = get_settings()
BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(
    title="License & User Management Server",
    description="Admin panel and license validation API.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    session_cookie=settings.session_cookie_name,
    same_site="lax",
    https_only=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

app.include_router(auth.router)
app.include_router(licenses_api.router)
app.include_router(validate.router)


@app.get("/", include_in_schema=False)
def root() -> RedirectResponse:
    """Send browsers to the admin dashboard."""
    return RedirectResponse(url="/admin", status_code=302)


@app.get("/admin", response_class=HTMLResponse, include_in_schema=False)
def admin_page(request: Request) -> HTMLResponse:
    """Serve the single-page admin dashboard (static HTML)."""
    return FileResponse(str(BASE_DIR / "templates" / "admin.html"), media_type="text/html")
