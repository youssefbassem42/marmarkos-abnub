import hashlib
import secrets

_QR_PAYLOAD_PREFIX = "MA_QR:"


def generate_qr_payload() -> str:
    """High-entropy opaque payload encoded inside the user QR code."""
    return _QR_PAYLOAD_PREFIX + secrets.token_urlsafe(32)


def hash_qr_payload(payload: str) -> str:
    """SHA-256 of the payload; only the hash is persisted."""
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
