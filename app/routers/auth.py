"""
Admin authentication: session-based login for the admin panel.
"""

from fastapi import APIRouter, HTTPException, Request, status

from app.config import get_settings
from app.schemas import AdminLoginRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
def auth_me(request: Request) -> dict:
    """Return whether the current session is authenticated as admin."""
    return {"authenticated": request.session.get("admin") is True}


@router.post("/login")
def auth_login(request: Request, body: AdminLoginRequest) -> dict:
    """Set admin session cookie if password matches configured value."""
    settings = get_settings()
    if body.password != settings.admin_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    request.session["admin"] = True
    return {"ok": True}


@router.post("/logout")
def auth_logout(request: Request) -> dict:
    """Clear admin session."""
    request.session.clear()
    return {"ok": True}
