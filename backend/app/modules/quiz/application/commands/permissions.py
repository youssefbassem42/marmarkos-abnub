"""Shared service-boundary permissions for the quiz module (P5-023)."""

from app.core.exceptions import NotFoundError
from app.modules.users.domain.enums.role_name import RoleName
from app.modules.users.infrastructure.persistence.models import User


def assert_manager(actor: User) -> None:
    """Defence-in-depth role re-check inside the service boundary."""
    if actor.role.name not in (RoleName.ADMIN, RoleName.SERVANT):
        raise NotFoundError("Resource not found")
