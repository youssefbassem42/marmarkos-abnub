"""QR validation service for attendance check-in."""

import hashlib
from typing import TYPE_CHECKING

from app.core.exceptions.errors import ValidationError
from app.modules.users.domain.enums.user_status import UserStatus
from app.modules.users.infrastructure.persistence.models import User
from app.modules.users.infrastructure.persistence.qr_code_repository import (
    UserQrCodeRepository,
)
from app.modules.users.infrastructure.persistence.user_repository import UserRepository

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class QrValidationService:
    """Service to validate QR codes and resolve user identity.
    
    Security principles:
    - Never trust user ID from QR payload directly
    - Validate QR token against database
    - Check user account status
    - Return safe user information
    """

    def __init__(self, session: "AsyncSession"):
        self._qr_repo = UserQrCodeRepository(session)
        self._user_repo = UserRepository(session)

    async def validate_and_resolve_user(self, qr_token: str) -> User:
        """Validate QR code and return the associated user.
        
        Args:
            qr_token: The QR code token string
            
        Returns:
            The User entity associated with the QR code
            
        Raises:
            ValidationError: If QR is invalid, inactive, or user is not active
        """
        # Hash the token to match stored hash
        token_hash = self._hash_token(qr_token)
        
        # Find active QR code
        qr_code = await self._qr_repo.get_active_by_token_hash(token_hash)
        if qr_code is None:
            raise ValidationError("Invalid or inactive QR code")
        
        # Resolve user
        user = await self._user_repo.get_by_id(qr_code.user_id)
        if user is None:
            raise ValidationError("User not found")
        
        # Validate user status
        if user.status != UserStatus.ACTIVE:
            raise ValidationError(
                f"User account is {user.status.value.lower()}. Cannot record attendance."
            )
        
        return user

    def _hash_token(self, token: str) -> str:
        """Hash QR token using SHA-256."""
        return hashlib.sha256(token.encode()).hexdigest()
