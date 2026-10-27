"""The security primitives that more than one module needs (ARCH-001).

The password rules and the token format are not the business of the
auth module: the users module hashes the passwords of the members, and
every module that guards a route decodes the access token. They live in
the shared kernel; the auth module keeps its old import paths.
"""

from app.shared.security.jwt import ACCESS_TOKEN_TYPE, JWTService, jwt_service
from app.shared.security.password import hash_password, verify_password

__all__ = [
    "ACCESS_TOKEN_TYPE",
    "JWTService",
    "hash_password",
    "jwt_service",
    "verify_password",
]
