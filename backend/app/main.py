import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.config import settings
from app.core.exceptions import register_exception_handlers

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
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

    register_exception_handlers(application)

    application.include_router(api_router)

    return application


app = create_app()
