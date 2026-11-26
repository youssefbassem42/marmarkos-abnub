"""The image upload service: the size limit is a parameter.

The default is 5 MB - the weight of a photo of a modern phone - and the
blog uses the same limit for its cover and for the pictures of its
body. A file that is too big is refused with a ``ValidationError``,
never with a 500.

The content of the file is **not** screened by the platform: the owner
asked for every image format to be accepted, and Cloudinary itself
refuses what is not an image.
"""

import pytest
from _pytest.monkeypatch import MonkeyPatch

import app.shared.infrastructure.services.image_upload as module
from app.core.exceptions.errors import ImageServiceError, ValidationError
from app.shared.infrastructure.services.image_upload import upload_image

_FIVE_MEBIBYTES = 5 * 1024 * 1024
_ONE_MEBIBYTE = 1024 * 1024


class _FakeResponse:
    def __init__(
        self,
        secure_url: str = "https://demo.cloudinary.com/secure.jpg",
        *,
        status_code: int = 200,
        error: str | None = None,
    ) -> None:
        self.status_code = status_code
        self._secure_url = secure_url
        self._error = error

    def json(self) -> dict[str, object]:
        if self._error is not None:
            return {"error": {"message": self._error}}
        return {"secure_url": self._secure_url}

    @property
    def text(self) -> str:
        return self._error or ""


class _FakeClient:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.response = _FakeResponse()
        self.calls = 0

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *args: object) -> bool | None:
        return None

    async def post(self, url: str, data: dict, files: dict) -> _FakeResponse:
        self.calls += 1
        return self.response


