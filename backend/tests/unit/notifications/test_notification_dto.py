"""DTO bounds (BR-5) and mapper sanitisation (plan §3.5/§3.7)."""

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.modules.notifications.application.dto.notification_dto import (
    PushNotificationRequest,
)
from app.modules.notifications.application.mappers.notification_mapper import (
    map_notification_to_response,
    sanitise_notification_data,
)
from app.modules.notifications.domain.enums.notification_type import NotificationType
from app.modules.notifications.infrastructure.persistence.models import Notification


def _request(**overrides: object) -> dict:
    base: dict = {
        "title_ar": "عنوان الإعلان",
        "title_en": "Announcement title",
        "message_ar": "نص الرسالة بالعربية",
        "message_en": "Message body in English",
    }
    base.update(overrides)
    return base


def test_push_request_accepts_valid_payload() -> None:
    request = PushNotificationRequest(**_request(send_email=True, cta_url="https://x.y"))
    assert request.send_email is True
    assert request.cta_url == "https://x.y"


@pytest.mark.parametrize("field", ["title_ar", "title_en", "message_ar", "message_en"])
def test_all_four_copy_fields_are_required(field: str) -> None:
    payload = _request()
    del payload[field]
    with pytest.raises(PydanticValidationError):
        PushNotificationRequest(**payload)


def test_short_copy_is_rejected() -> None:
    with pytest.raises(PydanticValidationError):
        PushNotificationRequest(**_request(title_ar="ab"))
    with pytest.raises(PydanticValidationError):
        PushNotificationRequest(**_request(message_en="x" * 2001))


def test_sanitiser_keeps_only_allowlisted_keys() -> None:
    cleaned = sanitise_notification_data(
        {"icon": "Bell", "cta_url": "/a", "post_id": "p1", "slug": "s", "evil": "<script>"}
    )
    assert cleaned == {"icon": "Bell", "cta_url": "/a", "post_id": "p1", "slug": "s"}


def test_sanitiser_drops_unknown_icon_and_empty_result() -> None:
    assert sanitise_notification_data({"icon": "NotInAllowlist"}) is None
    assert sanitise_notification_data(None) is None
    assert sanitise_notification_data({}) is None


def test_mapper_sets_read_state_and_broadcast_flag() -> None:
    nid = uuid.uuid4()
    notification = Notification(
        id=nid,
        user_id=None,
        type=NotificationType.ANNOUNCEMENT,
        title="ع",
        message="م",
        title_en="t",
        message_en="m",
        data={"icon": "Trophy", "junk": 1},
        created_at=datetime.now(UTC),
    )
    dto = map_notification_to_response(notification, read_ids={nid})
    assert dto.id == nid
    assert dto.is_broadcast is True
    assert dto.is_read is True
    assert dto.data == {"icon": "Trophy"}
    assert dto.type == "ANNOUNCEMENT"

    other = map_notification_to_response(notification, read_ids=set())
    assert other.is_read is False
