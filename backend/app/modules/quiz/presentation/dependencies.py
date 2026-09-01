"""Shared presentation dependencies for the quiz module (P5-008)."""

from typing import Annotated

from fastapi import Depends

from app.modules.auth.presentation.dependencies import get_current_user
from app.modules.users.infrastructure.persistence.models import User

CurrentUser = Annotated[User, Depends(get_current_user)]
"""Any authenticated user (member, servant or admin)."""
