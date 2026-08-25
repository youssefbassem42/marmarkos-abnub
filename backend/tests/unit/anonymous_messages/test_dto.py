"""Request-DTO validation for anonymous submissions (BR-16).

Regression guard for the production 500: the optional contact fields used
to carry their length/pattern constraints on the ``str | None`` union, so
Pydantic handed ``None`` to the length validator and raised
``TypeError: Unable to apply constraint 'max_length' to supplied value
None`` — surfacing as an unhandled 500 rather than a 422.

Every existing test omitted the optional keys, and an omitted key uses the
default without validating it, so nothing caught it. The browser sends the
keys explicitly. These cases pin all three input shapes: absent, ``null``
and ``""``.
"""

import pytest
from pydantic import ValidationError

from app.modules.anonymous_messages.application.dto.anonymous_message_dto import (
    AnonymousMessageCreateRequest,
)

_MESSAGE = "Please keep our family in your prayers this week."


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"message": _MESSAGE}, id="optional-keys-absent"),
        pytest.param(
            {"message": _MESSAGE, "sender_name": None, "sender_phone": None},
            id="explicit-nulls",
        ),
        pytest.param(
            {"message": _MESSAGE, "sender_name": "", "sender_phone": ""},
            id="empty-strings",
        ),
        pytest.param(
            {"message": _MESSAGE, "sender_name": "   ", "sender_phone": "  "},
            id="whitespace-only",
        ),
    ],
)
def test_absent_blank_and_null_contacts_all_normalise_to_none(payload: dict) -> None:
    request = AnonymousMessageCreateRequest.model_validate(payload)

    assert request.sender_name is None
    assert request.sender_phone is None


def test_self_declared_contacts_are_kept() -> None:
    request = AnonymousMessageCreateRequest.model_validate(
        {"message": _MESSAGE, "sender_name": "Youssef", "sender_phone": "+20 100 123 4567"}
    )

    assert request.sender_name == "Youssef"
    assert request.sender_phone == "+20 100 123 4567"


def test_message_is_stripped_before_the_length_check() -> None:
    request = AnonymousMessageCreateRequest.model_validate({"message": f"   {_MESSAGE}   "})

    assert request.message == _MESSAGE


@pytest.mark.parametrize(
    ("payload", "expected_type"),
    [
        pytest.param({"message": "too short"}, "too_short", id="message-below-minimum"),
        pytest.param({"message": "x" * 1001}, "too_long", id="message-above-maximum"),
        pytest.param(
            {"message": _MESSAGE, "sender_name": "y" * 121},
            "string_too_long",
            id="name-above-maximum",
        ),
        pytest.param(
            {"message": _MESSAGE, "sender_phone": "call-me-maybe"},
            "string_pattern_mismatch",
            id="phone-not-a-number",
        ),
    ],
)
def test_invalid_input_is_a_validation_error_not_a_crash(
    payload: dict, expected_type: str
) -> None:
    # A TypeError escaping here is the bug this module exists to prevent: it
    # becomes a 500 instead of a 422.
    with pytest.raises(ValidationError) as excinfo:
        AnonymousMessageCreateRequest.model_validate(payload)

    assert excinfo.value.errors()[0]["type"] == expected_type
