"""Telegram delivery of anonymous messages (D-20: one chat, forward only).

Mirrors the email transport seam: a Protocol, an HTTP implementation,
a logging fallback for dev/CI, and a settings-driven selector so local
development never needs real credentials. Retry policy inside one
request: transient failures (timeouts, 5xx) are retried up to
``TELEGRAM_SEND_ATTEMPTS`` with a short backoff; 4xx never retries
because a bad token or chat id will not fix itself.

PRIVACY (BR-11): logs carry the message id and outcome only — never the
body, the sender name or the phone.
"""

import asyncio
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_TELEGRAM_ENDPOINT = "https://api.telegram.org"
_SEND_TIMEOUT_SECONDS = settings.TELEGRAM_TIMEOUT_SECONDS


class TelegramClientError(Exception):
    """Delivery failed after all permitted attempts."""


class TelegramClient:
    async def send_message(self, text: str) -> str | None:
        """Deliver ``text``; returns the Telegram message id on success."""
        raise NotImplementedError


def _parse_response(payload: dict[str, Any]) -> str:
    if not payload.get("ok"):
        description = payload.get("description", "unknown Telegram error")
        raise TelegramClientError(f"Telegram rejected the message: {description}")
    result = payload.get("result") or {}
    message_id = result.get("message_id")
    return str(message_id) if message_id is not None else ""


class HttpTelegramClient(TelegramClient):
    def __init__(self, *, bot_token: str, chat_id: str) -> None:
        self._bot_token = bot_token
        self._chat_id = chat_id

    async def send_message(self, text: str) -> str | None:
        url = f"{_TELEGRAM_ENDPOINT}/bot{self._bot_token}/sendMessage"
        attempts = max(1, settings.TELEGRAM_SEND_ATTEMPTS)
        last_error: Exception | None = None
        for attempt in range(attempts):
            if attempt:
                await asyncio.sleep(0.5 * attempt)
            try:
                async with httpx.AsyncClient(timeout=_SEND_TIMEOUT_SECONDS) as client:
                    response = await client.post(
                        url,
                        json={
                            "chat_id": self._chat_id,
                            "text": text,
                            "parse_mode": "HTML",
                            "disable_web_page_preview": True,
                        },
                    )
                if 400 <= response.status_code < 500:
                    # Bad token/chat/payload: retrying cannot succeed.
                    response.raise_for_status()
                response.raise_for_status()
                return _parse_response(response.json())
            except httpx.HTTPStatusError as exc:
                if 400 <= exc.response.status_code < 500:
                    logger.warning(
                        "Telegram send rejected (%d) for message delivery", exc.response.status_code
                    )
                    raise TelegramClientError(str(exc)) from exc
                last_error = exc
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
        raise TelegramClientError(str(last_error) if last_error else "Telegram send failed")


class LoggingTelegramClient(TelegramClient):
    """Dev/test fallback: logs the outcome instead of calling Telegram."""

    async def send_message(self, text: str) -> str | None:
        logger.info("TELEGRAM (no provider configured) → message length=%d", len(text))
        return "console"


def get_telegram_client() -> TelegramClient:
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        return LoggingTelegramClient()
    return HttpTelegramClient(bot_token=token, chat_id=chat_id)
