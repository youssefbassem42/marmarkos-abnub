"""Cloudinary unsigned-parameter signed REST upload.

Images are never stored locally: the file goes straight to Cloudinary and we
keep only the secure URL (same pattern as ``media_assets``). Uses only
httpx + hashlib — no extra SDK dependency.
"""

import hashlib
import time

import httpx

from app.config import settings
from app.core.exceptions import ForbiddenError, ValidationError

_CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
_ALLOWED_CONTENT_TYPES = ("image/jpeg", "image/png", "image/webp")
_MAX_IMAGE_BYTES = 2 * 1024 * 1024
_HTTP_TIMEOUT_SECONDS = 20.0


def cloudinary_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def _signed_params(folder: str) -> dict[str, str]:
    timestamp = str(int(time.time()))
    # Cloudinary signature: alphabetically sorted public params + secret, SHA-1.
    to_sign = f"folder={folder}&timestamp={timestamp}{settings.CLOUDINARY_API_SECRET}"
    return {
        "folder": folder,
        "timestamp": timestamp,
        "api_key": settings.CLOUDINARY_API_KEY or "",
        "signature": hashlib.sha1(to_sign.encode()).hexdigest(),
    }


async def upload_image(data: bytes, content_type: str, folder: str = "avatars") -> str:
    """Upload an image to Cloudinary and return its secure URL."""
    if not cloudinary_configured():
        raise ForbiddenError("Image uploads are not configured")
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise ValidationError("Only JPEG, PNG or WebP images are allowed")
    if len(data) == 0:
        raise ValidationError("The uploaded file is empty")
    if len(data) > _MAX_IMAGE_BYTES:
        raise ValidationError("Image must be 2 MB or smaller")

    url = _CLOUDINARY_UPLOAD_URL.format(cloud_name=settings.CLOUDINARY_CLOUD_NAME)
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
        response = await client.post(url, data=_signed_params(folder), files={"file": data})
    if response.status_code >= 400:
        raise ValidationError("Image upload failed; please try again")

    secure_url: object = response.json().get("secure_url")
    if not isinstance(secure_url, str):
        raise ValidationError("Image upload failed; please try again")
    return secure_url
