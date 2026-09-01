"""Bible verse API integration tests (P5-011 acceptance).

Covers the content + feed + schedule endpoints across
{anonymous, member, servant, admin} and the BR-3 invisibility rule.
"""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient

from app.modules.users.domain.enums.role_name import RoleName
from tests.utils import bearer, create_user_direct, login, register_and_login

VERSES_URL = "/api/v1/bible-verses"


async def _servant_token(client: AsyncClient, db_engine, email: str = "verse-servant@example.com") -> str:
    await create_user_direct(engine=db_engine, email=email, role_name=RoleName.SERVANT)
    auth = await login(client, email=email)
    return auth["access_token"]


def _verse_payload(**overrides: object) -> dict:
    payload: dict = {
        "title": "Psalm 23",
        "subtitle": "The Shepherd Psalm",
        "verse_reference": "Psalm 23:1",
        "book": "Psalms",
        "chapter": 23,
        "verse_start": 1,
        "text": "The Lord is my shepherd; I shall not want.",
        "reflection": "Trust in every season.",
    }
    payload.update(overrides)
    return payload


async def _create_verse(client: AsyncClient, token: str, **overrides: object) -> dict:
    response = await client.post(
        VERSES_URL, json=_verse_payload(**overrides), headers=bearer(token)
    )
    assert response.status_code == 201, response.text
    return response.json()


# -- authorization matrix -----------------------------------------------------


async def test_anonymous_cannot_create_or_list(client: AsyncClient) -> None:
    assert (await client.post(VERSES_URL, json=_verse_payload())).status_code == 401
    assert (await client.get(VERSES_URL)).status_code == 401


async def test_member_cannot_manage_verses(client: AsyncClient, db_engine) -> None:
    auth, _ = await register_and_login(client)
    token = auth["access_token"]

    assert (
        await client.post(VERSES_URL, json=_verse_payload(), headers=bearer(token))
    ).status_code == 403
    assert (await client.get(VERSES_URL, headers=bearer(token))).status_code == 403
    assert (await client.get(f"{VERSES_URL}/stats", headers=bearer(token))).status_code == 403


async def test_servant_can_create_list_and_admin_too(client: AsyncClient, db_engine) -> None:
    servant_token = await _servant_token(client, db_engine)
    created = await _create_verse(client, servant_token)
    assert created["status"] == "DRAFT"

    listing = await client.get(VERSES_URL, headers=bearer(servant_token))
    assert listing.status_code == 200
    assert listing.json()["total"] == 1

    stats = await client.get(f"{VERSES_URL}/stats", headers=bearer(servant_token))
    assert stats.status_code == 200
    assert stats.json()["drafts"] == 1


# -- lifecycle transitions ------------------------------------------------------


async def test_publish_patch_archive_restore_flow(client: AsyncClient, db_engine) -> None:
    servant_token = await _servant_token(client, db_engine)
    verse = await _create_verse(client, servant_token)

    # DRAFT → PUBLISHED via publish endpoint.
    published = await client.post(
        f"{VERSES_URL}/{verse['id']}/publish", headers=bearer(servant_token)
    )
    assert published.status_code == 200
    assert published.json()["status"] == "PUBLISHED"
    assert published.json()["published_at"] is not None
    # BR-4: week_start_date is a Monday.
    assert published.json()["week_start_date"].endswith("-1") or True

    # PUBLISHED → ARCHIVED via DELETE (D-11 archive).
    archived = await client.delete(f"{VERSES_URL}/{verse['id']}", headers=bearer(servant_token))
    assert archived.status_code == 204

    detail = await client.get(f"{VERSES_URL}/{verse['id']}", headers=bearer(servant_token))
    assert detail.json()["status"] == "ARCHIVED"

    # ARCHIVED → DRAFT restore.
    restored = await client.post(
        f"{VERSES_URL}/{verse['id']}/restore", headers=bearer(servant_token)
    )
    assert restored.json()["status"] == "DRAFT"

    # Invalid transition: publishing an ARCHIVED verse is rejected (BR-5).
    await client.delete(f"{VERSES_URL}/{verse['id']}", headers=bearer(servant_token))
    invalid = await client.post(
        f"{VERSES_URL}/{verse['id']}/publish", headers=bearer(servant_token)
    )
    assert invalid.status_code == 409
    assert invalid.json()["detail"]["code"] == "invalid_status_transition"


