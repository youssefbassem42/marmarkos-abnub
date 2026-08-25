"""API DTOs for anonymous messages. Field names are frozen (plan §3.7).

BR-11: ``AnonymousMessageAdminResponse`` must never gain a field derived
from a user account, IP address or session — no exceptions, ever. The
only identity-adjacent data permitted is what the sender typed into
``sender_name``/``sender_phone`` themselves.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, Field

from app.config import settings


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _blank_to_none(value: object) -> object | None:
    if isinstance(value, str):
        return value.strip() or None
    return value


SenderName = Annotated[str, Field(max_length=120)]
SenderPhone = Annotated[str, Field(max_length=32, pattern=r"^[0-9+()\s-]{7,32}$")]


class AnonymousMessageCreateRequest(BaseModel):
    message: Annotated[
        str,
        BeforeValidator(_strip),
        Field(
            min_length=settings.ANONYMOUS_MESSAGE_MIN_LENGTH,
            max_length=settings.ANONYMOUS_MESSAGE_MAX_LENGTH,
        ),
    ]
    # Optional self-declared contact details; never account-derived (D-1).
    # A blank string is normalised to None before the union is validated, so
    # an untouched field is stored as NULL rather than "".
    sender_name: Annotated[SenderName | None, BeforeValidator(_blank_to_none)] = None
    sender_phone: Annotated[SenderPhone | None, BeforeValidator(_blank_to_none)] = None


class AnonymousMessageCreateResponse(BaseModel):
    id: UUID
    # FAILED still means "safely stored"; an admin can retry delivery (BR-13).
    status: str
    delivered: bool


class AnonymousMessageAdminResponse(BaseModel):
    id: UUID
    message: str
    sender_name: str | None
    sender_phone: str | None
    status: str
    telegram_status: str
    telegram_message_id: str | None
    attempts: int
    failure_reason: str | None
    created_at: datetime
    sent_at: datetime | None
    last_attempt_at: datetime | None
