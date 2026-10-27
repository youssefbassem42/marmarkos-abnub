"""The schema of the API describes the answers the API really gives.

The contract test (schemathesis, QA-005) compares the answers of the
running API with the schema. These tests pin the rules that make that
comparison possible, so a new route cannot quietly forget them.
"""

from httpx import AsyncClient

from app.main import create_app

_SECURED = "/api/v1/notifications"
_PUBLIC_BODY = "/api/v1/auth/login"
_RATE_LIMITED = "/api/v1/auth/register"


def _schema() -> dict[str, object]:
    application = create_app()
    return application.openapi()


def _responses(path: str, method: str) -> dict[str, object]:
    paths = _schema()["paths"]
    assert isinstance(paths, dict)
    item = paths[path]
    assert isinstance(item, dict)
    operation = item[method]
    assert isinstance(operation, dict)
    responses = operation["responses"]
    assert isinstance(responses, dict)
    return responses


def test_a_protected_operation_documents_the_authentication_failures() -> None:
    """A client must know that a missing token is an answer."""
    responses = _responses(_SECURED, "get")

    assert "401" in responses
    assert "403" in responses


def test_a_public_operation_does_not_document_a_401() -> None:
    """A public operation gets no automatic 401.

    The sign-in is the exception: it declares a 401 of its own ("invalid
    credentials"), which is a different thing.
    """
    for path, method in (
        ("/api/v1/anonymous-messages", "post"),
        ("/api/v1/health", "get"),
    ):
        assert "401" not in _responses(path, method)


def test_an_operation_with_a_body_documents_the_unparsable_body() -> None:
    responses = _responses(_PUBLIC_BODY, "post")

    assert "400" in responses


def test_a_rate_limited_operation_documents_the_429() -> None:
    responses = _responses(_RATE_LIMITED, "post")

    assert "429" in responses


def test_the_google_redirects_are_documented() -> None:
    """The OAuth endpoints answer with a redirect, never with a body."""
    for path in ("/api/v1/auth/google/login", "/api/v1/auth/google/callback"):
        assert "303" in _responses(path, "get")


def test_the_anonymous_submission_does_not_need_a_token() -> None:
    """The public submission declares no security (SEC-010)."""
    paths = _schema()["paths"]
    assert isinstance(paths, dict)
    operation = paths["/api/v1/anonymous-messages"]["post"]
    assert isinstance(operation, dict)

    assert operation["security"] == []


async def test_the_allow_header_names_every_method_of_the_path(client: AsyncClient) -> None:
    """A 405 must announce every method the path supports (RFC 9110)."""
    response = await client.request("OPTIONS", "/api/v1/anonymous-messages")

    assert response.status_code == 405
    allowed = {method.strip() for method in response.headers["Allow"].split(",")}
    assert {"GET", "POST"} <= allowed


async def test_the_allow_header_works_with_a_path_parameter(client: AsyncClient) -> None:
    response = await client.request(
        "OPTIONS",
        "/api/v1/bible-verses/11111111-1111-1111-1111-111111111111",
    )

    assert response.status_code == 405
    allowed = {method.strip() for method in response.headers["Allow"].split(",")}
    assert {"GET", "PATCH", "DELETE"} <= allowed
