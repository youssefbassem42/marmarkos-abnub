from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.exceptions.errors import AppError


def register_exception_handlers(application: FastAPI) -> None:
    @application.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {"Retry-After": str(exc.retry_after)} if hasattr(exc, "retry_after") else None
        detail: dict[str, object] = {"code": exc.code, "message": str(exc)}
        # Data-carrying errors (quiz_not_publishable, attempt_exists, ...)
        # merge their structured payload into the envelope; the two-key
        # shape is unchanged for every other error.
        data = getattr(exc, "data", None)
        if data:
            detail["data"] = data
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": detail},
            headers=headers,
        )
