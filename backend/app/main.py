import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import (
    AllowHeaderMiddleware,
    CacheControlMiddleware,
    SecurityHeadersMiddleware,
)
from app.core.observability import RequestContextMiddleware, install_request_id_filter
from app.core.openapi import install_openapi

logger = logging.getLogger(__name__)


_HTTP_METHODS = frozenset({"get", "post", "put", "patch", "delete"})


def _allowed_methods(application: FastAPI) -> dict[str, set[str]]:
    """The methods every path of the API answers (for the Allow header).

    The list is taken from the OpenAPI schema - the contract of the API -
    instead of from the internal routing table, whose shape changes with
    the FastAPI version.
    """
    schema = application.openapi()
    return {
        path: {method.upper() for method in item if method in _HTTP_METHODS}
        for path, item in schema.get("paths", {}).items()
        if isinstance(item, dict)
    }


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        # Swagger / ReDoc / the raw schema are only exposed when DEBUG=true.
        # In production (DEBUG=false) these URLs return 404, so the full
        # API schema is never served to anonymous callers. (The raw
        # /openapi.json route used to stay enabled - it is now hidden too.)
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
    )

    @application.middleware("http")
    async def cors_safe_errors(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            # The traceback is the only record of what actually broke: this
            # handler deliberately returns an opaque body, so without the log
            # line a 500 here is undiagnosable.
            logger.exception("Unhandled error: %s %s", request.method, request.url.path)
            detail: dict[str, str] = {
                "code": "internal_error",
                "message": "Internal server error",
            }
            headers: dict[str, str] | None = None
            if settings.EXPOSE_ERROR_DETAILS:
                detail["error_type"] = type(exc).__name__
                detail["error_message"] = str(exc)[:500]
                headers = {"X-Error-Type": type(exc).__name__}
            return JSONResponse({"detail": detail}, status_code=500, headers=headers)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=[
            origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()
        ]
        + [settings.FRONTEND_URL.rstrip("/")],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ids + request counters (SEC-014). Registered first so every
    # other middleware and every handler runs inside its context.
    application.add_middleware(RequestContextMiddleware)

    # Hardening headers on every response (SEC-009). Registered after the
    # CORS middleware so the security headers are added last.
    application.add_middleware(SecurityHeadersMiddleware)

    # Cache policy of the well-known routes (PERF-004).
    application.add_middleware(CacheControlMiddleware)

    # Every log line carries the request id (SEC-014).
    install_request_id_filter()

    register_exception_handlers(application)

    application.include_router(api_router)

    # The schema of the API with the standard error answers (401, 403,
    # 400, 429) - SEC-010.
    install_openapi(application)

    # The Allow header of a 405 answer names every method of the path,
    # not only the first one Starlette finds (QA-005). It is registered
    # last so the routing table is complete.
    application.add_middleware(AllowHeaderMiddleware, allowed_methods=_allowed_methods(application))

    return application


app = create_app()