def _configure_cloudinary(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(module.settings, "CLOUDINARY_CLOUD_NAME", "demo")
    monkeypatch.setattr(module.settings, "CLOUDINARY_API_KEY", "key")
    monkeypatch.setattr(module.settings, "CLOUDINARY_API_SECRET", "secret")
    monkeypatch.setattr(module.httpx, "AsyncClient", _FakeClient)


async def test_a_file_of_the_limit_is_accepted(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    url = await upload_image(b"x" * _FIVE_MEBIBYTES, "image/jpeg")

    assert url == "https://demo.cloudinary.com/secure.jpg"


async def test_a_file_one_byte_over_the_limit_is_refused(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    with pytest.raises(ValidationError) as excinfo:
        await upload_image(b"x" * (_FIVE_MEBIBYTES + 1), "image/jpeg")

    assert excinfo.value.status_code == 422
    assert str(excinfo.value) == "Image must be 5 MB or smaller"


async def test_the_default_limit_is_five_mebibytes(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    # Exactly the default limit is accepted.
    assert await upload_image(b"x" * _FIVE_MEBIBYTES, "image/png")

    # One byte over the default limit is refused.
    with pytest.raises(ValidationError):
        await upload_image(b"x" * (_FIVE_MEBIBYTES + 1), "image/webp")


async def test_a_caller_can_pass_its_own_limit(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    # Exactly the caller's limit is accepted.
    assert await upload_image(b"x" * _ONE_MEBIBYTE, "image/jpeg", max_bytes=_ONE_MEBIBYTE)

    # One byte over the caller's limit is refused with the limit in the message.
    with pytest.raises(ValidationError) as excinfo:
        await upload_image(b"x" * (_ONE_MEBIBYTE + 1), "image/png", max_bytes=_ONE_MEBIBYTE)
    assert str(excinfo.value) == "Image must be 1 MB or smaller"


async def test_an_empty_file_is_refused(monkeypatch: MonkeyPatch) -> None:
    _configure_cloudinary(monkeypatch)

    with pytest.raises(ValidationError) as excinfo:
        await upload_image(b"", "image/jpeg")

    assert str(excinfo.value) == "The uploaded file is empty"


@pytest.mark.parametrize(
    "content_type",
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/heic",
        "image/heif",
        "image/tiff",
        "image/bmp",
        # The owner asked for no screening of the content: the platform
        # does not refuse a format, Cloudinary decides what it accepts.
        "application/octet-stream",
        "",
    ],
)
async def test_no_image_format_is_screened(monkeypatch: MonkeyPatch, content_type: str) -> None:
    _configure_cloudinary(monkeypatch)

    url = await upload_image(b"x" * 1024, content_type)

    assert url == "https://demo.cloudinary.com/secure.jpg"


async def test_a_refused_signature_is_the_fault_of_the_platform(
    monkeypatch: MonkeyPatch,
) -> None:
    """A broken credential must not look like a bad picture.

    The production answered "Image upload failed; please try again" for
    every upload: the reason of Cloudinary was thrown away, so a member
    (and the owner) saw a validation error instead of a broken
    credential.
    """
    _configure_cloudinary(monkeypatch)
    client = _FakeClient()
    client.response = _FakeResponse(status_code=401, error="Invalid Signature")
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda *a, **k: client)

    with pytest.raises(ImageServiceError) as excinfo:
        await upload_image(b"x" * 1024, "image/png")

    assert excinfo.value.status_code == 503
    assert str(excinfo.value) == "The image service refused the credentials of the platform"


async def test_the_reason_of_cloudinary_is_written_in_the_log(
    monkeypatch: MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _configure_cloudinary(monkeypatch)
    client = _FakeClient()
    client.response = _FakeResponse(status_code=401, error="Invalid Signature")
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda *a, **k: client)

    with caplog.at_level("ERROR"):
        with pytest.raises(ImageServiceError):
            await upload_image(b"x" * 1024, "image/png")

    assert "Invalid Signature" in caplog.text


async def test_a_file_that_cloudinary_refuses_is_the_fault_of_the_member(
    monkeypatch: MonkeyPatch,
) -> None:
    _configure_cloudinary(monkeypatch)
    client = _FakeClient()
    client.response = _FakeResponse(status_code=400, error="Unsupported file type")
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda *a, **k: client)

    with pytest.raises(ValidationError) as excinfo:
        await upload_image(b"x" * 1024, "image/png")

    assert excinfo.value.status_code == 422
    assert str(excinfo.value) == "This file is not an image"


async def test_a_file_that_is_too_big_for_cloudinary_names_the_limit(
    monkeypatch: MonkeyPatch,
) -> None:
    _configure_cloudinary(monkeypatch)
    client = _FakeClient()
    client.response = _FakeResponse(status_code=413, error="File size too large")
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda *a, **k: client)

    with pytest.raises(ValidationError) as excinfo:
        await upload_image(b"x" * 1024, "image/png")

    assert str(excinfo.value) == "Image must be 5 MB or smaller"


async def test_an_answer_without_a_url_is_the_fault_of_the_platform(
    monkeypatch: MonkeyPatch,
) -> None:
    _configure_cloudinary(monkeypatch)
    client = _FakeClient()
    client.response = _FakeResponse(secure_url="")
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda *a, **k: client)

    with pytest.raises(ImageServiceError):
        await upload_image(b"x" * 1024, "image/png")


async def test_a_secret_that_repeats_the_key_is_refused_before_the_call(
    monkeypatch: MonkeyPatch,
) -> None:
    """The copy-paste mistake of the credentials is caught immediately.

    The API secret of the deployment repeated the API key: every upload
    was refused by Cloudinary with an "Invalid Signature" that the
    platform hid. The upload now fails with the truth, without waiting
    for the answer of the service.
    """
    _configure_cloudinary(monkeypatch)
    monkeypatch.setattr(module.settings, "CLOUDINARY_API_KEY", "661358426227631")
    monkeypatch.setattr(module.settings, "CLOUDINARY_API_SECRET", "661358426227631")
    client = _FakeClient()
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda *a, **k: client)

    with pytest.raises(ImageServiceError) as excinfo:
        await upload_image(b"x" * 1024, "image/png")

    assert excinfo.value.status_code == 503
    assert str(excinfo.value) == "The image service refused the credentials of the platform"
    assert client.calls == 0
