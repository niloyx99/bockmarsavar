"""
FastAPI dependencies: database session and admin session guard.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db

DbSession = Annotated[Session, Depends(get_db)]


def require_admin(request: Request) -> bool:
    """
    Ensure the signed session marks the user as authenticated admin.
    Raises 401 if missing or invalid.
    """
    if request.session.get("admin") is not True:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return True


CurrentAdmin = Annotated[bool, Depends(require_admin)]
