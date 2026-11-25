"""The life of the session (the cookie of the refresh token).

The session of a member ends when the member signs out, when the window
is closed, or when the server revokes it. The cookie of the refresh
token is therefore a **session cookie** by default; a member who ticks
"remember me" gets a cookie that outlives the browser.

The nature of the session lives in the row of the refresh token: the
browser does not tell the server whether a cookie is a session cookie,
and the server re-issues the cookie on every refresh - a refresh must
not turn a session into a persistent one.
"""

import pytest
from httpx import AsyncClient

from app.config import settings
from tests.utils import DEFAULT_PASSWORD, LOGIN_URL, REFRESH_URL, register_user


async def test_login_sets_a_session_cookie_by_default(client: AsyncClient, db_engine) -> None:
    # No "Max-Age" and no "Expires": the cookie dies with the browser.
    await register_user(client, email="session@example.com")

    response = await client.post(
        LOGIN_URL, json={"email": "session@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    set_cookie = response.headers["set-cookie"]
    assert "refresh_token=" in set_cookie
    assert "Max-Age" not in set_cookie
    assert "Expires" not in set_cookie


async def test_login_sets_a_long_lived_cookie_when_the_member_asks_for_it(
    client: AsyncClient, db_engine
) -> None:
    await register_user(client, email="remember@example.com")

    response = await client.post(
        LOGIN_URL,
        json={
            "email": "remember@example.com",
            "password": DEFAULT_PASSWORD,
            "remember_me": True,
        },
    )

    assert response.status_code == 200
    set_cookie = response.headers["set-cookie"]
    assert "Max-Age=2592000" in set_cookie


async def test_the_refresh_keeps_the_nature_of_the_session(client: AsyncClient, db_engine) -> None:
    # A session that was not remembered stays a session: the refresh
    # re-issues the cookie, and it must not become persistent.
    await register_user(client, email="keep-session@example.com")
    login = await client.post(
        LOGIN_URL, json={"email": "keep-session@example.com", "password": DEFAULT_PASSWORD}
    )
    assert "Max-Age" not in login.headers["set-cookie"]

    refresh = await client.post(REFRESH_URL)

    assert refresh.status_code == 200
    assert "Max-Age" not in refresh.headers["set-cookie"]


async def test_the_refresh_keeps_a_remembered_session_remembered(
    client: AsyncClient, db_engine
) -> None:
    await register_user(client, email="keep-remembered@example.com")
    login = await client.post(
        LOGIN_URL,
        json={
            "email": "keep-remembered@example.com",
            "password": DEFAULT_PASSWORD,
            "remember_me": True,
        },
    )
    assert "Max-Age=2592000" in login.headers["set-cookie"]

    refresh = await client.post(REFRESH_URL)

    assert refresh.status_code == 200
    assert "Max-Age=2592000" in refresh.headers["set-cookie"]


async def test_the_sign_out_ends_the_session(client: AsyncClient, db_engine) -> None:
    await register_user(client, email="bye@example.com")
    await client.post(LOGIN_URL, json={"email": "bye@example.com", "password": DEFAULT_PASSWORD})
    token = client.cookies.get("refresh_token")
    assert token

    await client.post("/api/v1/auth/logout")

    # The cookie of the browser is cleared...
    assert client.cookies.get("refresh_token") in (None, "")
    # ... and the session cannot be renewed any more, even if a copy of
    # the cookie survives somewhere.
    client.cookies.set("refresh_token", token, path="/api/v1/auth")
    assert (await client.post(REFRESH_URL)).status_code == 401


# -- The cookie of a cross-site deployment (BR-96) ----------------------------
#
# The frontend of the platform is served from one site and the API from
# another (two Vercel projects), so the browser calls the API
# cross-site. A SameSite=Lax cookie is then never sent with the silent
# refresh: the server answers "Not authenticated" and the member is
# logged out at every reload of the page.
#
# The cookie therefore follows the shape of the call: same site -> lax,
# cross site -> none (with the Secure flag the browser demands).


async def test_a_same_site_call_keeps_the_cookie_first_party(
    client: AsyncClient, db_engine
) -> None:
    await register_user(client, email="same-site@example.com")

    response = await client.post(
        LOGIN_URL,
        json={"email": "same-site@example.com", "password": DEFAULT_PASSWORD},
        headers={"Origin": "http://test"},
    )

    assert response.status_code == 200
    set_cookie = response.headers["set-cookie"]
    assert "SameSite=lax" in set_cookie


async def test_a_cross_site_call_gets_a_cookie_the_browser_sends_back(
    client: AsyncClient, db_engine
) -> None:
    await register_user(client, email="cross-site@example.com")

    response = await client.post(
        LOGIN_URL,
        json={"email": "cross-site@example.com", "password": DEFAULT_PASSWORD},
        headers={"Origin": "https://marmarkosabnub.vercel.app"},
    )

    assert response.status_code == 200
    set_cookie = response.headers["set-cookie"]
    # SameSite=None is the only value the browser accepts for a
    # cross-site cookie...
    assert "SameSite=none" in set_cookie
    # ... and it refuses that cookie without the Secure flag.
    assert "Secure" in set_cookie
    assert "HttpOnly" in set_cookie


async def test_the_cross_site_cookie_is_also_set_by_the_refresh(
    client: AsyncClient, db_engine
) -> None:
    # The refresh rotates the cookie: the new one must keep the same
    # shape, otherwise the session dies at the second reload.
    await register_user(client, email="rotate@example.com")
    await client.post(LOGIN_URL, json={"email": "rotate@example.com", "password": DEFAULT_PASSWORD})

    refresh = await client.post(
        REFRESH_URL, headers={"Origin": "https://marmarkosabnub.vercel.app"}
    )

    assert refresh.status_code == 200
    assert "SameSite=none" in refresh.headers["set-cookie"]
    assert "Secure" in refresh.headers["set-cookie"]


async def test_the_operator_can_force_the_shape_of_the_cookie(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    # An explicit setting wins over the automatic detection: a
    # deployment that knows its frontend is on the same site can keep
    # the strict "lax".
    monkeypatch.setattr(settings, "COOKIE_SAMESITE", "lax")
    await register_user(client, email="forced@example.com")

    response = await client.post(
        LOGIN_URL,
        json={"email": "forced@example.com", "password": DEFAULT_PASSWORD},
        headers={"Origin": "https://marmarkosabnub.vercel.app"},
    )

    assert response.status_code == 200
    assert "SameSite=lax" in response.headers["set-cookie"]


async def test_the_secure_flag_can_be_forced(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "COOKIE_SECURE", True)
    await register_user(client, email="forced-secure@example.com")

    response = await client.post(
        LOGIN_URL, json={"email": "forced-secure@example.com", "password": DEFAULT_PASSWORD}
    )

    assert response.status_code == 200
    assert "Secure" in response.headers["set-cookie"]
