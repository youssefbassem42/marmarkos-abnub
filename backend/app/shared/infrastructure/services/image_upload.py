"""Cloudinary unsigned-parameter signed REST upload.

Images are never stored locally: the file goes straight to Cloudinary and we
keep only the secure URL (same pattern as ``media_assets``). Uses only
httpx + hashlib — no extra SDK dependency.
"""

import hashlib
import logging
import time

import httpx

from app.config import settings
from app.core.exceptions import ForbiddenError, ImageServiceError, ValidationError

logger = logging.getLogger(__name__)

_CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
# The platform does not screen the content of an upload: Cloudinary itself
# decides what it accepts (it refuses a file that is not an image), and a
# whitelist here only rejected the formats the members actually use
# (HEIC from the phones, AVIF, GIF).
_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_HTTP_TIMEOUT_SECONDS = 20.0

# The reasons Cloudinary gives, and what the platform answers. A reason
# about the file is the member's fault (422); a reason about the service
# is ours (503) - and the member must be able to tell the two apart.
_MEMBER_FAULTS = (
    "unsupported file type",
    "invalid image",
    "not an image",
    "file size too large",
)
_SERVICE_FAULTS = {
    "invalid signature": "The image service refused the credentials of the platform",
    "unauthorized": "The image service refused the credentials of the platform",
    "authentication required": "The image service refused the credentials of the platform",
    "quota exceeded": "The image service has no room left",
}


def _max_size_message(max_bytes: int) -> str:
    megabytes = max_bytes // (1024 * 1024)
    if megabytes * (1024 * 1024) == max_bytes:
        return f"Image must be {megabytes} MB or smaller"
    return f"Image must be {max_bytes} bytes or smaller"


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


def _cloudinary_reason(response: httpx.Response) -> str:
    """The sentence Cloudinary answered, read from its JSON body."""
    try:
        payload = response.json()
    except ValueError:
        return response.text[:300]
    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message")
            if isinstance(message, str):
                return message
        if isinstance(error, str):
            return error
    return response.text[:300]


def _upload_error(reason: str, max_bytes: int) -> Exception:
    """The answer of the platform for the reason Cloudinary gave.

    A reason about the file is the member's fault (422); a reason about
    the service is ours (503). The old answer ("Image upload failed;
    please try again") hid both, so a broken credential looked like a
    member who chose a bad picture.
    """
    lowered = reason.lower()
    for fault, message in _SERVICE_FAULTS.items():
        if fault in lowered:
            return ImageServiceError(message)
    if "file size too large" in lowered:
        return ValidationError(_max_size_message(max_bytes))
    for fault in _MEMBER_FAULTS:
        if fault in lowered:
            return ValidationError("This file is not an image")
    return ImageServiceError()


def _credentials_are_broken() -> bool:
    """True when the API secret is the API key.

    The two are different values in the Cloudinary dashboard, and a
    secret that repeats the key is always a copy-paste mistake: every
    upload would be refused with an "Invalid Signature" that nobody
    could see, because the platform answered "try again" for
    everything.
    """
    secret = (settings.CLOUDINARY_API_SECRET or "").strip()
    key = (settings.CLOUDINARY_API_KEY or "").strip()
    return bool(secret) and secret == key


async def upload_image(
    data: bytes,
    content_type: str,
    folder: str = "avatars",
    max_bytes: int = _MAX_IMAGE_BYTES,
) -> str:
    """Upload an image to Cloudinary and return its secure URL.

    ``max_bytes`` caps the size of the uploaded file: a file that is too
    big is refused with a ``ValidationError`` instead of reaching
    Cloudinary. The default is 5 MB - the size of a photo of a modern
    phone - so a member never loses an image because of its weight.

    The content of the file is **not** screened here: Cloudinary accepts
    the image formats and refuses what is not an image, with its own
    message. The server only refuses an empty file.

    The answer of Cloudinary is never swallowed: its reason is written
    in the log of the deployment and translated into an answer that
    tells the member whether the fault is his or ours.
    """
    _ = content_type
    if not cloudinary_configured():
        raise ForbiddenError("Image uploads are not configured")
    if len(data) == 0:
        raise ValidationError("The uploaded file is empty")
    if len(data) > max_bytes:
        raise ValidationError(_max_size_message(max_bytes))
    if _credentials_are_broken():
        logger.error(
            "The Cloudinary API secret is the API key: every upload would be refused "
            "with an invalid signature. Copy the API secret of the dashboard into "
            "CLOUDINARY_API_SECRET."
        )
        raise ImageServiceError("The image service refused the credentials of the platform")

    url = _CLOUDINARY_UPLOAD_URL.format(cloud_name=settings.CLOUDINARY_CLOUD_NAME)
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT_SECONDS) as client:
        response = await client.post(url, data=_signed_params(folder), files={"file": data})
    if response.status_code >= 400:
        reason = _cloudinary_reason(response)
        logger.error(
            "Cloudinary refused the upload of the folder %s (HTTP %s): %s",
            folder,
            response.status_code,
            reason,
        )
        raise _upload_error(reason, max_bytes)

    secure_url: object = response.json().get("secure_url")
    if not isinstance(secure_url, str) or not secure_url:
        logger.error("Cloudinary answered without a secure_url for the folder %s", folder)
        raise ImageServiceError()
    return secure_url
