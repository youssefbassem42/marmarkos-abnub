"""Telegram client selection and retry policy (P4-202 subtask 5/6)."""

import httpx
import pytest

from app.modules.anonymous_messages.infrastructure.telegram.client import (
    HttpTelegramClient,
    LoggingTelegramClient,
    TelegramClientError,
    _parse_response,
)


def test_get_telegram_client_falls_back_without_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.modules.anonymous_messages.infrastructure.telegram import client as tg

    monkeypatch.setattr(tg.settings, "TELEGRAM_BOT_TOKEN", None)
    assert isinstance(tg.get_telegram_client(), LoggingTelegramClient)

    monkeypatch.setattr(tg.settings, "TELEGRAM_BOT_TOKEN", "tok")
    monkeypatch.setattr(tg.settings, "TELEGRAM_CHAT_ID", None)
    assert isinstance(tg.get_telegram_client(), LoggingTelegramClient)

    monkeypatch.setattr(tg.settings, "TELEGRAM_CHAT_ID", "-100chat")
    assert isinstance(tg.get_telegram_client(), HttpTelegramClient)


async def test_http_client_returns_message_id(monkeypatch: pytest.MonkeyPatch) -> None:

    captured: dict = {}

    class FakeResponse:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"ok": True, "result": {"message_id": 4242}}

    async def fake_post(self, url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        return FakeResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    client = HttpTelegramClient(bot_token="tok", chat_id="-100chat")
    result = await client.send_message("hello")

    assert result == "4242"
    assert "/bottok/sendMessage" in captured["url"]
    body = captured["json"]
    assert body["chat_id"] == "-100chat"
    assert body["text"] == "hello"
    assert body["parse_mode"] == "HTML"
    assert body["disable_web_page_preview"] is True


async def test_4xx_fails_fast_without_retry(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.anonymous_messages.infrastructure.telegram import client as tg

    calls: list[int] = []

    class BadResponse:
        status_code = 401
        content = b""

        def raise_for_status(self) -> None:
            raise httpx.HTTPStatusError(
                "unauthorized",
                request=None,
                response=self,  # type: ignore[arg-type]
            )

        def json(self) -> dict:
            return {}

    async def fake_post(self, url, **kwargs):
        calls.append(1)
        return BadResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setattr(tg.settings, "TELEGRAM_SEND_ATTEMPTS", 3)
    client = HttpTelegramClient(bot_token="bad", chat_id="c")

    with pytest.raises(TelegramClientError):
        await client.send_message("hello")
    assert len(calls) == 1  # no retry on a permanent rejection


async def test_5xx_retries_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:

    calls: list[int] = []

    class FlakyResponse:
        def __init__(self) -> None:
            self.status_code = 500
            self.content = b""

        def raise_for_status(self) -> None:
            if self.status_code != 200:
                raise httpx.HTTPStatusError(
                    "boom",
                    request=None,
                    response=self,  # type: ignore[arg-type]
                )

        def json(self) -> dict:
            return {"ok": True, "result": {"message_id": 7}}

    responses = [FlakyResponse(), FlakyResponse()]
    responses[1].status_code = 200

    async def fake_post(self, url, **kwargs):
        calls.append(1)
        return responses[len(calls) - 1]

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    client = HttpTelegramClient(bot_token="t", chat_id="c")
    result = await client.send_message("hi")
    assert len(calls) == 2
    assert result == "7"


async def test_timeouts_exhaust_attempts_and_raise(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.modules.anonymous_messages.infrastructure.telegram import client as tg

    calls: list[int] = []

    async def timeout_post(self, url, **kwargs):
        calls.append(1)
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx.AsyncClient, "post", timeout_post)
    monkeypatch.setattr(tg.settings, "TELEGRAM_SEND_ATTEMPTS", 2)

    async def instant_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(tg.asyncio, "sleep", instant_sleep)
    client = HttpTelegramClient(bot_token="t", chat_id="c")

    with pytest.raises(TelegramClientError):
        await client.send_message("hi")
    assert len(calls) == 2


def test_parse_response_rejects_not_ok() -> None:
    with pytest.raises(TelegramClientError):
        _parse_response({"ok": False, "description": "chat not found"})
