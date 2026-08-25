"""Shared FastAPI dependencies for the notifications router."""

from typing import Annotated

from fastapi import Depends

from app.core.database import get_unit_of_work
from app.modules.auth.presentation.dependencies import get_current_user, require_role
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User
from app.shared.infrastructure.persistence.unit_of_work import UnitOfWork

UnitOfWorkDep = Annotated[UnitOfWork, Depends(get_unit_of_work)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_role(RoleName.ADMIN))]
