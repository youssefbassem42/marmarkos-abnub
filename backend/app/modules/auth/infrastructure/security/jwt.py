import uuid
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import settings
from app.core.exceptions import UnauthorizedError

ACCESS_TOKEN_TYPE = "access"


class JWTService:
    def __init__(
        self,
        secret: str,
        expires_delta: timedelta,
        algorithm: str = "HS256",
    ) -> None:
        self._secret = secret
        self._expires_delta = expires_delta
        self._algorithm = algorithm

    def create_access_token(
        self,
        subject: uuid.UUID,
        expires_delta: timedelta | None = None,
    ) -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": str(subject),
            "type": ACCESS_TOKEN_TYPE,
            "iat": now,
            "exp": now + (expires_delta or self._expires_delta),
        }
        return jwt.encode(payload, self._secret, algorithm=self._algorithm)

    def decode_access_token(self, token: str) -> uuid.UUID:
        try:
            payload = jwt.decode(token, self._secret, algorithms=[self._algorithm])
        except JWTError as exc:
            raise UnauthorizedError("Invalid or expired token") from exc
        subject = payload.get("sub")
        if subject is None or payload.get("type") != ACCESS_TOKEN_TYPE:
            raise UnauthorizedError("Invalid or expired token")
        return uuid.UUID(subject)


jwt_service = JWTService(
    secret=settings.JWT_SECRET,
    expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
)