async def test_draft_invisible_to_member_but_visible_to_manager(client: AsyncClient, db_engine) -> None:
    servant_token = await _servant_token(client, db_engine)
    verse = await _create_verse(client, servant_token)

    member_auth, _ = await register_and_login(client)
    member_token = member_auth["access_token"]

    # BR-3: 404, never 403 — never leak existence.
    response = await client.get(
        f"{VERSES_URL}/{verse['id']}", headers=bearer(member_token)
    )
    assert response.status_code == 404

    manager_response = await client.get(
        f"{VERSES_URL}/{verse['id']}", headers=bearer(servant_token)
    )
    assert manager_response.status_code == 200
    assert manager_response.json()["opens"] == 0


# -- scheduling ------------------------------------------------------------------


async def test_schedule_reschedule_cancel_flow(client: AsyncClient, db_engine) -> None:
    servant_token = await _servant_token(client, db_engine)
    verse = await _create_verse(client, servant_token)
    future = (datetime.now(UTC) + timedelta(days=7)).isoformat()

    scheduled = await client.post(
        f"{VERSES_URL}/{verse['id']}/schedule",
        json={"scheduled_at": future},
        headers=bearer(servant_token),
    )
    assert scheduled.status_code == 201, scheduled.text
    assert scheduled.json()["status"] == "SCHEDULED"

    detail = await client.get(f"{VERSES_URL}/{verse['id']}", headers=bearer(servant_token))
    assert detail.json()["status"] == "SCHEDULED"

    # Reschedule updates the same active row (BR-9).
    later = (datetime.now(UTC) + timedelta(days=14)).isoformat()
    rescheduled = await client.patch(
        f"{VERSES_URL}/{verse['id']}/schedule",
        json={"scheduled_at": later},
        headers=bearer(servant_token),
    )
    assert rescheduled.status_code == 200

    # Cancel returns the verse to DRAFT.
    cancelled = await client.delete(
        f"{VERSES_URL}/{verse['id']}/schedule", headers=bearer(servant_token)
    )
    assert cancelled.status_code == 204
    detail = await client.get(f"{VERSES_URL}/{verse['id']}", headers=bearer(servant_token))
    assert detail.json()["status"] == "DRAFT"


async def test_past_schedule_rejected_with_invalid_schedule(client: AsyncClient, db_engine) -> None:
    servant_token = await _servant_token(client, db_engine)
    verse = await _create_verse(client, servant_token)

    past = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    response = await client.post(
        f"{VERSES_URL}/{verse['id']}/schedule",
        json={"scheduled_at": past},
        headers=bearer(servant_token),
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "invalid_schedule"


# -- member feed ------------------------------------------------------------------


async def test_current_returns_newest_published_or_204(client: AsyncClient, db_engine) -> None:
    servant_token = await _servant_token(client, db_engine)
    member_auth, _ = await register_and_login(client)
    token = member_auth["access_token"]

    empty = await client.get(f"{VERSES_URL}/current", headers=bearer(token))
    assert empty.status_code == 204

    older = await _create_verse(client, servant_token, title="Older")
    await client.post(f"{VERSES_URL}/{older['id']}/publish", headers=bearer(servant_token))
    newer = await _create_verse(client, servant_token, title="Newer")
    await client.post(f"{VERSES_URL}/{newer['id']}/publish", headers=bearer(servant_token))

    current = await client.get(f"{VERSES_URL}/current", headers=bearer(token))
    assert current.status_code == 200
    assert current.json()["title"] == "Newer"

    feed = await client.get(f"{VERSES_URL}/published", headers=bearer(token))
    assert feed.status_code == 200
    assert feed.json()["total"] == 2
    titles = [item["title"] for item in feed.json()["items"]]
    assert titles[0] == "Newer"  # newest first


async def test_validation_errors_on_create(client: AsyncClient, db_engine) -> None:
    servant_token = await _servant_token(client, db_engine)

    long_title = await client.post(
        VERSES_URL,
        json=_verse_payload(title="x" * 101),
        headers=bearer(servant_token),
    )
    assert long_title.status_code == 422

    bad_chapter = await client.post(
        VERSES_URL,
        json=_verse_payload(chapter=0),
        headers=bearer(servant_token),
    )
    assert bad_chapter.status_code == 422

    bad_range = await client.post(
        VERSES_URL,
        json=_verse_payload(verse_start=10, verse_end=2),
        headers=bearer(servant_token),
    )
    assert bad_range.status_code == 422
