"""The OpenAPI schema of the API (SEC-010).

The schema that FastAPI generates on its own only documents what a route
declares explicitly. The API has three answers that every route can
produce and that no route declares:

* **401** - the token is missing, expired or invalid,
* **403** - the token is valid, but the member does not hold the role,
* **400** - the request body is not parsable (malformed JSON).

A client generated from the schema (or a contract test) must know that
these answers exist: a schema that only lists ``200`` and ``422`` claims
that a missing token cannot happen, which is exactly the kind of
assumption that breaks an integration.

The generator below adds the missing answers to the operations that can
produce them. It never removes or rewrites what a route declared.
"""

from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

#: The envelope of every handled error (``AppError``).
_ERROR_ENVELOPE: dict[str, Any] = {
    "type": "object",
    "properties": {
        "detail": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "examples": ["unauthorized"]},
                "message": {"type": "string"},
                "data": {"type": "object", "additionalProperties": True},
            },
            "required": ["code", "message"],
        }
    },
    "required": ["detail"],
}

#: The body of a request that cannot be parsed at all.
_UNPARSABLE_BODY: dict[str, Any] = {
    "type": "object",
    "properties": {"detail": {"type": "string"}},
}

#: The 429 answer of the rate limiter.
_RATE_LIMITED: dict[str, Any] = {
    "description": "Too many requests - slow down and try again later",
    "content": {"application/json": {"schema": _ERROR_ENVELOPE}},
    "headers": {
        "Retry-After": {
            "description": "Seconds to wait before the next attempt",
            "schema": {"type": "integer"},
        }
    },
}


def _response(description: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "description": description,
        "content": {"application/json": {"schema": schema}},
    }


def _requires_authentication(operation: dict[str, Any]) -> bool:
    """True when the operation needs a credential.

    An operation with ``security: []`` explicitly says "no credential
    needed" (the anonymous message submission) - it must not get a 401.
    """
    security = operation.get("security")
    if security is None:
        return False
    return bool(security)


def build_openapi_schema(application: FastAPI) -> dict[str, Any]:
    """The schema of the API with the standard error answers."""
    schema = get_openapi(
        title=application.title,
        version=application.version,
        description=application.description,
        routes=application.routes,
        tags=application.openapi_tags,
        servers=application.servers,
        contact=application.contact,
        license_info=application.license_info,
        separate_input_output_schemas=application.separate_input_output_schemas,
    )

    for path_item in schema.get("paths", {}).values():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete", "head", "options"}:
                continue
            responses: dict[str, Any] = operation.setdefault("responses", {})

            if _requires_authentication(operation):
                responses.setdefault(
                    "401",
                    _response(
                        "Not authenticated - the token is missing, expired or invalid",
                        _ERROR_ENVELOPE,
                    ),
                )
                responses.setdefault(
                    "403",
                    _response("Insufficient permissions", _ERROR_ENVELOPE),
                )

            if "requestBody" in operation:
                responses.setdefault(
                    "400",
                    _response("The request body could not be parsed", _UNPARSABLE_BODY),
                )

            if operation.get("x-rate-limited"):
                responses.setdefault("429", dict(_RATE_LIMITED))

    return schema


def install_openapi(application: FastAPI) -> None:
    """Make the application serve the enriched schema."""

    def openapi() -> dict[str, Any]:
        if application.openapi_schema:
            return application.openapi_schema
        application.openapi_schema = build_openapi_schema(application)
        return application.openapi_schema

    application.openapi = openapi  # type: ignore[method-assign]
