"""Email delivery backends for the mail service component.

Three interchangeable transports behind one protocol:

* ``BrevoEmailSender``   — Brevo transactional HTTP API.
* ``GmailEmailSender``   — Gmail SMTP over SSL (app password).
* ``LoggingEmailSender`` — dev/test fallback that logs the message.

``get_email_sender`` picks one automatically from settings unless
``MAIL_PROVIDER`` names a specific one.
"""

import asyncio
import logging
import re
import smtplib
from email.message import EmailMessage
from typing import Protocol

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"
_SEND_TIMEOUT_SECONDS = 15.0


class EmailSender(Protocol):
    async def send(self, *, to_email: str, subject: str, html: str) -> None: ...


class BrevoEmailSender:
    """Sends through Brevo's transactional email API."""

    def __init__(self, api_key: str, sender_email: str, sender_name: str) -> None:
        self._api_key = api_key
        self._sender_email = sender_email
        self._sender_name = sender_name

    async def send(self, *, to_email: str, subject: str, html: str) -> None:
        payload = {
            "sender": {"name": self._sender_name, "email": self._sender_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html,
        }
        async with httpx.AsyncClient(timeout=_SEND_TIMEOUT_SECONDS) as client:
            response = await client.post(
                _BREVO_ENDPOINT,
                json=payload,
                headers={"api-key": self._api_key, "content-type": "application/json"},
            )
            response.raise_for_status()


class GmailEmailSender:
    """Sends through Gmail SMTP (requires an app password)."""

    SMTP_HOST = "smtp.gmail.com"
    SMTP_PORT = 465

    def __init__(self, address: str, app_password: str, sender_name: str) -> None:
        self._address = address
        self._app_password = app_password
        self._sender_name = sender_name

    async def send(self, *, to_email: str, subject: str, html: str) -> None:
        # smtplib is blocking; keep the event loop responsive.
        await asyncio.to_thread(self._send_sync, to_email, subject, html)

    def _send_sync(self, to_email: str, subject: str, html: str) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = f"{self._sender_name} <{self._address}>"
        message["To"] = to_email
        message.set_content(_html_to_plain_text(html))
        message.add_alternative(html, subtype="html")

        with smtplib.SMTP_SSL(
            self.SMTP_HOST, self.SMTP_PORT, timeout=_SEND_TIMEOUT_SECONDS
        ) as server:
            server.login(self._address, self._app_password)
            server.send_message(message)


def _html_to_plain_text(html: str) -> str:
    text = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


class LoggingEmailSender:
    """Dev/test fallback: logs the email instead of delivering it."""

    async def send(self, *, to_email: str, subject: str, html: str) -> None:
        logger.info(
            "EMAIL (no provider configured) → to=%s subject=%r\n%s",
            to_email,
            subject,
            html,
        )


def get_email_sender() -> EmailSender:
    provider = settings.MAIL_PROVIDER.strip().lower()
    brevo_api_key = settings.BREVO_API_KEY
    brevo_sender_email = settings.BREVO_SENDER_EMAIL
    gmail_address = settings.GMAIL_EMAIL
    gmail_app_password = settings.GMAIL_APP_PASSWORD
    brevo_ready = bool(brevo_api_key and brevo_sender_email)
    gmail_ready = bool(gmail_address and gmail_app_password)

    if provider == "console":
        return LoggingEmailSender()
    if provider == "brevo" or (provider == "auto" and brevo_ready):
        if not (brevo_api_key and brevo_sender_email):
            raise RuntimeError("MAIL_PROVIDER=brevo requires BREVO_API_KEY and BREVO_SENDER_EMAIL")
        return BrevoEmailSender(
            api_key=brevo_api_key,
            sender_email=brevo_sender_email,
            sender_name=settings.effective_sender_name,
        )
    if provider == "gmail" or (provider == "auto" and gmail_ready):
        if not (gmail_address and gmail_app_password):
            raise RuntimeError("MAIL_PROVIDER=gmail requires GMAIL_EMAIL and GMAIL_APP_PASSWORD")
        return GmailEmailSender(
            address=gmail_address,
            app_password=gmail_app_password,
            sender_name=settings.effective_sender_name,
        )
    return LoggingEmailSender()
