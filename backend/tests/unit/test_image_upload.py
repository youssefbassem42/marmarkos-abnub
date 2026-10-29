"""The image upload service: the size limit is a parameter.

The default stays 2 MB (the avatars and the verse covers) while other
callers - the blog, with its 1 MB photo - pass their own limit. A file
that is too big is refused with a ``ValidationError``, never with a 500.
"""

import pytest
from _pytest.monkeypatch import MonkeyPatch

import app.shared.infrastructure.services.image_upload as module
from app.core.exceptions.errors import ValidationError
from app.shared.infrastructure.services.image_upload import upload_image

_TWO_MEBIBYTES = 2 * 1024 * 1024
_ONE_MEBIBYTE = 1024 * 1024


class _FakeResponse:
    def __init__(self, secure_url: str = "https://demo.cloudinary.com/secure.jpg") -> None:
        self.status_code = 200
        self._secure_url = secure_url

    def json(self) -> dict[str, str]:
        return {"secure_url": self._secure_url}


class _FakeClient:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.response = _FakeResponse()

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *args: object) -> bool | None:
        return None

    async def post(self, url: str, data: dict, files: dict) -> _FakeResponse:
        return self.response


def _configure_cloudinary(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(module.settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(module.settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(module.settings, "CLOUDINARY_API_SECRET", "secret")
    monkeypatch.setattr(module.httpx, "AsyncClient", _FakeClient)


async def test_a_file_of_the_limit_is_accepted(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    url = await upload_image(b"x" * _TWO_MEBIBYTES, "image/jpeg", max_bytes=_TWO_MEBIBYTES)

    assert url == "https://demo.cloudinary.com/secure.jpg"


async def test_a_file_one_byte_over_the_limit_is_refused(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    with pytest.raises(ValidationError) as excinfo:
        await upload_image(b"x" * (_TWO_MEBIBYTES + 1), "image/jpeg", max_bytes=_TWO_MEBIBYTES)

    assert excinfo.value.status_code == 422
    assert str(excinfo.value) == "Image must be 2 MB or smaller"


async def test_the_default_limit_is_still_two_mebibytes(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    # Exactly the default limit is accepted.
    assert await upload_image(b"x" * _TWO_MEBIBYTES, "image/png")

    # One byte over the default limit is refused.
    with pytest.raises(ValidationError):
        await upload_image(b"x" * (_TWO_MEBIBYTES + 1), "image/webp")


async def test_a_caller_can_pass_its_own_limit(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    # The blog's photo: exactly 1 MB is accepted.
    assert await upload_image(b"x" * _ONE_MEBIBYTE, "image/jpeg", max_bytes=_ONE_MEBIBYTE)

    # One byte over the caller's limit is refused with the limit in the message.
    with pytest.raises(ValidationError) as excinfo:
        await upload_image(b"x" * (_ONE_MEBIBYTE + 1), "image/png", max_bytes=_ONE_MEBIBYTE)
    assert str(excinfo.value) == "Image must be 1 MB or smaller"
