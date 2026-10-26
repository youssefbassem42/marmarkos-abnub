"""Logging helpers: every record carries the request id (SEC-014)."""

import logging

from app.core.observability.context import get_request_id


class RequestIdFilter(logging.Filter):
    """Add the current request id to every log record.

    The filter is installed on the root logger by ``create_app``, so the
    id appears in every line - including the ones written by the
    libraries - without a single call-site change.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


def install_request_id_filter() -> None:
    """Install the filter on the root logger (idempotent)."""
    root = logging.getLogger()
    if not any(isinstance(f, RequestIdFilter) for f in root.filters):
        root.addFilter(RequestIdFilter())


def log_format() -> str:
    """A log format that includes the request id.

    ``{request_id}`` is always available once the filter is installed,
    so a deployment can switch to this format without touching a single
    log call.
    """
    return "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"
