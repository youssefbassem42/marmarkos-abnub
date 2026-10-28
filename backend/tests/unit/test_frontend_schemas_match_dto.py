"""
The schemas of the frontend must mirror the DTOs of the backend.

The frontend checks every answer with a **zod schema** (the check at
the edge of the API). A schema that requires a field the server does
not send **rejects** the answer: the page shows its error state instead
of the data — and nothing says why.

This happened with the payload of the quiz of the member: the schema
asked for `verse_id`, `verse_reference` and `status`, three fields
`QuizTakeResponse` does not declare. The end-to-end test caught it
(the page of the attempt stayed empty), but a unit test could not: the
fixtures of the frontend are written by hand.

The test compares the **fields that the schema of the frontend
requires** with the **fields that the DTO of the backend declares**
(the OpenAPI schema is the public contract of the server), for every
endpoint of the table below. A field that the schema requires and the
DTO does not declare fails the build.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest

BACKEND = Path(__file__).resolve().parents[2]
FRONTEND = BACKEND.parent / "frontend" / "src"
SCHEMAS = FRONTEND / "lib" / "schemas"

# The endpoint -> the schema of the frontend that checks its answer.
# The key is the path of the route (without the prefix of the API).
ENDPOINTS: dict[tuple[str, str], str] = {
    ("GET", "/bible-verses"): "verseAdminItemSchema",
    ("GET", "/bible-verses/published"): "verseCardSchema",
    ("GET", "/bible-verses/stats"): "verseStatsSchema",
    ("GET", "/bible-verses/{verse_id}"): "verseDetailSchema",
    ("GET", "/bible-verses/analytics/overview"): "verseAnalyticsOverviewSchema",
    ("GET", "/bible-verses/analytics/quick-stats"): "verseQuickStatsSchema",
    ("GET", "/bible-verses/{verse_id}/analytics"): "verseAnalyticsSchema",
    ("GET", "/quizzes"): "quizAdminItemSchema",
    ("GET", "/quizzes/{quiz_id}"): "quizDetailSchema",
    ("GET", "/quizzes/{quiz_id}/take"): "quizTakeSchema",
    ("GET", "/quizzes/{quiz_id}/validation"): "quizValidationSchema",
    ("GET", "/quizzes/analytics/overview"): "quizAnalyticsOverviewSchema",
    ("POST", "/quiz-attempts"): "attemptStartSchema",
    ("GET", "/quiz-attempts/{attempt_id}"): "attemptResumeSchema",
    ("PUT", "/quiz-attempts/{attempt_id}/answers/{question_id}"): "attemptHeartbeatSchema",
    ("POST", "/quiz-attempts/{attempt_id}/heartbeat"): "attemptHeartbeatSchema",
    ("POST", "/quiz-attempts/{attempt_id}/submit"): "attemptResultSchema",
    ("GET", "/quiz-attempts/{attempt_id}/result"): "attemptResultSchema",
    ("GET", "/quiz-attempts/{attempt_id}/review"): "attemptReviewSchema",
    ("GET", "/notifications"): "notificationSchema",
    ("GET", "/notifications/summary"): "notificationSummarySchema",
    ("POST", "/notifications/{notification_id}/read"): "markReadSchema",
    ("POST", "/notifications/read-all"): "markReadSchema",
    ("GET", "/users"): "userSchema",
    ("GET", "/users/me/points"): "pointsSchema",
    ("GET", "/users/me/points/monthly"): "monthlyPointsSchema",
    ("GET", "/users/me/points/history"): "pointActivityItemSchema",
    ("GET", "/quiz-analytics/monthly"): "monthlyAnalyticsSchema",
    ("GET", "/quiz-analytics/monthly/users"): "monthlyUserItemSchema",
    ("GET", "/quiz-analytics/users/{user_id}"): "monthlyUserDetailSchema",
    ("POST", "/anonymous-messages"): "anonymousMessageCreateSchema",
    ("GET", "/anonymous-messages"): "anonymousMessageAdminSchema",
}

# The fields of a schema of the frontend: `field: z.…`.
FIELD = re.compile(r"^\s*(\w+):\s*z\.", re.MULTILINE)

# The answers that succeed.
SUCCESS = ("200", "201", "202", "204")


def _schema_source(name: str) -> str:
    """The source of the object of a schema of the frontend."""
    for path in SCHEMAS.glob("*.ts"):
        source = path.read_text(encoding="utf-8")
        marker = f"export const {name} = "
        if marker not in source:
            continue
        start = source.index(marker)
        # The object of the schema: up to the closing of the call.
        depth = 0
        for index in range(start, len(source)):
            if source[index] == "(":
                depth += 1
            elif source[index] == ")":
                depth -= 1
                if depth == 0:
                    return source[start : index + 1]
        return source[start:]
    raise AssertionError(f"the frontend has no schema named {name}")


def _required_fields(name: str) -> set[str]:
    """The fields that the schema of the frontend requires."""
    return set(FIELD.findall(_schema_source(name)))


def _resolve(schema: dict, openapi: dict) -> dict:
    """The schema behind a `$ref` of the OpenAPI schema."""
    seen = 0
    while "$ref" in schema and seen < 5:
        ref = schema["$ref"]
        assert ref.startswith("#/"), ref
        current: Any = openapi
        for part in ref.removeprefix("#/").split("/"):
            current = current[part]
        schema = current
        seen += 1
    return schema


def _dto_fields(method: str, path: str) -> set[str]:
    """The fields that the DTO of the answer declares."""
    from app.core.openapi import build_openapi_schema  # noqa: PLC0415
    from app.main import app  # noqa: PLC0415

    openapi = build_openapi_schema(app)
    route = path if path in openapi["paths"] else f"/api/v1{path}"
    operation = openapi["paths"][route][method.lower()]
    responses = operation["responses"]

    for status in SUCCESS:
        if status not in responses:
            continue
        content = responses[status].get("content", {})
        if "application/json" not in content:
            continue
        schema = _resolve(content["application/json"]["schema"], openapi)
        # The envelope of a page: the DTO of the items. The fields of
        # the envelope and the fields of the items are both accepted
        # (the frontend checks one or the other).
        properties = set(schema.get("properties", {}))
        items = schema.get("properties", {}).get("items")
        if items:
            item_schema = _resolve(items, openapi)
            # The items of the envelope are a list of DTOs.
            if item_schema.get("type") == "array" and "items" in item_schema:
                item_schema = _resolve(item_schema["items"], openapi)
            properties |= set(item_schema.get("properties", {}))
            return properties
        # A list of DTOs.
        if schema.get("type") == "array" and "items" in schema:
            schema = _resolve(schema["items"], openapi)
        return properties | set(schema.get("properties", {}))

    return set()


@pytest.mark.parametrize(
    ("method", "path", "schema"),
    [(method, path, schema) for (method, path), schema in ENDPOINTS.items()],
    ids=lambda value: value if isinstance(value, str) else "",
)
def test_the_schema_of_the_frontend_mirrors_the_dto(method: str, path: str, schema: str) -> None:
    """The schema must not require a field the DTO does not declare."""
    fields = _dto_fields(method, path)
    assert fields, (
        f"{method} {path} has no DTO in the OpenAPI schema — the endpoint "
        f"must declare a response model, otherwise the contract is invisible"
    )

    extra = _required_fields(schema) - fields

    assert not extra, (
        f"{method} {path} — the schema of the frontend ({schema}) requires "
        f"{sorted(extra)}, and the DTO of the backend does not declare them"
    )
