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

from httpx import AsyncClient

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
