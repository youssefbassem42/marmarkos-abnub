"""Re-export of the token codec (the code moved to the shared kernel)."""

from app.shared.security.jwt import ACCESS_TOKEN_TYPE, JWTService, jwt_service

__all__ = ["ACCESS_TOKEN_TYPE", "JWTService", "jwt_service"]
