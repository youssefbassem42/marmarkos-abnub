"""The request id of the request that is currently being handled.

The id is kept in a context variable, so every log record - no matter
how deep in the call stack it is written - can carry it without the
callers having to pass it around (SEC-014).
"""

import uuid
from contextvars import ContextVar, Token

_request_id: ContextVar[str] = ContextVar("request_id", default="-")


def new_request_id() -> str:
    """A fresh request id."""
    return uuid.uuid4().hex


def set_request_id(request_id: str) -> Token[str]:
    """Bind a request id to the current context."""
    return _request_id.set(request_id)


def reset_request_id(token: Token[str]) -> None:
    """Undo a previous ``set_request_id``."""
    _request_id.reset(token)


def get_request_id() -> str:
    """The request id of the current context ("-" outside a request)."""
    return _request_id.get()
