"""
The URLs of the frontend must be the URLs of the backend.

The client of a module is a thin wrapper: it decides the **method** and
the **path** of every call. A path that does not exist answers 404, and
the page that waits for it shows the empty state forever - a defect
nobody notices, because the type of the answer is right and the test
of the client mocks the answer.

This test compares the calls of the frontend with the **OpenAPI schema
of the backend** (the ground truth of the public contract). It found the
page of the points: it called `/points/me` three times, and the backend
mounts the router under `/users/me/points`.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[2]
FRONTEND = BACKEND.parent / "frontend" / "src"

# A call of the client: `apiClient.get("/some/path")` - the path may be
# a template literal with a placeholder (`/quizzes/${quizId}`).
CALL = re.compile(
    r"apiClient\.(get|post|put|patch|delete)\(\s*"
    r"(?:`([^`]*)`|\"([^\"]*)\"|'([^']*)')"
)

# The placeholder of a path: `/quizzes/${quizId}` -> `/quizzes/{}`.
PLACEHOLDER = re.compile(r"\$\{[^}]+\}")


def _backend_paths() -> set[tuple[str, str]]:
    """The (method, path) of every route of the backend."""
    from app.core.openapi import build_openapi_schema  # noqa: PLC0415
    from app.main import app  # noqa: PLC0415

    schema = build_openapi_schema(app)
    paths: set[tuple[str, str]] = set()
    for path, methods in schema.get("paths", {}).items():
        # The paths of the schema carry the prefix of the API.
        route = path.removeprefix("/api/v1")
        for method in methods:
            if method.upper() in {"HEAD", "OPTIONS"}:
                continue
            paths.add((method.upper(), _normalise(route)))
    return paths


def _normalise(route: str) -> str:
    """The path of the frontend and the path of the schema are comparable."""
    route = PLACEHOLDER.sub("{}", route)
    route = re.sub(r"\{[^}]+\}", "{}", route)
    return route.rstrip("/") or "/"


def _frontend_calls() -> list[tuple[str, str, str]]:
    """The (method, path, file) of every call of the frontend."""
    calls: list[tuple[str, str, str]] = []
    for path in FRONTEND.rglob("*.ts"):
        if path.name.endswith(".test.ts") or "__tests__" in path.parts:
            continue
        source = path.read_text(encoding="utf-8")
        for match in CALL.finditer(source):
            method = match.group(1).upper()
            url = next((group for group in match.groups()[1:] if group), "")
            if not url:
                continue
            calls.append((method, _normalise(url), str(path.relative_to(FRONTEND))))
    return calls


@pytest.mark.parametrize(
    ("method", "path", "where"),
    _frontend_calls(),
    ids=lambda value: value if isinstance(value, str) else "",
)
def test_the_frontend_calls_a_route_that_the_backend_has(
    method: str, path: str, where: str
) -> None:
    """Every call of the frontend must be a route of the backend."""
    backend = _backend_paths()
    assert (method, path) in backend, (
        f"{where} calls {method} {path}, and the backend has no such route "
        f"(the page that waits for it shows the empty state forever)"
    )
