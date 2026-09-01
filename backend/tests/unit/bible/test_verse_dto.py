"""DTO unit tests for the bible module (P5-009/P5-012 acceptance)."""

import pytest
from pydantic import ValidationError

from app.modules.bible.application.dto.verse_dto import VerseCreateRequest


def _payload(**overrides: object) -> dict:
    base: dict = dict(
        title="Psalm 23",
        verse_reference="Psalm 23:1",
        book="Psalms",
        chapter=23,
        verse_start=1,
        text="The Lord is my shepherd",
    )
    base.update(overrides)
    return base


def test_title_longer_than_100_rejected() -> None:
    with pytest.raises(ValidationError):
        VerseCreateRequest(**_payload(title="x" * 101))


def test_chapter_zero_rejected() -> None:
    with pytest.raises(ValidationError):
        VerseCreateRequest(**_payload(chapter=0))


def test_verse_end_before_start_rejected() -> None:
    with pytest.raises(ValidationError):
        VerseCreateRequest(**_payload(verse_start=5, verse_end=2))


def test_text_over_2000_rejected() -> None:
    with pytest.raises(ValidationError):
        VerseCreateRequest(**_payload(text="x" * 2001))


def test_http_image_url_rejected() -> None:
    """P5-012: only https URLs pass."""
    with pytest.raises(ValidationError):
        VerseCreateRequest(**_payload(image="http://res.cloudinary.com/demo/img.png"))


def test_non_cloudinary_host_rejected_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "CLOUDINARY_CLOUD_NAME", "demo")
    with pytest.raises(ValidationError):
        VerseCreateRequest(**_payload(image="https://evil.example.com/img.png"))
    ok = VerseCreateRequest(
        **_payload(image="https://res.cloudinary.com/demo/image/upload/v1/cover.png")
    )
    assert ok.image is not None
