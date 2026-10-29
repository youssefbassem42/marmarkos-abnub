"""Tests for the landing-page slider (plan §7.2).

The public list answers the active slides, in order, and needs no token.
The administration is guarded by the admin role alone: a servant is
refused (403), the admin is not.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.utils import DEFAULT_PASSWORD, bearer, create_user_direct

PUBLIC_URL = "/api/v1/landing/slides"
ADMIN_URL = "/api/v1/admin/landing/slides"
REORDER_URL = "/api/v1/admin/landing/slides/reorder"


async def _auth_headers(
    client: AsyncClient,
    db_engine,
    *,
    email: str,
    role: str = "ADMIN",
) -> dict[str, str]:
    """Create a member directly and return a bearer header for them."""
    await create_user_direct(engine=db_engine, email=email, role_name=role)
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": DEFAULT_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return bearer(response.json()["access_token"])


async def _upload_stub(monkeypatch: pytest.MonkeyPatch) -> None:
    """The image upload calls Cloudinary, which the tests must not reach."""

    async def _fake(data: bytes, content_type: str, folder: str = "avatars") -> str:
        return "https://res.cloudinary.com/demo/image/upload/v1/fake.jpg"

    monkeypatch.setattr("app.modules.media.presentation.router.upload_image", _fake)


def _slide_file(name: str = "slide.jpg", data: bytes = b"fake-image-bytes") -> dict:
    return {"file": (name, data, "image/jpeg")}


async def test_public_list_is_empty_at_the_start(client: AsyncClient) -> None:
    response = await client.get(PUBLIC_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_public_list_needs_no_token(client: AsyncClient) -> None:
    """The public endpoint is open to everyone (no bearer required)."""
    response = await client.get(PUBLIC_URL)

    assert response.status_code == 200


async def test_creation_returns_the_created_slide(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    headers = await _auth_headers(client, db_engine, email="slide-admin@example.com", role="ADMIN")

    response = await client.post(
        ADMIN_URL,
        data={"title": "العنوان", "subtitle": "العنوان الفرعي"},
        files=_slide_file(),
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["title"] == "العنوان"
    assert body["subtitle"] == "العنوان الفرعي"
    assert body["image"] == "https://res.cloudinary.com/demo/image/upload/v1/fake.jpg"
    assert body["order"] == 1
    assert body["active"] is True
    assert "id" in body and "created_at" in body and "updated_at" in body


async def test_creation_is_refused_to_servant_and_member(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    for role, email in (
        ("SERVANT", "slide-servant@example.com"),
        ("MEMBER", "slide-member@example.com"),
    ):
        headers = await _auth_headers(client, db_engine, email=email, role=role)
        response = await client.post(
            ADMIN_URL,
            data={"title": "ع"},
            files=_slide_file(),
            headers=headers,
        )
        assert response.status_code == 403, f"{role}: {response.text}"


async def test_admin_list_returns_all_slides_including_inactive(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    headers = await _auth_headers(client, db_engine, email="slide-admin2@example.com", role="ADMIN")

    await client.post(ADMIN_URL, data={"title": "أحد"}, files=_slide_file(), headers=headers)
    await client.post(
        ADMIN_URL, data={"title": "اثنان"}, files=_slide_file(data=b"b"), headers=headers
    )
    # Deactivate the second one through the admin PATCH.
    list_response = await client.get(ADMIN_URL, headers=headers)
    second_id = list_response.json()["items"][1]["id"]
    await client.patch(
        f"{ADMIN_URL}/{second_id}",
        data={"active": "false"},
        headers=headers,
    )

    public = await client.get(PUBLIC_URL)
    assert len(public.json()["items"]) == 1
    assert public.json()["items"][0]["title"] == "أحد"

    admin = await client.get(ADMIN_URL, headers=headers)
    assert len(admin.json()["items"]) == 2
    assert all("active" in item and "created_at" in item for item in admin.json()["items"])


async def test_public_list_returns_active_slides_in_order(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    headers = await _auth_headers(client, db_engine, email="slide-admin3@example.com", role="ADMIN")

    await client.post(ADMIN_URL, data={"title": "أول"}, files=_slide_file(), headers=headers)
    await client.post(
        ADMIN_URL, data={"title": "ثاني"}, files=_slide_file(data=b"b"), headers=headers
    )
    await client.post(
        ADMIN_URL, data={"title": "ثالث"}, files=_slide_file(data=b"c"), headers=headers
    )

    list_response = await client.get(ADMIN_URL, headers=headers)
    ids = [item["id"] for item in list_response.json()["items"]]
    # Put the third slide first, then the first, then the second.
    await client.post(
        REORDER_URL,
        json={"ids": [ids[2], ids[0], ids[1]]},
        headers=headers,
    )

    public = await client.get(PUBLIC_URL)
    titles = [item["title"] for item in public.json()["items"]]
    assert titles == ["ثالث", "أول", "ثاني"]
    orders = [item["order"] for item in public.json()["items"]]
    assert orders == [0, 1, 2]


async def test_update_changes_the_fields(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    headers = await _auth_headers(client, db_engine, email="slide-admin4@example.com", role="ADMIN")

    create = await client.post(
        ADMIN_URL, data={"title": "قديم"}, files=_slide_file(), headers=headers
    )
    slide_id = create.json()["id"]

    response = await client.patch(
        f"{ADMIN_URL}/{slide_id}",
        data={"title": "جديد", "active": "false"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "جديد"
    assert body["subtitle"] is None
    assert body["active"] is False

    public = await client.get(PUBLIC_URL)
    assert public.json()["items"] == []


async def test_update_can_replace_the_image(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    headers = await _auth_headers(client, db_engine, email="slide-admin5@example.com", role="ADMIN")

    create = await client.post(ADMIN_URL, data={"title": "ر"}, files=_slide_file(), headers=headers)
    slide_id = create.json()["id"]

    response = await client.patch(
        f"{ADMIN_URL}/{slide_id}",
        data={"title": "ر جديد"},
        files=_slide_file(data=b"new-bytes"),
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["image"] == "https://res.cloudinary.com/demo/image/upload/v1/fake.jpg"


async def test_update_refused_to_servant(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    admin = await _auth_headers(client, db_engine, email="slide-admin6@example.com", role="ADMIN")
    servant = await _auth_headers(
        client, db_engine, email="slide-servant6@example.com", role="SERVANT"
    )

    create = await client.post(ADMIN_URL, data={"title": "ر"}, files=_slide_file(), headers=admin)
    slide_id = create.json()["id"]

    response = await client.patch(f"{ADMIN_URL}/{slide_id}", data={"title": "ع"}, headers=servant)
    assert response.status_code == 403


async def test_delete_removes_the_slide(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    headers = await _auth_headers(client, db_engine, email="slide-admin7@example.com", role="ADMIN")

    create = await client.post(
        ADMIN_URL, data={"title": "حذف"}, files=_slide_file(), headers=headers
    )
    slide_id = create.json()["id"]

    response = await client.delete(f"{ADMIN_URL}/{slide_id}", headers=headers)
    assert response.status_code == 204, response.text

    public = await client.get(PUBLIC_URL)
    assert public.json()["items"] == []
    admin = await client.get(ADMIN_URL, headers=headers)
    assert admin.json()["items"] == []


async def test_delete_refused_to_servant(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    admin = await _auth_headers(client, db_engine, email="slide-admin8@example.com", role="ADMIN")
    servant = await _auth_headers(
        client, db_engine, email="slide-servant8@example.com", role="SERVANT"
    )

    create = await client.post(ADMIN_URL, data={"title": "حذف"}, files=_slide_file(), headers=admin)
    slide_id = create.json()["id"]

    response = await client.delete(f"{ADMIN_URL}/{slide_id}", headers=servant)
    assert response.status_code == 403


async def test_update_and_delete_on_unknown_slide_return_404(
    client: AsyncClient, db_engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _upload_stub(monkeypatch)
    headers = await _auth_headers(client, db_engine, email="slide-admin9@example.com", role="ADMIN")

    unknown = str(uuid4())
    update = await client.patch(f"{ADMIN_URL}/{unknown}", data={"title": "ع"}, headers=headers)
    assert update.status_code == 404, update.text

    delete = await client.delete(f"{ADMIN_URL}/{unknown}", headers=headers)
    assert delete.status_code == 404, delete.text


async def test_openapi_declares_the_public_answer(client: AsyncClient) -> None:
    from app.core.openapi import build_openapi_schema
    from app.main import create_app

    schema = build_openapi_schema(create_app())
    operation = schema["paths"]["/api/v1/landing/slides"]["get"]
    # No security (public) - a declared 200 response with a body.
    assert operation.get("security") in (None, [])
    responses = operation["responses"]
    assert "200" in responses
    content = responses["200"].get("content", {})
    assert "application/json" in content
